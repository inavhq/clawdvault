import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { getSiteStats } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/site-stats
 *
 * Returns homepage stats: tokens, graduated, 24h volume, agents, users, page views.
 * All stats fetched in parallel for minimal latency.
 */
export async function GET() {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalTokens,
      graduatedCount,
      agentCount,
      userCount,
      pageViews,
      volumeResult,
    ] = await Promise.all([
      db().token.count(),
      db().token.count({ where: { graduated: true } }),
      db().agent.count(),
      db().user.count({ where: { agent: { is: null } } }),
      getSiteStats('page_views'),
      db().trade.aggregate({
        where: { createdAt: { gte: oneDayAgo } },
        _sum: { solAmount: true },
      }),
    ]);

    return NextResponse.json({
      totalTokens,
      graduatedCount,
      agentCount,
      userCount,
      pageViews,
      totalVolume: Number(volumeResult._sum.solAmount || 0),
    });
  } catch (error) {
    console.error('Site stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch site stats' },
      { status: 500 }
    );
  }
}
