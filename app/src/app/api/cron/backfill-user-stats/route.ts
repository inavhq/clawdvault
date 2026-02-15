import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/backfill-user-stats
 *
 * One-time backfill to compute User stats from existing trades and tokens.
 * Volume and fees are stored in USD using the SOL price at each trade time.
 * Safe to run multiple times — it recalculates from scratch each time.
 */
export async function GET() {
  try {
    // 1. Compute USD volume per trader from all trades
    //    Each trade has solAmount (SOL) and solPriceUsd at trade time
    const trades = await db().trade.findMany({
      select: { trader: true, solAmount: true, solPriceUsd: true, creatorFee: true, tokenMint: true },
    });

    const volumeMap = new Map<string, number>();
    for (const t of trades) {
      const solPrice = t.solPriceUsd ? Number(t.solPriceUsd) : 0;
      const usdVolume = Number(t.solAmount) * solPrice;
      volumeMap.set(t.trader, (volumeMap.get(t.trader) || 0) + usdVolume);
    }

    // 2. Count tokens created per creator
    const tokensByCreator = await db().token.groupBy({
      by: ['creator'],
      _count: true,
    });
    const tokensMap = new Map(
      tokensByCreator.map((t) => [t.creator, t._count])
    );

    // 3. Compute USD creator fees per recipient
    //    Fee amount is in SOL, use the trade's solPriceUsd for conversion
    const fees = await db().fee.findMany({
      where: { feeType: 'CREATOR' },
      select: { recipient: true, amount: true, trade: { select: { solPriceUsd: true } } },
    });

    const feesMap = new Map<string, number>();
    for (const f of fees) {
      const solPrice = f.trade.solPriceUsd ? Number(f.trade.solPriceUsd) : 0;
      const usdFee = Number(f.amount) * solPrice;
      feesMap.set(f.recipient, (feesMap.get(f.recipient) || 0) + usdFee);
    }

    // Collect all unique wallets
    const wallets = new Set<string>();
    Array.from(volumeMap.keys()).forEach((w) => wallets.add(w));
    Array.from(tokensMap.keys()).forEach((w) => wallets.add(w));
    Array.from(feesMap.keys()).forEach((w) => wallets.add(w));

    // Upsert all users with computed stats
    let updated = 0;
    for (const wallet of Array.from(wallets)) {
      if (wallet === 'PROTOCOL_TREASURY') continue;

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
      uniqueTraders: volumeMap.size,
      uniqueCreators: tokensByCreator.length,
      uniqueFeeRecipients: feesMap.size,
    });
  } catch (error) {
    console.error('[backfill-user-stats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to backfill user stats' },
      { status: 500 }
    );
  }
}
