import { NextResponse } from 'next/server';
import { Connection, clusterApiUrl, Transaction } from '@solana/web3.js';
import { getToken, recordTrade } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Get connection based on environment
function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
  return new Connection(rpcUrl, 'confirmed');
}

interface ExecuteTradeRequest {
  signedTransaction: string;  // Base64 encoded signed transaction
  mint: string;
  type: 'buy' | 'sell';
  wallet: string;
  solAmount: number;
  tokenAmount: number;
}

/**
 * Execute a signed trade transaction
 * POST /api/trade/execute
 * 
 * Submits the user's signed transaction to the network
 */
export async function POST(request: Request) {
  try {
    const body: ExecuteTradeRequest = await request.json();
    
    // Validate
    if (!body.signedTransaction || !body.mint || !body.type || !body.wallet) {
      return NextResponse.json(
        { success: false, error: 'signedTransaction, mint, type, and wallet are required' },
        { status: 400 }
      );
    }

    // Verify token exists
    const token = await getToken(body.mint);
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }

    const connection = getConnection();
    
    // Deserialize the signed transaction
    const transactionBuffer = Buffer.from(body.signedTransaction, 'base64');
    const transaction = Transaction.from(transactionBuffer);
    
    // Send the transaction
    console.log(`📤 Submitting ${body.type} transaction for ${body.mint}...`);
    
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
    
    console.log(`✅ Transaction confirmed: ${signature}`);
    
    // Record the trade in database
    try {
      await recordTrade({
        mint: body.mint,
        type: body.type,
        wallet: body.wallet,
        solAmount: body.solAmount,
        tokenAmount: body.tokenAmount,
        signature,
        timestamp: new Date(),
      });
    } catch (dbError) {
      console.error('Warning: Failed to record trade in database:', dbError);
      // Don't fail the request - trade succeeded on-chain
    }
    
    // Get transaction details for response
    const txDetails = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    
    return NextResponse.json({
      success: true,
      signature,
      explorer: `https://explorer.solana.com/tx/${signature}?cluster=${
        process.env.SOLANA_NETWORK || 'devnet'
      }`,
      slot: confirmation.context?.slot,
      blockTime: txDetails?.blockTime,
    });
    
  } catch (error) {
    console.error('Error executing trade:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to execute trade: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
