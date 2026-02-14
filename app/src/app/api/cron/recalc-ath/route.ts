/**
 * Manual Cron: Recalculate ATH from all candle history
 *
 * Scans every token's candle data to find the true all-time high USD price
 * and updates the token record. Run manually when ATH data may be stale
 * or after initial deployment.
 *
 * Usage: GET /api/cron/recalc-ath (with CRON_SECRET auth)
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[CRON] Recalculating ATH from candle history...');
  const startTime = Date.now();
  const prisma = db();

  const tokens = await prisma.token.findMany({
    select: { mint: true, symbol: true, ath: true }
  });

  let updated = 0;

  for (const token of tokens) {
    // Find the highest USD price across all candles for this token
    const maxCandle = await prisma.priceCandle.findFirst({
      where: { tokenMint: token.mint },
      orderBy: { highUsd: 'desc' },
      select: { highUsd: true }
    });

    if (!maxCandle?.highUsd) continue;

    const candleAth = Number(maxCandle.highUsd);
    const currentAth = token.ath ? Number(token.ath) : 0;

    if (candleAth !== currentAth) {
      await prisma.token.update({
        where: { mint: token.mint },
        data: { ath: candleAth }
      });
      console.log(`  ${token.symbol}: ${currentAth.toFixed(8)} -> ${candleAth.toFixed(8)}`);
      updated++;
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[CRON] ATH recalc done: ${updated}/${tokens.length} tokens updated in ${duration}ms`);

  return NextResponse.json({
    success: true,
    tokensScanned: tokens.length,
    tokensUpdated: updated,
    duration: `${duration}ms`,
  });
}
