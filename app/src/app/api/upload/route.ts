import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { rateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/prisma';
import { verifyWalletAuth } from '@/lib/auth';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Bucket per type
const BUCKETS = {
  token: 'token-images',  // Existing prod bucket — {uuid}.{ext} at root
  avatar: 'avatars',      // Separate bucket — {wallet}.{ext}
} as const;

// Lazy-load Supabase client to avoid build-time errors
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabase;
}

function isUploadEnabled() {
  return !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

const readyBuckets = new Set<string>();

async function ensureBucket(bucket: string) {
  if (readyBuckets.has(bucket)) return;
  const client = getSupabase();
  const { data: buckets } = await client.storage.listBuckets();

  if (!buckets?.some(b => b.name === bucket)) {
    const { error } = await client.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: ALLOWED_TYPES,
    });
    if (error && !error.message.includes('already exists')) {
      console.error(`Error creating bucket '${bucket}':`, error);
      return;
    }
  }

  readyBuckets.add(bucket);
}

function getPublicUrl(bucket: string, path: string): string {
  const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  return `${publicSupabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Authenticate an avatar upload request. Supports two methods:
 * 1. Wallet signature: X-Wallet + X-Signature headers (browser users)
 * 2. Agent API key: Authorization: Bearer <apiKey> (agents)
 *
 * Returns the authenticated wallet address, or null if auth fails.
 */
async function authenticateAvatarUpload(req: NextRequest, wallet: string): Promise<string | null> {
  // Method 1: Wallet signature (X-Wallet + X-Signature)
  const xWallet = req.headers.get('X-Wallet');
  const xSignature = req.headers.get('X-Signature');
  if (xWallet && xSignature) {
    if (xWallet !== wallet) return null;
    if (verifyWalletAuth(xWallet, xSignature, 'upload', { wallet })) {
      return xWallet;
    }
    return null;
  }

  // Method 2: Agent API key (Authorization: Bearer <key>)
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7);
    const agent = await db().agent.findUnique({
      where: { apiKey },
      select: { user: { select: { wallet: true } } },
    });
    if (agent?.user.wallet === wallet) {
      return wallet;
    }
    return null;
  }

  return null;
}

/**
 * POST /api/upload
 *
 * FormData fields:
 * - file: File (required)
 * - type: 'avatar' | 'token' (optional, defaults to 'token')
 * - wallet: string (required when type=avatar)
 *
 * Auth (required for avatar uploads):
 * - Wallet signature: X-Wallet + X-Signature headers
 * - Agent API key: Authorization: Bearer <apiKey>
 *
 * Storage layout:
 * - token-images bucket: {uuid}.{ext} — one per token image
 * - avatars bucket: {wallet}.{ext} — one per wallet, upsert replaces old
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 20 uploads per hour per IP
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!rateLimit(ip, 'upload', 20, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        { status: 429 }
      );
    }

    if (!isUploadEnabled()) {
      return NextResponse.json({ error: 'Upload not configured' }, { status: 503 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as string) || 'token';
    const wallet = formData.get('wallet') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPEG, GIF, WebP' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size: 5MB' },
        { status: 400 }
      );
    }

    const ext = file.name.split('.').pop() || 'png';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const client = getSupabase();

    let bucket: string;
    let storagePath: string;
    let upsert = false;

    if (type === 'avatar') {
      if (!wallet) {
        return NextResponse.json({ error: 'wallet is required for avatar uploads' }, { status: 400 });
      }

      // Verify caller owns this wallet
      const authedWallet = await authenticateAvatarUpload(req, wallet);
      if (!authedWallet) {
        return NextResponse.json({ error: 'Unauthorized — wallet signature or agent API key required' }, { status: 401 });
      }

      bucket = BUCKETS.avatar;
      await ensureBucket(bucket);

      // Delete any existing avatar files for this wallet (handles extension changes)
      const { data: existing } = await client.storage.from(bucket).list('', {
        search: wallet,
      });
      if (existing && existing.length > 0) {
        await client.storage.from(bucket).remove(
          existing.map(f => f.name)
        );
      }
      storagePath = `${wallet}.${ext}`;
      upsert = true;
    } else {
      bucket = BUCKETS.token;
      await ensureBucket(bucket);
      storagePath = `${uuidv4()}.${ext}`;
    }

    const { error } = await client.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert,
      });

    if (error) {
      console.error('Upload error:', error);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const url = getPublicUrl(bucket, storagePath);

    // For avatar uploads, save the URL to the user record
    if (type === 'avatar' && wallet) {
      await db().user.updateMany({
        where: { wallet },
        data: { avatar: url },
      });
    }

    return NextResponse.json({
      success: true,
      url,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
