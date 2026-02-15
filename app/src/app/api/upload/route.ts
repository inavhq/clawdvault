import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const BUCKET = 'images';
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

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

let bucketReady = false;

async function ensureBucket() {
  if (bucketReady) return;
  const client = getSupabase();
  const { data: buckets } = await client.storage.listBuckets();

  // Create new 'images' bucket if needed
  if (!buckets?.some(b => b.name === BUCKET)) {
    const { error } = await client.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: ALLOWED_TYPES,
    });
    if (error && !error.message.includes('already exists')) {
      console.error('Error creating bucket:', error);
      return;
    }
  }

  bucketReady = true;
}

function getPublicUrl(path: string): string {
  const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  return `${publicSupabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

/**
 * POST /api/upload
 *
 * FormData fields:
 * - file: File (required)
 * - type: 'avatar' | 'token' (optional, defaults to 'token')
 * - wallet: string (required when type=avatar)
 *
 * Storage layout:
 * - avatars/{wallet}.{ext}  — one per wallet, upsert replaces old
 * - tokens/{uuid}.{ext}     — unique per token image
 */
export async function POST(req: NextRequest) {
  try {
    if (!isUploadEnabled()) {
      return NextResponse.json({ error: 'Upload not configured' }, { status: 503 });
    }

    await ensureBucket();

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

    let storagePath: string;
    let upsert = false;

    if (type === 'avatar') {
      if (!wallet) {
        return NextResponse.json({ error: 'wallet is required for avatar uploads' }, { status: 400 });
      }
      // Delete any existing avatar files for this wallet (handles extension changes)
      const { data: existing } = await client.storage.from(BUCKET).list('avatars', {
        search: wallet,
      });
      if (existing && existing.length > 0) {
        await client.storage.from(BUCKET).remove(
          existing.map(f => `avatars/${f.name}`)
        );
      }
      storagePath = `avatars/${wallet}.${ext}`;
      upsert = true;
    } else {
      storagePath = `tokens/${uuidv4()}.${ext}`;
    }

    const { error } = await client.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert,
      });

    if (error) {
      console.error('Upload error:', error);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      url: getPublicUrl(storagePath),
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
