import { NextRequest, NextResponse } from 'next/server';

// GET /api/balance?wallet=xxx&mint=yyy - Get token balance for wallet
export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');
    const mint = request.nextUrl.searchParams.get('mint');

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Missing wallet parameter' },
        { status: 400 }
      );
    }

    // In production, query Solana RPC for token accounts
    // For now, return mock data or 0
    // TODO: Implement real SPL token balance lookup
    
    // Mock: Return 0 for now (user has no tokens until they buy)
    return NextResponse.json({
      success: true,
      wallet,
      mint: mint || null,
      tokenBalance: 0,
      // In production, would return actual balance from:
      // 1. RPC getTokenAccountsByOwner
      // 2. Or track balances in our DB from trade events
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
