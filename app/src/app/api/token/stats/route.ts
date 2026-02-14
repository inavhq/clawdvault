import { NextRequest, NextResponse } from 'next/server';
import { getAthPrice } from '@/lib/candles';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mint = searchParams.get('mint');

    if (!mint) {
      return NextResponse.json({ error: 'mint parameter required' }, { status: 400 });
    }

    const athPrice = await getAthPrice(mint);

    return NextResponse.json({
      mint,
      athPrice,
    });
  } catch (error) {
    console.error('Failed to fetch token stats:', error);
    return NextResponse.json({ error: 'Failed to fetch token stats' }, { status: 500 });
  }
}
