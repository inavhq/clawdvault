import { db } from './prisma';
import { Decimal } from '@prisma/client/runtime/library';

type CandleInterval = '1m' | '5m' | '15m' | '1h' | '1d';

const INTERVAL_MS: Record<CandleInterval, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

// Get bucket start time for a given timestamp and interval
function getBucketTime(timestamp: Date, interval: CandleInterval): Date {
  const ms = INTERVAL_MS[interval];
  const bucketMs = Math.floor(timestamp.getTime() / ms) * ms;
  return new Date(bucketMs);
}

// Update candles for a trade (call this after each trade)
export async function updateCandles(
  tokenMint: string,
  price: number | Decimal,
  solVolume: number | Decimal,
  timestamp: Date = new Date()
): Promise<void> {
  const priceDecimal = new Decimal(price.toString());
  const volumeDecimal = new Decimal(solVolume.toString());
  
  const intervals: CandleInterval[] = ['1m', '5m', '15m', '1h', '1d'];
  
  // Upsert candle for each interval
  await Promise.all(intervals.map(async (interval) => {
    const bucketTime = getBucketTime(timestamp, interval);
    
    // Try to find existing candle
    const existing = await db().priceCandle.findUnique({
      where: {
        tokenMint_interval_bucketTime: {
          tokenMint,
          interval,
          bucketTime,
        },
      },
    });
    
    if (existing) {
      // Update existing candle
      await db().priceCandle.update({
        where: {
          tokenMint_interval_bucketTime: {
            tokenMint,
            interval,
            bucketTime,
          },
        },
        data: {
          high: priceDecimal.gt(existing.high) ? priceDecimal : existing.high,
          low: priceDecimal.lt(existing.low) ? priceDecimal : existing.low,
          close: priceDecimal,
          volume: existing.volume.add(volumeDecimal),
          trades: { increment: 1 },
        },
      });
    } else {
      // Create new candle
      await db().priceCandle.create({
        data: {
          tokenMint,
          interval,
          bucketTime,
          open: priceDecimal,
          high: priceDecimal,
          low: priceDecimal,
          close: priceDecimal,
          volume: volumeDecimal,
          trades: 1,
        },
      });
    }
  }));
}

// Fetch candles for charting
export async function getCandles(
  tokenMint: string,
  interval: CandleInterval = '5m',
  limit: number = 100
): Promise<{
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}[]> {
  const candles = await db().priceCandle.findMany({
    where: {
      tokenMint,
      interval,
    },
    orderBy: { bucketTime: 'asc' },
    take: limit,
  });
  
  return candles.map((c) => ({
    time: Math.floor(c.bucketTime.getTime() / 1000), // Unix timestamp for Lightweight Charts
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: Number(c.volume),
  }));
}
