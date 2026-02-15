import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/backfill-user-stats
 *
 * One-time backfill to compute User stats from existing trades and tokens.
 * Safe to run multiple times — it recalculates from scratch each time.
 */
export async function GET() {
  try {
    // 1. Aggregate volume per trader from all trades
    const volumeByTrader = await db().trade.groupBy({
      by: ['trader'],
      _sum: { solAmount: true },
    });

    // 2. Count tokens created per creator
    const tokensByCreator = await db().token.groupBy({
      by: ['creator'],
      _count: true,
    });

    // 3. Aggregate creator fees earned per recipient
    const feesByRecipient = await db().fee.groupBy({
      by: ['recipient'],
      where: { feeType: 'CREATOR' },
      _sum: { amount: true },
    });

    // Collect all unique wallets
    const wallets = new Set<string>();
    volumeByTrader.forEach((v) => wallets.add(v.trader));
    tokensByCreator.forEach((t) => wallets.add(t.creator));
    feesByRecipient.forEach((f) => wallets.add(f.recipient));

    // Build lookup maps
    const volumeMap = new Map(
      volumeByTrader.map((v) => [v.trader, Number(v._sum.solAmount || 0)])
    );
    const tokensMap = new Map(
      tokensByCreator.map((t) => [t.creator, t._count])
    );
    const feesMap = new Map(
      feesByRecipient.map((f) => [f.recipient, Number(f._sum.amount || 0)])
    );

    // Upsert all users with computed stats
    let updated = 0;
    for (const wallet of Array.from(wallets)) {
      if (wallet === 'PROTOCOL_TREASURY') continue; // Skip protocol treasury placeholder

      await db().user.upsert({
        where: { wallet },
        create: {
          wallet,
          totalVolume: volumeMap.get(wallet) || 0,
          tokensCreated: tokensMap.get(wallet) || 0,
          totalFees: feesMap.get(wallet) || 0,
        },
        update: {
          totalVolume: volumeMap.get(wallet) || 0,
          tokensCreated: tokensMap.get(wallet) || 0,
          totalFees: feesMap.get(wallet) || 0,
        },
      });
      updated++;
    }

    return NextResponse.json({
      success: true,
      usersUpdated: updated,
      uniqueTraders: volumeByTrader.length,
      uniqueCreators: tokensByCreator.length,
      uniqueFeeRecipients: feesByRecipient.length,
    });
  } catch (error) {
    console.error('[backfill-user-stats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to backfill user stats' },
      { status: 500 }
    );
  }
}
