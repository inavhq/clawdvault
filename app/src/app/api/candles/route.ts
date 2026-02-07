import { NextRequest, NextResponse } from 'next/server';
import { getCandles, getUsdCandles } from '@/lib/candles';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mint = searchParams.get('mint');
    const interval = searchParams.get('interval') || '5m';
    const limit = parseInt(searchParams.get('limit') || '100');
    const currency = searchParams.get('currency') || 'sol'; // 'sol' or 'usd'
    
    if (!mint) {
      return NextResponse.json({ error: 'mint parameter required' }, { status: 400 });
    }
    
    // Validate interval
    const validIntervals = ['1m', '5m', '15m', '1h', '1d'];
    if (!validIntervals.includes(interval)) {
      return NextResponse.json({ 
        error: `Invalid interval. Must be one of: ${validIntervals.join(', ')}` 
      }, { status: 400 });
    }
    
    // Fetch candles in requested currency
    const candles = currency === 'usd' 
      ? await getUsdCandles(
          mint, 
          interval as '1m' | '5m' | '15m' | '1h' | '1d',
          Math.min(limit, 1000)
        )
      : await getCandles(
          mint, 
          interval as '1m' | '5m' | '15m' | '1h' | '1d',
          Math.min(limit, 1000)
        );
    
    return NextResponse.json({
      mint,
      interval,
      currency,
      candles,
    });
  } catch (error) {
    console.error('Failed to fetch candles:', error);
    return NextResponse.json({ error: 'Failed to fetch candles' }, { status: 500 });
  }
}
