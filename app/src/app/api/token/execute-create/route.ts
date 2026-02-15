import { NextResponse } from 'next/server';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { createToken } from '@/lib/db';
import { db } from '@/lib/prisma';
import { announceNewToken } from '@/lib/moltx';
import { updateCandles } from '@/lib/candles';
import { INITIAL_VIRTUAL_SOL, INITIAL_VIRTUAL_TOKENS } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Look up username from users table
async function getUsername(wallet: string): Promise<string | null> {
  try {
    const profile = await db().user.findUnique({
      where: { wallet },
      select: { name: true },
    });
    return profile?.name || null;
  } catch {
    return null;
  }
}

// Get connection based on environment
function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
  return new Connection(rpcUrl, 'confirmed');
}

interface ExecuteCreateRequest {
  signedTransaction: string;  // Base64 encoded signed transaction
  mint: string;               // Mint address (for DB record)
  creator: string;            // Creator wallet
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  creatorName?: string;
  // NOTE: initialBuy removed - contract now emits TradeEvent, sync-trades catches it
}

/**
 * Execute a signed create token transaction
 * POST /api/token/execute-create
 * 
 * Submits the user's signed transaction to the network
 * and records the token in the database
 */
export async function POST(request: Request) {
  try {
    const body: ExecuteCreateRequest = await request.json();
    
    // Validate
    if (!body.signedTransaction || !body.mint || !body.creator || !body.name || !body.symbol) {
      return NextResponse.json(
        { success: false, error: 'signedTransaction, mint, creator, name, and symbol are required' },
        { status: 400 }
      );
    }

    const connection = getConnection();
    
    // Deserialize the signed transaction
    const transactionBuffer = Buffer.from(body.signedTransaction, 'base64');
    
    // Send the transaction
    console.log(`📤 Submitting create token transaction for ${body.symbol}...`);
    
    const signature = await connection.sendRawTransaction(transactionBuffer, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    
    console.log(`📝 Transaction submitted: ${signature}`);
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('❌ Transaction failed:', confirmation.value.err);
      return NextResponse.json({
        success: false,
        error: 'Transaction failed on-chain',
        signature,
        details: confirmation.value.err,
      }, { status: 400 });
    }
    
    console.log(`✅ Token created on-chain: ${signature}`);
    
    // Look up creator's username from users table
    const creatorName = body.creatorName || await getUsername(body.creator) || undefined;
    
    // Record the token in database
    const token = await createToken({
      mint: body.mint,
      name: body.name,
      symbol: body.symbol,
      description: body.description,
      image: body.image,
      creator: body.creator,
      creator_name: creatorName,
      twitter: body.twitter,
      telegram: body.telegram,
      website: body.website,
    });

    if (!token) {
      // Token created on-chain but DB failed - still return success with warning
      console.error('Warning: Token created on-chain but failed to save to database');
      return NextResponse.json({
        success: true,
        warning: 'Token created on-chain but database record failed',
        signature,
        mint: body.mint,
        explorer: `https://solscan.io/tx/${signature}?cluster=${
          process.env.SOLANA_NETWORK || 'devnet'
        }`,
      });
    }

    // Seed initial candle at t=0 using bonding curve starting state
    // This ensures price always exists from token creation, eliminating "no candles" edge cases
    const initialPrice = INITIAL_VIRTUAL_SOL / INITIAL_VIRTUAL_TOKENS;
    try {
      await updateCandles(
        body.mint,
        initialPrice,
        0, // No volume yet
        new Date() // Token creation time
      );
      console.log(`✅ Seeded initial candle for ${body.symbol} at price ${initialPrice} SOL`);
    } catch (err) {
      console.error('Warning: Failed to seed initial candle:', err);
      // Don't fail token creation if candle seeding fails - it's not critical
    }
    
    // Announce new token on Moltx (fire and forget)
    announceNewToken({
      mint: body.mint,
      name: body.name,
      symbol: body.symbol,
      creator: body.creator,
      creatorName,
      image: body.image,
    }).catch(err => console.error('[Moltx] New token announce failed:', err));
    
    // NOTE: Initial buy trades are now handled by sync-trades via TradeEvent
    // The contract emits TradeEvent for initial buys, so sync-trades catches them automatically
    // No need to manually record here - avoids duplicates and ensures on-chain reserves are used
    
    return NextResponse.json({
      success: true,
      token,
      signature,
      mint: body.mint,
      explorer: `https://solscan.io/tx/${signature}?cluster=${
        process.env.SOLANA_NETWORK || 'devnet'
      }`,
    });
    
  } catch (error) {
    console.error('Error executing create token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create token: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
