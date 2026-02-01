import { NextResponse } from 'next/server';
import { getNetworkStatus, isMockMode, getConnection } from '@/lib/solana';
import { findConfigPDA, PROGRAM_ID } from '@/lib/anchor';

export const dynamic = 'force-dynamic';

/**
 * Check if the Anchor program is deployed by looking for the config PDA
 */
async function checkAnchorProgram(): Promise<boolean> {
  if (isMockMode()) return false;
  
  try {
    const connection = getConnection();
    const [configPDA] = findConfigPDA();
    const account = await connection.getAccountInfo(configPDA);
    return account !== null;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const status = await getNetworkStatus();
    const anchorProgram = await checkAnchorProgram();
    
    return NextResponse.json({
      success: true,
      ...status,
      rpcUrl: isMockMode() ? 'mock' : process.env.SOLANA_RPC_URL || 'default',
      anchorProgram,
      programId: PROGRAM_ID.toBase58(),
    });
  } catch (error) {
    console.error('Error getting network status:', error);
    return NextResponse.json({
      success: true,
      network: process.env.SOLANA_NETWORK || 'devnet',
      mockMode: isMockMode(),
      anchorProgram: false,
      error: 'Failed to connect to Solana network',
    });
  }
}
