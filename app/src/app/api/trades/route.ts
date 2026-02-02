import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/trades?mint=xxx - Get trade history for a token
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mint = searchParams.get('mint');
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // cursor for pagination

    if (!mint) {
      return NextResponse.json(
        { success: false, error: 'Missing mint parameter' },
        { status: 400 }
      );
    }

    // Fetch trades from database
    const trades = await db().trade.findMany({
      where: {
        tokenMint: mint,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get unique trader wallets to fetch profiles
    const traderWallets = Array.from(new Set(trades.map(t => t.trader)));
    
    // Fetch all profiles in one query
    const profiles = await db().userProfile.findMany({
      where: { wallet: { in: traderWallets } },
    });
    
    // Create wallet -> profile map
    const profileMap = new Map(profiles.map(p => [p.wallet, p]));

    // Enrich trades with profile data
    const enrichedTrades = trades.map(trade => ({
      id: trade.id,
      type: trade.tradeType.toLowerCase(),
      trader: trade.trader,
      username: profileMap.get(trade.trader)?.username || null,
      solAmount: Number(trade.solAmount),
      tokenAmount: Number(trade.tokenAmount),
      pricePerToken: Number(trade.priceSol),
      signature: trade.signature,
      executedAt: trade.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      trades: enrichedTrades,
      hasMore: trades.length === limit,
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}
