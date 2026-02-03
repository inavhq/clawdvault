import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/fix-candles
 * Fix candle data for a token by setting all candles to current price
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mint, price } = body;
    
    if (!mint || !price) {
      return NextResponse.json(
        { success: false, error: 'mint and price are required' },
        { status: 400 }
      );
    }

    const priceDecimal = new Prisma.Decimal(price.toString());
    
    // Update all candles for this token
    const result = await db().priceCandle.updateMany({
      where: { tokenMint: mint },
      data: {
        open: priceDecimal,
        high: priceDecimal,
        low: priceDecimal,
        close: priceDecimal,
      },
    });
    
    console.log(`📊 Fixed ${result.count} candles for ${mint} to price ${price}`);
    
    return NextResponse.json({
      success: true,
      mint,
      price,
      candlesUpdated: result.count,
    });
    
  } catch (error) {
    console.error('Fix candles error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
