/**
 * Execute Jupiter swap and record to database
 * 
 * POST /api/trade/jupiter/execute
 * 
 * After user signs the Jupiter transaction, this endpoint:
 * 1. Sends the signed transaction to Solana
 * 2. Waits for confirmation
 * 3. Records the trade in the database
 */

import { NextResponse } from 'next/server';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { recordTrade } from '@/lib/db';

export const dynamic = 'force-dynamic';

function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * POST /api/trade/jupiter/execute
 * 
 * Body: {
 *   mint: string,
 *   signedTransaction: string,  // base64 encoded signed VersionedTransaction
 *   type: 'buy' | 'sell',
 *   wallet: string,
 *   solAmount: number,     // SOL amount in decimal
 *   tokenAmount: number,   // Token amount in decimal
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mint, signedTransaction, type, wallet, solAmount, tokenAmount } = body;

    // Validate inputs
    if (!mint || !signedTransaction || !type || !wallet) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const connection = getConnection();

    // Deserialize and send the signed transaction
    const txBuffer = Buffer.from(signedTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuffer);

    console.log(`🚀 Sending Jupiter ${type} transaction for ${mint}...`);

    // Send transaction
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    console.log(`📤 Transaction sent: ${signature}`);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('Transaction failed:', confirmation.value.err);
      return NextResponse.json(
        { success: false, error: 'Transaction failed on-chain', details: confirmation.value.err },
        { status: 400 }
      );
    }

    console.log(`✅ Transaction confirmed: ${signature}`);

    // Record trade in database
    // For Jupiter trades, we use the expected values from the quote
    const trade = await recordTrade({
      mint,
      wallet,
      type: type as 'buy' | 'sell',
      solAmount: solAmount || 0,
      tokenAmount: tokenAmount || 0,
      signature,
    });

    return NextResponse.json({
      success: true,
      signature,
      trade,
      message: 'Jupiter trade executed and recorded!',
    });

  } catch (error: unknown) {
    console.error('Jupiter execute error:', error);
    
    // Handle specific errors
    if ((error as Error).message?.includes('block height exceeded')) {
      return NextResponse.json(
        { success: false, error: 'Transaction expired. Please try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to execute Jupiter trade' },
      { status: 500 }
    );
  }
}
