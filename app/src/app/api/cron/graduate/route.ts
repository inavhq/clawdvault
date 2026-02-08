/**
 * Cron: Auto-graduation watcher
 * Runs every 5 minutes to check for tokens ready to graduate
 * 
 * Graduation threshold: 120 SOL in real_sol_reserves
 */

import { NextResponse } from 'next/server';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { getAllTokens, updateToken } from '@/lib/db';
import { findBondingCurvePDA } from '@/lib/anchor/client';
import { GRADUATION_THRESHOLD_SOL } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow up to 5 min for graduation process

// 120 SOL threshold
const GRADUATION_THRESHOLD_LAMPORTS = BigInt(GRADUATION_THRESHOLD_SOL) * BigInt(1_000_000_000);

function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
  return new Connection(rpcUrl, 'confirmed');
}

interface CurveData {
  graduated: boolean;
  migratedToRaydium: boolean;
  realSolReserves: bigint;
  realTokenReserves: bigint;
}

/**
 * Read bonding curve state from chain
 */
async function getCurveState(connection: Connection, mint: string): Promise<CurveData | null> {
  try {
    const mintPubkey = new PublicKey(mint);
    const [curvePDA] = findBondingCurvePDA(mintPubkey);
    
    const curveAccount = await connection.getAccountInfo(curvePDA);
    if (!curveAccount) return null;
    
    const data = curveAccount.data;
    // graduated at offset 112
    const graduated = data[112] === 1;
    // migrated_to_raydium at offset 113
    const migratedToRaydium = data[113] === 1;
    // real_sol_reserves at offset 88
    const realSolReserves = data.readBigUInt64LE(88);
    // real_token_reserves at offset 96
    const realTokenReserves = data.readBigUInt64LE(96);
    
    return { graduated, migratedToRaydium, realSolReserves, realTokenReserves };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('⚠️ Unauthorized cron attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🎓 [CRON] Starting graduation check...');
  
  const results = {
    checked: 0,
    readyToGraduate: [] as string[],
    graduated: [] as string[],
    errors: [] as string[],
  };

  try {
    // Get all non-graduated tokens
    const { tokens } = await getAllTokens({ graduated: false, perPage: 100 });
    results.checked = tokens.length;
    
    console.log(`🔍 Checking ${tokens.length} non-graduated tokens...`);
    
    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        cron: 'graduate',
        message: 'No non-graduated tokens to check',
        ...results,
      });
    }

    const connection = getConnection();
    
    for (const token of tokens) {
      try {
        // Get on-chain state
        const curveState = await getCurveState(connection, token.mint);
        
        if (!curveState) {
          console.warn(`⚠️ No curve found for ${token.mint}`);
          continue;
        }

        // Sync DB with on-chain graduated state if needed
        if (curveState.graduated && !token.graduated) {
          console.log(`📝 Syncing graduated state for ${token.mint}`);
          await updateToken(token.mint, { graduated: true });
        }

        // Check if ready for graduation (on-chain not graduated, but threshold reached)
        if (!curveState.graduated && curveState.realSolReserves >= GRADUATION_THRESHOLD_LAMPORTS) {
          console.log(`🚀 Token ${token.mint} ready to graduate! (${Number(curveState.realSolReserves) / 1e9} SOL)`);
          results.readyToGraduate.push(token.mint);
          
          // Trigger graduation
          try {
            const baseUrl = process.env.VERCEL_URL 
              ? `https://${process.env.VERCEL_URL}` 
              : 'http://localhost:3000';
            
            const gradResponse = await fetch(`${baseUrl}/api/graduate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                // Pass cron secret for auth
                'X-Cron-Secret': cronSecret || '',
              },
              body: JSON.stringify({ mint: token.mint }),
            });
            
            const gradData = await gradResponse.json();
            
            if (gradData.success) {
              results.graduated.push(token.mint);
              console.log(`✅ Graduated ${token.mint} to Raydium!`);
            } else {
              results.errors.push(`${token.mint}: ${gradData.error}`);
              console.error(`❌ Failed to graduate ${token.mint}:`, gradData.error);
            }
          } catch (gradError) {
            results.errors.push(`${token.mint}: ${(gradError as Error).message}`);
            console.error(`❌ Graduation error for ${token.mint}:`, gradError);
          }
        }
        
        // Log progress for tokens approaching threshold
        const solReserves = Number(curveState.realSolReserves) / 1e9;
        if (solReserves > 10 && !curveState.graduated) {
          const progress = (solReserves / 120) * 100;
          console.log(`📊 ${token.symbol}: ${solReserves.toFixed(2)} SOL (${progress.toFixed(1)}% to graduation)`);
        }
        
      } catch (err) {
        console.error(`Error checking ${token.mint}:`, err);
        results.errors.push(`${token.mint}: ${(err as Error).message}`);
      }
    }

    console.log(`🎓 [CRON] Graduation check complete`);
    console.log(`   Checked: ${results.checked}`);
    console.log(`   Ready: ${results.readyToGraduate.length}`);
    console.log(`   Graduated: ${results.graduated.length}`);
    console.log(`   Errors: ${results.errors.length}`);

    return NextResponse.json({
      success: true,
      cron: 'graduate',
      ...results,
    });

  } catch (error) {
    console.error('❌ [CRON] Graduation cron failed:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message, ...results },
      { status: 500 }
    );
  }
}
