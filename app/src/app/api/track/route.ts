import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';

/**
 * POST /api/track
 *
 * Lightweight page view counter. Called client-side on homepage mount.
 * Atomically increments the page_views counter in site_stats.
 */
export async function POST() {
  try {
    await db().$executeRaw`
      INSERT INTO site_stats (key, value) VALUES ('page_views', 1)
      ON CONFLICT (key) DO UPDATE SET value = site_stats.value + 1
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Track error:', error);
    // Never fail the client — tracking is best-effort
    return NextResponse.json({ ok: true });
  }
}
