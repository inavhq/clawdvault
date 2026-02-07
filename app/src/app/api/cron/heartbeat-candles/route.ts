import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { getSolPrice } from '@/lib/sol-price';

export const dynamic = 'force-dynamic';

/**
 * Generate and update heartbeat candles for tokens with no recent trades
 * This ensures USD charts reflect current SOL price even without trading activity
 * 
 * For each token:
 * 1. Creates new candles for current bucket if none exist
 * 2. Updates existing candles' high/low based on SOL price movement
 * 3. For higher timeframes (5m+), aggregates from 1m candles for accurate wicks
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current SOL price
    const solPriceUsd = await getSolPrice();
    if (!solPriceUsd) {
      throw new Error('Failed to fetch SOL price');
    }

    const now = new Date();
    const results: { token: string; created: string[]; updated: string[] }[] = [];

    // Find all active (non-graduated) tokens
    const tokens = await db().token.findMany({
      where: { graduated: false },
      select: { mint: true, name: true, symbol: true }
    });

    for (const token of tokens) {
      const created: string[] = [];
      const updated: string[] = [];

      // Get last trade for this token
      const lastTrade = await db().trade.findFirst({
        where: { tokenMint: token.mint },
        orderBy: { createdAt: 'desc' },
        select: {
          priceSol: true,
          solPriceUsd: true,
          createdAt: true
        }
      });

      if (!lastTrade) continue; // No trades yet, skip

      const lastTradePriceSol = Number(lastTrade.priceSol);
      const currentPriceUsd = lastTradePriceSol * solPriceUsd;

      // Define intervals to check
      const intervals = [
        { name: '1m', durationMs: 60 * 1000 },
        { name: '5m', durationMs: 5 * 60 * 1000 },
        { name: '15m', durationMs: 15 * 60 * 1000 },
        { name: '1h', durationMs: 60 * 60 * 1000 },
        { name: '1d', durationMs: 24 * 60 * 60 * 1000 },
      ];

      for (const interval of intervals) {
        // Check if we need a new candle for this interval
        const bucketTime = getBucketTime(now, interval.name);

        // Check if candle already exists for this bucket
        const existingCandle = await db().priceCandle.findUnique({
          where: {
            tokenMint_interval_bucketTime: {
              tokenMint: token.mint,
              interval: interval.name,
              bucketTime
            }
          }
        });

        if (!existingCandle) {
          // Create new heartbeat candle
          await createHeartbeatCandle(token.mint, interval.name, bucketTime, lastTradePriceSol, currentPriceUsd, solPriceUsd);
          created.push(interval.name);
        } else {
          // Update existing candle with new high/low based on SOL price movement
          const wasUpdated = await updateCandleWicks(token.mint, interval.name, bucketTime, lastTradePriceSol, currentPriceUsd, solPriceUsd);
          if (wasUpdated) {
            updated.push(interval.name);
          }
        }
      }

      if (created.length > 0 || updated.length > 0) {
        results.push({
          token: `${token.symbol} (${token.mint.slice(0, 8)}...)`,
          created,
          updated
        });
      }
    }

    return NextResponse.json({
      success: true,
      solPriceUsd,
      tokensUpdated: results.length,
      details: results
    });

  } catch (error) {
    console.error('Heartbeat candle generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate heartbeat candles' },
      { status: 500 }
    );
  }
}

async function createHeartbeatCandle(
  tokenMint: string,
  interval: string,
  bucketTime: Date,
  lastTradePriceSol: number,
  currentPriceUsd: number,
  solPriceUsd: number
) {
  // Get previous candle for this interval to determine open
  const prevCandle = await db().priceCandle.findFirst({
    where: {
      tokenMint,
      interval,
    },
    orderBy: { bucketTime: 'desc' },
    select: { closeUsd: true, close: true, solPriceUsd: true }
  });

  const prevPriceSol = prevCandle?.close ? Number(prevCandle.close) : lastTradePriceSol;
  const prevPriceUsd = prevCandle?.closeUsd ? Number(prevCandle.closeUsd) : currentPriceUsd;
  const prevSolPrice = prevCandle?.solPriceUsd ? Number(prevCandle.solPriceUsd) : solPriceUsd;

  // Calculate wicks based on SOL price movement
  const solPriceChange = solPriceUsd / prevSolPrice;
  
  // For USD price: high/low reflect the movement from prev price to current price
  const highUsd = Math.max(prevPriceUsd, currentPriceUsd, prevPriceUsd * solPriceChange);
  const lowUsd = Math.min(prevPriceUsd, currentPriceUsd, prevPriceUsd / solPriceChange);

  await db().priceCandle.create({
    data: {
      tokenMint,
      interval,
      bucketTime,
      open: prevPriceSol,
      high: lastTradePriceSol,
      low: lastTradePriceSol,
      close: lastTradePriceSol,
      volume: 0,
      openUsd: prevPriceUsd,
      highUsd,
      lowUsd,
      closeUsd: currentPriceUsd,
      volumeUsd: 0,
      solPriceUsd,
      trades: 0,
    }
  });
}

async function updateCandleWicks(
  tokenMint: string,
  interval: string,
  bucketTime: Date,
  lastTradePriceSol: number,
  currentPriceUsd: number,
  solPriceUsd: number
): Promise<boolean> {
  // For 1m candles: update based on SOL price movement
  if (interval === '1m') {
    const candle = await db().priceCandle.findUnique({
      where: {
        tokenMint_interval_bucketTime: { tokenMint, interval, bucketTime }
      }
    });

    if (!candle) return false;

    const candleSolPrice = Number(candle.solPriceUsd);
    const solPriceChange = solPriceUsd / candleSolPrice;

    // Calculate potential new wicks based on SOL movement
    const openUsd = Number(candle.openUsd);
    const newHighUsd = Math.max(Number(candle.highUsd), currentPriceUsd, openUsd * solPriceChange);
    const newLowUsd = Math.min(Number(candle.lowUsd), currentPriceUsd, openUsd / solPriceChange);

    // Only update if wicks changed
    if (newHighUsd !== Number(candle.highUsd) || newLowUsd !== Number(candle.lowUsd)) {
      await db().priceCandle.update({
        where: { tokenMint_interval_bucketTime: { tokenMint, interval, bucketTime } },
        data: {
          highUsd: newHighUsd,
          lowUsd: newLowUsd,
          solPriceUsd,
          closeUsd: currentPriceUsd,
          close: lastTradePriceSol,
        }
      });
      return true;
    }
    return false;
  }

  // For higher timeframes (5m, 15m, 1h, 1d): aggregate from 1m candles
  const startTime = bucketTime;
  const endTime = new Date(bucketTime.getTime() + getIntervalMs(interval));

  const oneMinCandles = await db().priceCandle.findMany({
    where: {
      tokenMint,
      interval: '1m',
      bucketTime: {
        gte: startTime,
        lt: endTime
      }
    },
    orderBy: { bucketTime: 'asc' }
  });

  if (oneMinCandles.length === 0) return false;

  // Calculate high/low from 1m candles
  let highUsd = Number(oneMinCandles[0].highUsd);
  let lowUsd = Number(oneMinCandles[0].lowUsd);

  for (const minCandle of oneMinCandles) {
    highUsd = Math.max(highUsd, Number(minCandle.highUsd));
    lowUsd = Math.min(lowUsd, Number(minCandle.lowUsd));
  }

  const candle = await db().priceCandle.findUnique({
    where: {
      tokenMint_interval_bucketTime: { tokenMint, interval, bucketTime }
    }
  });

  if (!candle) return false;

  // Only update if wicks changed
  if (highUsd !== Number(candle.highUsd) || lowUsd !== Number(candle.lowUsd)) {
    await db().priceCandle.update({
      where: { tokenMint_interval_bucketTime: { tokenMint, interval, bucketTime } },
      data: {
        highUsd,
        lowUsd,
        closeUsd: currentPriceUsd,
        close: lastTradePriceSol,
      }
    });
    return true;
  }
  return false;
}

function getBucketTime(date: Date, interval: string): Date {
  const d = new Date(date);

  switch (interval) {
    case '1m':
      d.setSeconds(0, 0);
      break;
    case '5m':
      d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
      break;
    case '15m':
      d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0);
      break;
    case '1h':
      d.setMinutes(0, 0, 0);
      break;
    case '1d':
      d.setHours(0, 0, 0, 0);
      break;
  }

  return d;
}

function getIntervalMs(interval: string): number {
  switch (interval) {
    case '1m': return 60 * 1000;
    case '5m': return 5 * 60 * 1000;
    case '15m': return 15 * 60 * 1000;
    case '1h': return 60 * 60 * 1000;
    case '1d': return 24 * 60 * 60 * 1000;
    default: return 60 * 1000;
  }
}