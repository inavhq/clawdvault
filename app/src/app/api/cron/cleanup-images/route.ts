/**
 * Cron: Clean up orphaned token images
 *
 * Scans the 'token-images' bucket and deletes any files
 * whose URL doesn't match a token's image field in the database.
 * Avatars live in a separate 'avatars' bucket so no filtering needed.
 *
 * Usage: GET /api/cron/cleanup-images (with CRON_SECRET auth)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const BUCKET = 'token-images';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = getSupabase();

    // List root-level files in the bucket (token images live at root)
    const { data: files, error: listError } = await client.storage
      .from(BUCKET)
      .list('', { limit: 1000 });

    if (listError) {
      return NextResponse.json({ error: 'Failed to list files', details: listError.message }, { status: 500 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ success: true, message: 'No token images found', deleted: 0 });
    }

    // Filter out folders and hidden files — only look at actual image files
    const imageFiles = files.filter(f => f.id && !f.name.startsWith('.'));

    if (imageFiles.length === 0) {
      return NextResponse.json({ success: true, message: 'No token images found', deleted: 0 });
    }

    // Build set of image URLs that are actually in use
    const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
    const tokens = await db().token.findMany({
      where: { image: { not: null } },
      select: { image: true },
    });
    const usedUrls = new Set(tokens.map(t => t.image));

    // Find orphans — files not referenced by any token
    const orphans: string[] = [];
    for (const file of imageFiles) {
      const url = `${publicSupabaseUrl}/storage/v1/object/public/${BUCKET}/${file.name}`;
      if (!usedUrls.has(url)) {
        orphans.push(file.name);
      }
    }

    if (orphans.length === 0) {
      return NextResponse.json({ success: true, message: 'No orphaned images', deleted: 0 });
    }

    // Delete orphans in batches of 100
    let deleted = 0;
    for (let i = 0; i < orphans.length; i += 100) {
      const batch = orphans.slice(i, i + 100);
      const { error: deleteError } = await client.storage.from(BUCKET).remove(batch);
      if (deleteError) {
        console.error(`Failed to delete batch at offset ${i}:`, deleteError);
      } else {
        deleted += batch.length;
      }
    }

    console.log(`[cleanup-images] Deleted ${deleted} orphaned token images`);

    return NextResponse.json({
      success: true,
      deleted,
      total: imageFiles.length,
    });
  } catch (error) {
    console.error('Cleanup images error:', error);
    return NextResponse.json(
      { error: 'Failed to clean up images', details: (error as Error).message },
      { status: 500 }
    );
  }
}
