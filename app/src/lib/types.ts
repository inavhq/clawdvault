// ClawdVault Types — derived from Prisma schema
//
// DB model types are converted from Prisma via PrismaToApi (camelCase→snake_case + Decimal→number + Date→string).
// Computed fields (not in DB) are added via intersection types.
// Request/response types remain manual since they're API contracts, not DB models.

import type {
  Token   as PrismaToken,
  Trade   as PrismaTrade,
  Agent   as PrismaAgent,
} from '@prisma/client';
import type { PrismaToApi } from './type-utils';

// ============================================
// DB model types (derived from Prisma)
// ============================================

/** Fields the API adds on top of the Token DB row */
type TokenComputed = {
  price_sol: number;
  price_usd?: number;
  market_cap_sol: number;
  market_cap_usd?: number;
  volume_24h?: number;
  trades_24h?: number;
  holders?: number;
  price_change_24h?: number | null;  // Computed from price_24h_ago + current price (%)
  ath?: number;  // All-time high price (USD)
  price_24h_ago?: number;  // USD price 24h ago (for realtime % change calculation)
  last_trade_at?: string;
};

/**
 * API Token — DB columns (snake_cased, Decimals→numbers) + computed fields.
 * If a column is added to the Prisma Token model, it auto-appears here.
 */
export type Token = PrismaToApi<PrismaToken> & TokenComputed;

/** 
 * API Trade — the Prisma trade_type field is renamed to `type` for the API.
 * We omit trade_type and token_id (internal FK) and add `type` + optional computed fields.
 */
export type Trade = Omit<PrismaToApi<PrismaTrade>, 'trade_type' | 'token_id'> & {
  type: 'buy' | 'sell';
  price_usd?: number;
};

/**
 * API Agent — straight conversion from Prisma.
 */
export type Agent = PrismaToApi<PrismaAgent>;

// ============================================
// On-chain stats from /api/stats
// ============================================
export interface OnChainStats {
  totalSupply: number;
  bondingCurveBalance: number;
  circulatingSupply: number;
  bondingCurveSol: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  price: number;
  priceUsd?: number | null;
  marketCap: number;
  marketCapUsd?: number | null;
  solPriceUsd?: number | null;
  graduated?: boolean;
}

// ============================================
// Request/Response Types (manual — API contracts)
// ============================================

export interface CreateTokenRequest {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  initialBuy?: number;
  creator?: string;
  creatorName?: string;
}

export interface CreateTokenResponse {
  success: boolean;
  token?: Token;
  mint?: string;
  signature?: string;
  error?: string;
  onChain?: boolean;
}

export interface TradeRequest {
  mint: string;
  type: 'buy' | 'sell';
  amount: number;
  slippage?: number;
}

export interface TradeResponse {
  success: boolean;
  trade?: Trade;
  signature?: string;
  tokens_received?: number;
  sol_received?: number;
  new_price?: number;
  newPrice?: number;
  fees?: {
    total: number;
    protocol: number;
    creator: number;
  };
  error?: string;
  message?: string;
  graduated?: boolean;
}

export interface TokenListResponse {
  tokens: Token[];
  total: number;
  page: number;
  per_page: number;
}

// ============================================
// Bonding curve math helpers
// ============================================
export const INITIAL_VIRTUAL_SOL = 30;
export const INITIAL_VIRTUAL_TOKENS = 1_000_000_000;
export const GRADUATION_THRESHOLD_SOL = 120;
export const FEE_BPS = 100;

export function calculateBuyTokens(
  virtualSol: number,
  virtualTokens: number,
  solAmount: number
): number {
  const newVirtualSol = virtualSol + solAmount;
  const invariant = virtualSol * virtualTokens;
  const newVirtualTokens = invariant / newVirtualSol;
  return virtualTokens - newVirtualTokens;
}

export function calculateSellSol(
  virtualSol: number,
  virtualTokens: number,
  tokenAmount: number
): number {
  const newVirtualTokens = virtualTokens + tokenAmount;
  const invariant = virtualSol * virtualTokens;
  const newVirtualSol = invariant / newVirtualTokens;
  return virtualSol - newVirtualSol;
}

export function calculatePrice(virtualSol: number, virtualTokens: number): number {
  return virtualSol / virtualTokens;
}

export function calculateMarketCap(virtualSol: number, virtualTokens: number, totalSupply: number): number {
  const price = calculatePrice(virtualSol, virtualTokens);
  return price * totalSupply;
}
