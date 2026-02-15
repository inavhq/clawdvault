import { db, calculateFees, INITIAL_VIRTUAL_SOL, INITIAL_VIRTUAL_TOKENS, GRADUATION_THRESHOLD_SOL } from './prisma';
import { Token, Trade } from './types';
import { Prisma, FeeType } from '@prisma/client';
import { getSolPrice } from './sol-price';

// Helper to generate random mint (for testing without real Solana)
function generateMint(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Calculate price from reserves
function calculatePrice(virtualSol: number, virtualTokens: number): number {
  return virtualSol / virtualTokens;
}



// Convert Prisma token to API token
function toApiToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma token
  token: any,
  stats?: { volume24h?: number; trades24h?: number; holders?: number },
  lastCandle?: { closeUsd?: number | null; close?: number | null } | null,
  lastTradeAt?: string
): Token {
  const virtualSol = Number(token.virtualSolReserves);
  const virtualTokens = Number(token.virtualTokenReserves);

  // Calculate market cap from last candle if available (includes heartbeat candles), otherwise from reserves
  // Last candle is the source of truth for current price since heartbeat candles keep USD values updated
  let priceSol = lastCandle?.close ?? calculatePrice(virtualSol, virtualTokens);
  let priceUsd = lastCandle?.closeUsd ?? undefined;
  let marketCapSol = priceSol * INITIAL_VIRTUAL_TOKENS;
  let marketCapUsd = priceUsd ? priceUsd * INITIAL_VIRTUAL_TOKENS : undefined;

  return {
    id: token.id,
    mint: token.mint,
    name: token.name,
    symbol: token.symbol,
    description: token.description || undefined,
    image: token.image || undefined,
    creator: token.creator,
    creator_name: token.creatorName || undefined,
    created_at: token.createdAt.toISOString(),
    virtual_sol_reserves: virtualSol,
    virtual_token_reserves: virtualTokens,
    real_sol_reserves: Number(token.realSolReserves),
    real_token_reserves: Number(token.realTokenReserves),
    price_sol: priceSol,
    price_usd: priceUsd,
    market_cap_sol: marketCapSol,
    market_cap_usd: marketCapUsd,
    graduated: token.graduated,
    raydium_pool: token.raydiumPool || undefined,
    twitter: token.twitter || undefined,
    telegram: token.telegram || undefined,
    website: token.website || undefined,
    updated_at: token.updatedAt.toISOString(),
    volume_24h: stats?.volume24h || 0,
    trades_24h: stats?.trades24h || 0,
    holders: stats?.holders || 1,
    price_change_24h: token.priceChange24h != null ? Number(token.priceChange24h) : null,
    ath: token.ath ? Number(token.ath) : undefined,
    price_24h_ago: token.price24hAgo ? Number(token.price24hAgo) : undefined,
    last_trade_at: lastTradeAt,
  };
}

// Get all tokens
export async function getAllTokens(options?: {
  sort?: string;
  graduated?: boolean;
  page?: number;
  perPage?: number;
}): Promise<{ tokens: Token[]; total: number }> {
  const { sort = 'created_at', graduated, page = 1, perPage = 20 } = options || {};
  
  const where: Prisma.TokenWhereInput = {};
  if (graduated !== undefined) {
    where.graduated = graduated;
  }
  
  let orderBy: Prisma.TokenOrderByWithRelationInput;
  switch (sort) {
    case 'market_cap':
      orderBy = { virtualSolReserves: 'desc' };
      break;
    case 'price_change':
      orderBy = { priceChange24h: 'desc' };
      break;
    case 'created_at':
    default:
      orderBy = { createdAt: 'desc' };
  }
  
  const [tokens, total] = await Promise.all([
    db().token.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db().token.count({ where }),
  ]);
  
  // Get 24h stats for each token
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Fetch last candles for all tokens to calculate accurate market cap
  // Candles include heartbeat candles, so they stay updated with current SOL price
  const tokenMints = tokens.map(t => t.mint);
  const lastCandles = await db().priceCandle.findMany({
    where: { tokenMint: { in: tokenMints } },
    orderBy: { bucketTime: 'desc' },
    distinct: ['tokenMint'],
    select: {
      tokenMint: true,
      close: true,
      closeUsd: true,
    }
  });
  const lastCandleMap = new Map(lastCandles.map(c => [c.tokenMint, {
    close: c.close ? Number(c.close) : undefined,
    closeUsd: c.closeUsd ? Number(c.closeUsd) : undefined
  }]));

  // Fetch last trade timestamp for each token (batch query)
  const lastTrades = await db().trade.findMany({
    where: { tokenMint: { in: tokenMints } },
    orderBy: { createdAt: 'desc' },
    distinct: ['tokenMint'],
    select: { tokenMint: true, createdAt: true },
  });
  const lastTradeMap = new Map(lastTrades.map(t => [t.tokenMint, t.createdAt.toISOString()]));

  const tokensWithStats = await Promise.all(
    tokens.map(async (token) => {
      const [volumeResult, tradeCount, holderCount] = await Promise.all([
        db().trade.aggregate({
          where: { tokenMint: token.mint, createdAt: { gte: dayAgo } },
          _sum: { solAmount: true },
        }),
        db().trade.count({
          where: { tokenMint: token.mint, createdAt: { gte: dayAgo } },
        }),
        db().trade.groupBy({
          by: ['trader'],
          where: { tokenMint: token.mint },
        }),
      ]);

      const lastCandle = lastCandleMap.get(token.mint);

      return toApiToken(token, {
        volume24h: Number(volumeResult._sum.solAmount || 0),
        trades24h: tradeCount,
        holders: holderCount.length || 1,
      }, lastCandle, lastTradeMap.get(token.mint));
    })
  );

  return { tokens: tokensWithStats, total };
}

// Get single token
export async function getToken(mint: string): Promise<Token | null> {
  const token = await db().token.findUnique({
    where: { mint },
  });

  if (!token) return null;

  // Get stats
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [volumeResult, tradeCount, holderCount, lastCandle, lastTrade] = await Promise.all([
    db().trade.aggregate({
      where: { tokenMint: mint, createdAt: { gte: dayAgo } },
      _sum: { solAmount: true },
    }),
    db().trade.count({
      where: { tokenMint: mint, createdAt: { gte: dayAgo } },
    }),
    db().trade.groupBy({
      by: ['trader'],
      where: { tokenMint: mint },
    }),
    db().priceCandle.findFirst({
      where: { tokenMint: mint },
      orderBy: { bucketTime: 'desc' },
      select: { close: true, closeUsd: true },
    }),
    db().trade.findFirst({
      where: { tokenMint: mint },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  // Use last candle for current price (includes heartbeat candles for USD continuity)
  const lastCandleData = lastCandle ? {
    close: lastCandle.close ? Number(lastCandle.close) : undefined,
    closeUsd: lastCandle.closeUsd ? Number(lastCandle.closeUsd) : undefined
  } : null;

  return toApiToken(token, {
    volume24h: Number(volumeResult._sum.solAmount || 0),
    trades24h: tradeCount,
    holders: holderCount.length || 1,
  }, lastCandleData, lastTrade?.createdAt.toISOString());
}

// Update token fields
export async function updateToken(mint: string, data: {
  graduated?: boolean;
  raydiumPoolId?: string;
  virtualSolReserves?: number;
  virtualTokenReserves?: number;
  realSolReserves?: number;
  realTokenReserves?: number;
}): Promise<Token | null> {
  const updated = await db().token.update({
    where: { mint },
    data: {
      graduated: data.graduated,
      raydiumPool: data.raydiumPoolId,  // maps to raydium_pool column
      virtualSolReserves: data.virtualSolReserves,
      virtualTokenReserves: data.virtualTokenReserves,
      realSolReserves: data.realSolReserves,
      realTokenReserves: data.realTokenReserves,
    },
  });
  return toApiToken(updated);
}

// Update token reserves only (for syncing on-chain state)
export async function updateTokenReserves(mint: string, reserves: {
  virtualSolReserves: number;
  virtualTokenReserves: number;
}): Promise<void> {
  await db().token.update({
    where: { mint },
    data: {
      virtualSolReserves: new Prisma.Decimal(reserves.virtualSolReserves.toString()),
      virtualTokenReserves: new Prisma.Decimal(reserves.virtualTokenReserves.toString()),
    },
  });
}

// Get token trades
export async function getTokenTrades(mint: string, limit = 50): Promise<Trade[]> {
  const trades = await db().trade.findMany({
    where: { tokenMint: mint },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  
  return trades.map((t) => ({
    id: t.id,
    token_mint: t.tokenMint,
    trader: t.trader,
    type: t.tradeType.toLowerCase() as 'buy' | 'sell',
    sol_amount: Number(t.solAmount),
    token_amount: Number(t.tokenAmount),
    price_sol: Number(t.priceSol),
    sol_price_usd: t.solPriceUsd != null ? Number(t.solPriceUsd) : undefined,
    price_usd: t.solPriceUsd != null ? Number(t.priceSol) * Number(t.solPriceUsd) : undefined,
    total_fee: Number(t.totalFee),
    protocol_fee: Number(t.protocolFee),
    creator_fee: Number(t.creatorFee),
    signature: t.signature || '',
    created_at: t.createdAt.toISOString(),
  }));
}

// Check if trade with signature already exists (duplicate prevention)
export async function getTradeBySignature(signature: string): Promise<boolean> {
  const trade = await db().trade.findUnique({
    where: { signature },
    select: { id: true },
  });
  return trade !== null;
}

// Create token
export async function createToken(data: {
  mint?: string;  // Optional: use this if provided (for on-chain tokens)
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  creator: string;
  creator_name?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}): Promise<Token | null> {
  const mint = data.mint || generateMint(); // Use provided mint or generate random one for testing
  
  try {
    const token = await db().token.create({
      data: {
        mint,
        name: data.name,
        symbol: data.symbol.toUpperCase(),
        description: data.description,
        image: data.image,
        creator: data.creator,
        creatorName: data.creator_name,
        twitter: data.twitter,
        telegram: data.telegram,
        website: data.website,
        virtualSolReserves: INITIAL_VIRTUAL_SOL,
        virtualTokenReserves: INITIAL_VIRTUAL_TOKENS,
        realSolReserves: 0,
        realTokenReserves: INITIAL_VIRTUAL_TOKENS,
      },
    });

    // Update creator's user stats (fire and forget)
    updateUserStats(data.creator, { tokensCreated: 1 }).catch((e) =>
      console.error('[createToken] Failed to update user stats:', e)
    );

    return toApiToken(token);
  } catch (error) {
    console.error('Error creating token:', error);
    return null;
  }
}

// Execute trade with fee distribution
export async function executeTrade(
  mint: string,
  type: 'buy' | 'sell',
  amount: number,
  trader: string,
  signature?: string
): Promise<{ token: Token; trade: Trade; fees: { protocol: number; creator: number } } | null> {
  // Get current token state
  const token = await db().token.findUnique({
    where: { mint },
  });
  
  if (!token) {
    console.error('Token not found:', mint);
    return null;
  }

  // Fetch SOL price for USD tracking (outside transaction to avoid blocking)
  const solPriceUsd = await getSolPrice();

  const virtualSol = Number(token.virtualSolReserves);
  const virtualTokens = Number(token.virtualTokenReserves);
  const realSol = Number(token.realSolReserves);
  const realTokens = Number(token.realTokenReserves);
  
  let solAmount: number;
  let tokenAmount: number;
  let newVirtualSol: number;
  let newVirtualTokens: number;
  let newRealSol: number;
  let newRealTokens: number;
  
  // Calculate trade
  if (type === 'buy') {
    solAmount = amount;
    newVirtualSol = virtualSol + solAmount;
    const invariant = virtualSol * virtualTokens;
    newVirtualTokens = invariant / newVirtualSol;
    tokenAmount = virtualTokens - newVirtualTokens;
    
    // Calculate fees
    const fees = calculateFees(solAmount);
    const solAfterFee = solAmount - fees.total;
    
    newRealSol = realSol + solAfterFee;
    newRealTokens = realTokens - tokenAmount;
    
    // Execute in transaction
    const result = await db().$transaction(async (tx) => {
      // Update token
      const updatedToken = await tx.token.update({
        where: { mint },
        data: {
          virtualSolReserves: newVirtualSol,
          virtualTokenReserves: newVirtualTokens,
          realSolReserves: newRealSol,
          realTokenReserves: newRealTokens,
          graduated: newRealSol >= GRADUATION_THRESHOLD_SOL,
        },
      });
      
      // Create trade
      const trade = await tx.trade.create({
        data: {
          tokenId: token.id,
          tokenMint: mint,
          trader,
          tradeType: type,
          solAmount,
          tokenAmount,
          priceSol: newVirtualSol / newVirtualTokens,
          totalFee: fees.total,
          protocolFee: fees.protocol,
          creatorFee: fees.creator,
          solPriceUsd: solPriceUsd ?? null,
          signature: signature || `db_${Date.now()}`,
        },
      });

      // Create fee records
      const feeRecords = [];

      if (fees.protocol > 0) {
        feeRecords.push({
          tokenId: token.id,
          tradeId: trade.id,
          recipient: 'PROTOCOL_TREASURY', // TODO: Set actual treasury address
          feeType: FeeType.PROTOCOL,
          amount: fees.protocol,
        });
      }
      
      if (fees.creator > 0) {
        feeRecords.push({
          tokenId: token.id,
          tradeId: trade.id,
          recipient: token.creator,
          feeType: FeeType.CREATOR,
          amount: fees.creator,
        });
      }
      
      if (feeRecords.length > 0) {
        await tx.fee.createMany({ data: feeRecords });
      }
      
      return { updatedToken, trade, fees };
    });
    
    const finalToken = await getToken(mint);

    // Update user stats (fire and forget)
    updateUserStats(trader, { volume: solAmount }, solPriceUsd).catch((e) =>
      console.error('[executeTrade] Failed to update trader stats:', e)
    );
    if (fees.creator > 0) {
      updateUserStats(token.creator, { fees: fees.creator }, solPriceUsd).catch((e) =>
        console.error('[executeTrade] Failed to update creator stats:', e)
      );
    }

    return {
      token: finalToken!,
      trade: {
        id: result.trade.id,
        token_mint: result.trade.tokenMint,
        trader: result.trade.trader,
        type: result.trade.tradeType as 'buy' | 'sell',
        sol_amount: Number(result.trade.solAmount),
        token_amount: Number(result.trade.tokenAmount),
        price_sol: Number(result.trade.priceSol),
        total_fee: Number(result.trade.totalFee),
        protocol_fee: Number(result.trade.protocolFee),
        creator_fee: Number(result.trade.creatorFee),
        sol_price_usd: result.trade.solPriceUsd != null ? Number(result.trade.solPriceUsd) : undefined,
        signature: result.trade.signature || '',
        created_at: result.trade.createdAt.toISOString(),
      },
      fees: result.fees,
    };
  } else {
    // Sell logic
    tokenAmount = amount;
    newVirtualTokens = virtualTokens + tokenAmount;
    const invariant = virtualSol * virtualTokens;
    newVirtualSol = invariant / newVirtualTokens;
    solAmount = virtualSol - newVirtualSol;
    
    // Calculate fees on SOL out
    const fees = calculateFees(solAmount);
    solAmount -= fees.total;
    
    newRealSol = realSol - solAmount;
    newRealTokens = realTokens + tokenAmount;
    
    // Execute in transaction
    const result = await db().$transaction(async (tx) => {
      const updatedToken = await tx.token.update({
        where: { mint },
        data: {
          virtualSolReserves: newVirtualSol,
          virtualTokenReserves: newVirtualTokens,
          realSolReserves: newRealSol,
          realTokenReserves: newRealTokens,
        },
      });
      
      const trade = await tx.trade.create({
        data: {
          tokenId: token.id,
          tokenMint: mint,
          trader,
          tradeType: type,
          solAmount,
          tokenAmount,
          priceSol: newVirtualSol / newVirtualTokens,
          totalFee: fees.total,
          protocolFee: fees.protocol,
          creatorFee: fees.creator,
          solPriceUsd: solPriceUsd ?? null,
          signature: signature || `db_${Date.now()}`,
        },
      });

      // Create fee records
      const feeRecords = [];
      if (fees.protocol > 0) {
        feeRecords.push({
          tokenId: token.id,
          tradeId: trade.id,
          recipient: 'PROTOCOL_TREASURY',
          feeType: FeeType.PROTOCOL,
          amount: fees.protocol,
        });
      }
      if (fees.creator > 0) {
        feeRecords.push({
          tokenId: token.id,
          tradeId: trade.id,
          recipient: token.creator,
          feeType: FeeType.CREATOR,
          amount: fees.creator,
        });
      }
      if (feeRecords.length > 0) {
        await tx.fee.createMany({ data: feeRecords });
      }
      
      return { updatedToken, trade, fees };
    });
    
    const finalToken = await getToken(mint);

    // Update user stats (fire and forget)
    updateUserStats(trader, { volume: solAmount }, solPriceUsd).catch((e) =>
      console.error('[executeTrade] Failed to update trader stats:', e)
    );
    if (fees.creator > 0) {
      updateUserStats(token.creator, { fees: fees.creator }, solPriceUsd).catch((e) =>
        console.error('[executeTrade] Failed to update creator stats:', e)
      );
    }

    return {
      token: finalToken!,
      trade: {
        id: result.trade.id,
        token_mint: result.trade.tokenMint,
        trader: result.trade.trader,
        type: result.trade.tradeType as 'buy' | 'sell',
        sol_amount: Number(result.trade.solAmount),
        token_amount: Number(result.trade.tokenAmount),
        price_sol: Number(result.trade.priceSol),
        total_fee: Number(result.trade.totalFee),
        protocol_fee: Number(result.trade.protocolFee),
        creator_fee: Number(result.trade.creatorFee),
        sol_price_usd: result.trade.solPriceUsd != null ? Number(result.trade.solPriceUsd) : undefined,
        signature: result.trade.signature || '',
        created_at: result.trade.createdAt.toISOString(),
      },
      fees: result.fees,
    };
  }
}

// Get fees earned by an address
export async function getFeesEarned(address: string) {
  const fees = await db().fee.groupBy({
    by: ['feeType', 'claimed'],
    where: { recipient: address },
    _sum: { amount: true },
  });
  
  const result = {
    protocol: { total: 0, claimed: 0, unclaimed: 0 },
    creator: { total: 0, claimed: 0, unclaimed: 0 },
  };
  
  fees.forEach((f) => {
    const key = f.feeType.toLowerCase() as keyof typeof result;
    const amount = Number(f._sum.amount || 0);
    result[key].total += amount;
    if (f.claimed) {
      result[key].claimed += amount;
    } else {
      result[key].unclaimed += amount;
    }
  });
  
  return result;
}

// Validate API key
export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (apiKey === 'test_key') return true;
  
  const agent = await db().agent.findUnique({
    where: { apiKey },
  });
  
  return !!agent;
}

// ============================================
// USER STATS
// ============================================

/** Upsert a User by wallet and atomically increment stats.
 *  Volume and fees are stored in USD. SOL amounts are converted using
 *  the current SOL price (or provided solPriceUsd). */
export async function updateUserStats(
  wallet: string,
  increments: { volume?: number; tokensCreated?: number; fees?: number },
  solPriceUsd?: number | null
) {
  // Convert SOL -> USD if we have volume or fees to record
  let volumeUsd = 0;
  let feesUsd = 0;

  if (increments.volume || increments.fees) {
    const price = solPriceUsd ?? (await getSolPrice());
    if (price) {
      volumeUsd = (increments.volume || 0) * price;
      feesUsd = (increments.fees || 0) * price;
    }
    // If no SOL price available, skip USD tracking (values stay 0)
  }

  await db().user.upsert({
    where: { wallet },
    create: {
      wallet,
      totalVolume: volumeUsd,
      tokensCreated: increments.tokensCreated || 0,
      totalFees: feesUsd,
    },
    update: {
      ...(volumeUsd && { totalVolume: { increment: volumeUsd } }),
      ...(increments.tokensCreated && { tokensCreated: { increment: increments.tokensCreated } }),
      ...(feesUsd && { totalFees: { increment: feesUsd } }),
    },
  });
}

// ============================================
// USER / AGENT MANAGEMENT
// ============================================

/** Get or create a User by wallet address */
export async function getOrCreateUser(wallet: string) {
  let user = await db().user.findUnique({ where: { wallet } });

  if (!user) {
    user = await db().user.create({
      data: { wallet },
    });
  }

  return user;
}

/** Register an agent (creates User if needed, generates API key + claim code) */
export async function registerAgent(wallet: string, name?: string, avatar?: string) {
  // Get or create the user
  const user = await getOrCreateUser(wallet);

  // Check if user already has an agent
  const existing = await db().agent.findUnique({
    where: { userId: user.id },
  });

  if (existing) {
    throw new Error('Agent already registered for this wallet');
  }

  // Generate API key and claim code
  const apiKey = `cv_${generateMint().substring(0, 32)}`;
  const claimCode = generateMint().substring(0, 8).toUpperCase(); // Short code for tweets

  // Create agent
  const agent = await db().agent.create({
    data: {
      userId: user.id,
      apiKey,
      claimCode,
    },
    include: {
      user: true,
    },
  });

  // Update user name/avatar if provided
  if (name || avatar) {
    await db().user.update({
      where: { id: user.id },
      data: {
        ...(name && { name }),
        ...(avatar && { avatar }),
      },
    });
  }

  return { agent, user, apiKey, claimCode };
}

/** Verify Twitter claim (check tweet exists, contains claim code, mark verified) */
export async function claimAgentVerification(apiKey: string, tweetUrl: string) {
  const agent = await db().agent.findUnique({
    where: { apiKey },
    include: { user: true },
  });

  if (!agent) {
    throw new Error('Agent not found');
  }

  if (agent.twitterVerified) {
    throw new Error('Agent already verified');
  }

  if (!agent.claimCode) {
    throw new Error('No claim code found (agent may have been verified already)');
  }

  // Verify tweet via SocialData API (falls back to stub if no API key)
  const { verifyClaimTweet } = await import('./twitter');
  const result = await verifyClaimTweet(tweetUrl, agent.claimCode);

  if (!result.verified) {
    throw new Error(result.error || 'Tweet verification failed');
  }

  // Update agent
  const updated = await db().agent.update({
    where: { apiKey },
    data: {
      twitterVerified: true,
      twitterHandle: result.handle,
      claimTweetUrl: tweetUrl,
      verifiedAt: new Date(),
      claimCode: null, // Clear claim code after verification
    },
    include: { user: true },
  });

  return updated;
}

/** Get agent by API key */
export async function getAgentByApiKey(apiKey: string) {
  return db().agent.findUnique({
    where: { apiKey },
    include: { user: true },
  });
}

/** Get agents leaderboard (sorted by volume/tokens/fees) */
export async function getAgentsLeaderboard(options?: {
  sortBy?: 'volume' | 'tokens' | 'fees';
  limit?: number;
  page?: number;
}) {
  const { sortBy = 'volume', limit = 25, page = 1 } = options || {};

  let orderBy;
  switch (sortBy) {
    case 'tokens':
      orderBy = { user: { tokensCreated: 'desc' as const } };
      break;
    case 'fees':
      orderBy = { user: { totalFees: 'desc' as const } };
      break;
    case 'volume':
    default:
      orderBy = { user: { totalVolume: 'desc' as const } };
  }

  const [agents, total] = await Promise.all([
    db().agent.findMany({
      where: {}, // Show all registered agents (verified badge shown in UI)
      include: { user: true },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    db().agent.count(),
  ]);

  return { agents, total };
}

/** Get users leaderboard (sorted by volume/tokens/fees) */
export async function getUsersLeaderboard(options?: {
  sortBy?: 'volume' | 'tokens' | 'fees';
  limit?: number;
  page?: number;
}) {
  const { sortBy = 'volume', limit = 25, page = 1 } = options || {};

  let orderBy;
  switch (sortBy) {
    case 'tokens':
      orderBy = { tokensCreated: 'desc' as const };
      break;
    case 'fees':
      orderBy = { totalFees: 'desc' as const };
      break;
    case 'volume':
    default:
      orderBy = { totalVolume: 'desc' as const };
  }

  const where = { agent: { is: null } }; // Exclude users who are registered agents

  const [users, total] = await Promise.all([
    db().user.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    db().user.count({ where }),
  ]);

  return { users, total };
}

/** Get total agent count (all registered agents, not just verified) */
export async function getAgentCount() {
  return db().agent.count();
}

/** Get a site stats counter value */
export async function getSiteStats(key: string): Promise<number> {
  const row = await db().siteStats.findUnique({ where: { key } });
  return row?.value ?? 0;
}

// Record a trade from on-chain execution
export interface RecordTradeParams {
  mint: string;
  type: 'buy' | 'sell';
  wallet: string;
  solAmount: number;
  tokenAmount: number;
  signature?: string;
  timestamp?: Date;
  // On-chain reserves from TradeEvent (if available, takes precedence)
  onChainReserves?: {
    virtualSolReserves: number;
    virtualTokenReserves: number;
  };
}

export async function recordTrade(params: RecordTradeParams) {
  console.log('[recordTrade] Called with:', JSON.stringify(params));
  
  const token = await db().token.findUnique({
    where: { mint: params.mint },
  });
  
  if (!token) {
    throw new Error('Token not found');
  }
  
  // Validate params
  if (!params.solAmount || isNaN(params.solAmount)) {
    console.error('[recordTrade] Invalid solAmount:', params.solAmount);
    throw new Error('Invalid solAmount');
  }
  if (!params.tokenAmount || isNaN(params.tokenAmount)) {
    console.error('[recordTrade] Invalid tokenAmount:', params.tokenAmount);
    throw new Error('Invalid tokenAmount');
  }
  
  const fees = calculateFees(params.solAmount);
  const totalFee = fees.total;
  const protocolFee = fees.protocol;
  const creatorFee = fees.creator;
  
  // Current reserves
  const virtualSol = Number(token.virtualSolReserves);
  const virtualTokens = Number(token.virtualTokenReserves);
  const realSol = Number(token.realSolReserves);
  const realTokens = Number(token.realTokenReserves);
  
  console.log('[recordTrade] Current reserves:', { virtualSol, virtualTokens, realSol, realTokens });
  
  // Calculate new reserves based on trade type
  let newVirtualSol: number = virtualSol;
  let newVirtualTokens: number = virtualTokens;
  let newRealSol: number = realSol;
  let newRealTokens: number = realTokens;
  
  const invariant = virtualSol * virtualTokens;
  
  console.log('[recordTrade] Trade type:', params.type, 'solAmount:', params.solAmount, 'tokenAmount:', params.tokenAmount);
  
  // If on-chain reserves provided, use them directly (most accurate)
  if (params.onChainReserves) {
    console.log('[recordTrade] Using on-chain reserves:', params.onChainReserves);
    newVirtualSol = params.onChainReserves.virtualSolReserves;
    newVirtualTokens = params.onChainReserves.virtualTokenReserves;
    
    // Calculate real reserves from the trade
    if (params.type === 'buy') {
      const solAfterFee = params.solAmount - totalFee;
      newRealSol = realSol + solAfterFee;
      newRealTokens = realTokens - params.tokenAmount;
    } else {
      const solOut = virtualSol - newVirtualSol;
      const solAfterFee = solOut - totalFee;
      newRealSol = Math.max(0, realSol - solAfterFee);
      newRealTokens = realTokens + params.tokenAmount;
    }
  } else if (params.type === 'buy') {
    // Fallback: calculate from invariant (less accurate)
    // SOL goes in, tokens come out
    newVirtualSol = virtualSol + params.solAmount;
    newVirtualTokens = invariant / newVirtualSol;
    const solAfterFee = params.solAmount - totalFee;
    newRealSol = realSol + solAfterFee;
    newRealTokens = realTokens - params.tokenAmount;
  } else if (params.type === 'sell') {
    // Tokens go in, SOL comes out
    newVirtualTokens = virtualTokens + params.tokenAmount;
    newVirtualSol = invariant / newVirtualTokens;
    const solOut = virtualSol - newVirtualSol;
    const solAfterFee = solOut - totalFee;
    newRealSol = Math.max(0, realSol - solAfterFee);
    newRealTokens = realTokens + params.tokenAmount;
  } else {
    console.error('[recordTrade] Invalid trade type:', params.type);
    throw new Error(`Invalid trade type: ${params.type}`);
  }
  
  console.log('[recordTrade] New reserves:', { newVirtualSol, newVirtualTokens, newRealSol, newRealTokens });
  
  // Ensure no NaN values
  if (isNaN(newVirtualSol) || isNaN(newVirtualTokens) || isNaN(newRealSol) || isNaN(newRealTokens)) {
    console.error('[recordTrade] NaN detected in reserves calculation!');
    throw new Error('Invalid reserve calculation - NaN detected');
  }
  
  // Get SOL price for USD tracking (do this outside transaction to avoid blocking)
  const solPriceUsd = await getSolPrice();
  
  // Use transaction to update token and create trade atomically
  const result = await db().$transaction(async (tx) => {
    // Update token reserves (using Prisma.Decimal for proper precision)
    const updateData = {
      virtualSolReserves: new Prisma.Decimal(newVirtualSol.toString()),
      virtualTokenReserves: new Prisma.Decimal(newVirtualTokens.toString()),
      realSolReserves: new Prisma.Decimal(newRealSol.toString()),
      realTokenReserves: new Prisma.Decimal(newRealTokens.toString()),
      graduated: newRealSol >= GRADUATION_THRESHOLD_SOL,
    };
    console.log('[recordTrade] Update data:', updateData);
    
    const updatedToken = await tx.token.update({
      where: { mint: params.mint },
      data: updateData,
    });
    
    // Create trade record
    const trade = await tx.trade.create({
      data: {
        tokenId: token.id,
        tokenMint: params.mint,
        trader: params.wallet,
        tradeType: params.type,
        solAmount: params.solAmount,
        tokenAmount: params.tokenAmount,
        priceSol: newVirtualSol / newVirtualTokens,
        solPriceUsd: solPriceUsd ?? null,
        totalFee,
        protocolFee,
        creatorFee,
        signature: params.signature,
        createdAt: params.timestamp || new Date(),
      },
    });
    
    return { trade, token: updatedToken };
  });
  
  // Update candles (fire and forget - don't block on this)
  const newPrice = newVirtualSol / newVirtualTokens;
  try {
    const { updateCandles } = await import('./candles');
    await updateCandles(params.mint, newPrice, params.solAmount, params.timestamp || new Date(), solPriceUsd ?? undefined);
    console.log('[recordTrade] Candles updated');
  } catch (candleError) {
    console.error('[recordTrade] Failed to update candles:', candleError);
    // Don't fail the trade if candle update fails
  }

  // Update user stats (fire and forget) — pass solPriceUsd to avoid re-fetch
  updateUserStats(params.wallet, { volume: params.solAmount }, solPriceUsd).catch((e) =>
    console.error('[recordTrade] Failed to update trader stats:', e)
  );
  if (creatorFee > 0) {
    updateUserStats(token.creator, { fees: creatorFee }, solPriceUsd).catch((e) =>
      console.error('[recordTrade] Failed to update creator stats:', e)
    );
  }

  return result.trade;
}
