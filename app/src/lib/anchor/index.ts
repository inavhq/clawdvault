/**
 * ClawdVault Anchor Integration
 * 
 * Exports the client and utilities for on-chain trading.
 * Falls back to custodial API when Anchor program not deployed.
 */

export { 
  ClawdVaultClient,
  PROGRAM_ID,
  TOTAL_SUPPLY,
  INITIAL_VIRTUAL_SOL,
  INITIAL_VIRTUAL_TOKENS,
  GRADUATION_THRESHOLD,
  PROTOCOL_FEE_BPS,
  CREATOR_FEE_BPS,
  TOTAL_FEE_BPS,
  findConfigPDA,
  findBondingCurvePDA,
  findSolVaultPDA,
  findTokenVaultAddress,
  calculateBuyTokensOut,
  calculateSellSolOut,
  calculatePrice,
  calculateMarketCap,
  calculateGraduationProgress,
} from './client';

export type { BondingCurveState } from './client';

/**
 * Check if Anchor program is deployed on the current network
 */
export async function isAnchorProgramDeployed(): Promise<boolean> {
  try {
    const res = await fetch('/api/network');
    const data = await res.json();
    return data.anchorProgram === true;
  } catch {
    return false;
  }
}
