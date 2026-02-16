/**
 * Cron: Update SOL Price, Candles, ATH, and 24h Reference Price
 * Runs every minute to:
 * 1. Fetch and store current SOL/USD price
 * 2. Create/update heartbeat candles for all tokens (even without trades)
 * 3. Update ATH if current price exceeds stored ATH
 * 4. Store 24h-ago reference price for realtime % change calculation
 *
 * Vercel Cron calls this with CRON_SECRET header
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface PriceSource {
  name: 'coingecko' | 'binance';
  price: number;
}

/**
 * Wrapper to ensure fetch never throws - returns null on any error
 */
async function fetchWithFallback<T>(
  fetchFn: () => Promise<T | null>,
  sourceName: string
): Promise<T | null> {
  try {
    return await fetchFn();
  } catch (err) {
    console.warn(`[SOL Price Cron] ${sourceName} failed:`, (err as Error).message);
    return null;
  }
}

async function fetchFromCoinGecko(): Promise<number | null> {
  return fetchWithFallback(async () => {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) return null;

    const data = await res.json();
    const price = data.solana?.usd;

    if (typeof price === 'number' && price > 0) return price;
    return null;
  }, 'CoinGecko');
}

async function fetchFromBinance(): Promise<number | null> {
  return fetchWithFallback(async () => {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT', {
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) return null;

    const data = await res.json();
    const price = parseFloat(data.price);

    if (!isNaN(price) && price > 0) return price;
    return null;
  }, 'Binance');
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('💰 [CRON] Starting SOL price + candles update...');

  const startTime = Date.now();

  // Step 1: Fetch SOL price
  const results: PriceSource[] = [];

  const [coinGeckoPrice, binancePrice] = await Promise.all([
    fetchFromCoinGecko(),
    fetchFromBinance(),
  ]);

  if (coinGeckoPrice) results.push({ name: 'coingecko', price: coinGeckoPrice });
  if (binancePrice) results.push({ name: 'binance', price: binancePrice });

  if (results.length === 0) {
    console.error('❌ [CRON] All price sources failed');
    return NextResponse.json(
      { success: false, error: 'All price sources failed' },
      { status: 500 }
    );
  }

  // Calculate median price
  const prices = results.map(r => r.price).sort((a, b) => a - b);
  const solPriceUsd = prices.length % 2 === 0
    ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
    : prices[Math.floor(prices.length / 2)];

  const primarySource = results[0].name;

  // Step 2: Update SOL price in database
  await db().solPrice.upsert({
    where: { id: 'current' },
    create: { id: 'current', price: solPriceUsd, source: primarySource },
    update: { price: solPriceUsd, source: primarySource },
  });

  // Step 3: Update candles, ATH, and 24h reference price for all tokens
  const tokensUpdated = await updateAllTokens(solPriceUsd);

  const duration = Date.now() - startTime;

  console.log(`✅ [CRON] SOL: $${solPriceUsd.toFixed(2)}, Tokens: ${tokensUpdated}, Time: ${duration}ms`);

  return NextResponse.json({
    success: true,
    solPrice: solPriceUsd,
    source: primarySource,
    tokensUpdated,
    duration: `${duration}ms`,
  });
}

/**
 * Update candles, ATH, and 24h reference price for all active tokens.
 * Price fallback chain: last trade → last candle → bonding curve reserves
 */
async function updateAllTokens(solPriceUsd: number): Promise<number> {
  const prisma = db();
  let totalUpdates = 0;

  const tokens = await prisma.token.findMany({
    where: { graduated: false },
    select: { mint: true, ath: true, virtualSolReserves: true, virtualTokenReserves: true }
  });

  const now = new Date();

  for (const token of tokens) {
    // Get current SOL price per token: last trade > last candle > bonding curve reserves
    const lastTrade = await prisma.trade.findFirst({
      where: { tokenMint: token.mint },
      orderBy: { createdAt: 'desc' },
      select: { priceSol: true }
    });

    let priceSol: number;
    if (lastTrade) {
      priceSol = Number(lastTrade.priceSol);
    } else {
      const lastCandle = await prisma.priceCandle.findFirst({
        where: { tokenMint: token.mint },
        orderBy: { bucketTime: 'desc' },
        select: { close: true }
      });
      priceSol = lastCandle?.close
        ? Number(lastCandle.close)
        : Number(token.virtualSolReserves) / Number(token.virtualTokenReserves);
    }

    const priceUsd = priceSol * solPriceUsd;

    // Update ATH if current price is higher
    const currentAth = token.ath ? Number(token.ath) : 0;
    if (priceUsd > currentAth) {
      await prisma.token.update({
        where: { mint: token.mint },
        data: { ath: priceUsd }
      });
    }

    // Store 24h-ago reference price (frontend calculates % change in realtime)
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const candle24hAgo = await prisma.priceCandle.findFirst({
      where: {
        tokenMint: token.mint,
        interval: '1m',
        bucketTime: { lte: dayAgo }
      },
      orderBy: { bucketTime: 'desc' },
      select: { closeUsd: true }
    });

    if (candle24hAgo?.closeUsd) {
      const ref = Number(candle24hAgo.closeUsd);
      const change = ref > 0 ? ((priceUsd - ref) / ref) * 100 : null;
      await prisma.token.update({
        where: { mint: token.mint },
        data: {
          price24hAgo: ref,
          priceChange24h: change,
        }
      });
    }

    // Create/update candles across all timeframes
    const oneMinBucket = getBucketTime(now, '1m');
    const updated = await createOrUpdateCandle(
      token.mint, '1m', oneMinBucket,
      priceSol, priceUsd, solPriceUsd
    );
    if (updated) totalUpdates++;

    const higherTimeframes = [
      { name: '5m', bucket: getBucketTime(now, '5m') },
      { name: '15m', bucket: getBucketTime(now, '15m') },
      { name: '1h', bucket: getBucketTime(now, '1h') },
      { name: '1d', bucket: getBucketTime(now, '1d') },
    ];

    for (const tf of higherTimeframes) {
      if (isCandleInBucket(oneMinBucket, tf.bucket, tf.name)) {
        const tfUpdated = await createOrUpdateCandle(
          token.mint, tf.name, tf.bucket,
          priceSol, priceUsd, solPriceUsd
        );
        if (tfUpdated) totalUpdates++;
      }
    }
  }

  return totalUpdates;
}

async function createOrUpdateCandle(
  tokenMint: string,
  interval: string,
  bucketTime: Date,
  priceSol: number,
  priceUsd: number,
  solPriceUsd: number
): Promise<boolean> {
  const prisma = db();

  const existing = await prisma.priceCandle.findUnique({
    where: {
      tokenMint_interval_bucketTime: { tokenMint, interval, bucketTime }
    }
  });

  if (!existing) {
    // Get previous candle for open price
    const prevCandle = await prisma.priceCandle.findFirst({
      where: { tokenMint, interval },
      orderBy: { bucketTime: 'desc' },
      select: { closeUsd: true, close: true }
    });

    const prevPriceSol = prevCandle?.close ? Number(prevCandle.close) : priceSol;
    const prevPriceUsd = prevCandle?.closeUsd ? Number(prevCandle.closeUsd) : priceUsd;

    await prisma.priceCandle.create({
      data: {
        tokenMint,
        interval,
        bucketTime,
        open: prevPriceSol,
        high: priceSol,
        low: priceSol,
        close: priceSol,
        volume: 0,
        openUsd: prevPriceUsd,
        highUsd: priceUsd,
        lowUsd: priceUsd,
        closeUsd: priceUsd,
        volumeUsd: 0,
        solPriceUsd,
        trades: 0,
      }
    });
    return true;
  }

  // Update existing candle
  const newHighUsd = Math.max(Number(existing.highUsd), priceUsd);
  const newLowUsd = Math.min(Number(existing.lowUsd), priceUsd);

  if (newHighUsd !== Number(existing.highUsd) ||
      newLowUsd !== Number(existing.lowUsd) ||
      priceUsd !== Number(existing.closeUsd)) {

    await prisma.priceCandle.update({
      where: { tokenMint_interval_bucketTime: { tokenMint, interval, bucketTime } },
      data: {
        high: priceSol,
        low: priceSol,
        close: priceSol,
        highUsd: newHighUsd,
        lowUsd: newLowUsd,
        closeUsd: priceUsd,
        solPriceUsd,
      }
    });
    return true;
  }

  return false;
}

function getBucketTime(date: Date, interval: string): Date {
  const d = new Date(date);

  switch (interval) {
    case '1m': d.setSeconds(0, 0); break;
    case '5m': d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0); break;
    case '15m': d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0); break;
    case '1h': d.setMinutes(0, 0, 0); break;
    case '1d': d.setHours(0, 0, 0, 0); break;
  }

  return d;
}

function isCandleInBucket(
  oneMinBucket: Date,
  higherBucket: Date,
  higherInterval: string
): boolean {
  const oneMinTime = oneMinBucket.getTime();
  const bucketStart = higherBucket.getTime();

  const durations: Record<string, number> = {
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };

  const bucketEnd = bucketStart + (durations[higherInterval] || 0);
  return oneMinTime >= bucketStart && oneMinTime < bucketEnd;
}
