import { NextResponse } from 'next/server';
import { getToken, executeTrade } from '@/lib/db';
import { 
  completeBuyTransaction, 
  completeSellTransaction, 
  isMockMode 
} from '@/lib/solana';

export const dynamic = 'force-dynamic';

interface ExecuteTradeRequest {
  mint: string;
  type: 'buy' | 'sell';
  signedTransaction: string;  // Base64 encoded signed transaction
  wallet: string;             // User's wallet address
  expectedOutput: number;     // Expected tokens (buy) or SOL (sell)
  solAmount?: number;         // SOL involved in trade
  tokenAmount?: number;       // Tokens involved in trade
}

/**
 * Execute a signed trade transaction
 * POST /api/trade/execute
 */
export async function POST(request: Request) {
  try {
    // Check if we're in mock mode
    if (isMockMode()) {
      return NextResponse.json({
        success: false,
        error: 'On-chain trading not configured. Use /api/trade for mock trades.',
        mockMode: true,
      }, { status: 400 });
    }

    const body: ExecuteTradeRequest = await request.json();
    
    // Validate
    if (!body.mint || !body.type || !body.signedTransaction || !body.wallet) {
      return NextResponse.json(
        { success: false, error: 'mint, type, signedTransaction, and wallet are required' },
        { status: 400 }
      );
    }

    // Get token
    const token = await getToken(body.mint);
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }

    let result;
    let solAmount: number;
    let tokenAmount: number;
    
    // Get creator wallet for fee distribution
    const creatorWallet = token.creator;
    
    if (body.type === 'buy') {
      // User signed SOL transfer, we send tokens back
      solAmount = body.solAmount || 0;
      tokenAmount = body.expectedOutput;
      
      // Calculate fee for distribution
      const feeAmount = solAmount * 0.01; // 1% total fee
      
      result = await completeBuyTransaction(
        body.signedTransaction,
        body.mint,
        body.wallet,
        tokenAmount,
        creatorWallet,
        feeAmount
      );
      
    } else {
      // User signed token transfer, we send SOL back
      tokenAmount = body.tokenAmount || 0;
      solAmount = body.expectedOutput;
      
      result = await completeSellTransaction(
        body.signedTransaction,
        body.wallet,
        solAmount,
        creatorWallet
      );
    }

    // Update database with the trade
    const dbResult = await executeTrade(
      body.mint,
      body.type,
      body.type === 'buy' ? solAmount : tokenAmount,
      body.wallet,
      result.signature
    );

    if (!dbResult) {
      // Trade executed on-chain but DB update failed
      // This is a partial failure - funds moved but not tracked
      console.error('DB update failed after on-chain execution');
      return NextResponse.json({
        success: true,
        warning: 'Trade executed but database update failed',
        signature: result.signature,
        solAmount: result.solAmount || solAmount,
        tokenAmount: result.tokenAmount || tokenAmount,
      });
    }

    return NextResponse.json({
      success: true,
      signature: result.signature,
      trade: {
        id: dbResult.trade.id,
        type: body.type,
        solAmount: dbResult.trade.sol_amount,
        tokenAmount: dbResult.trade.token_amount,
        price: dbResult.trade.price_sol,
      },
      newPrice: dbResult.token.price_sol,
      fees: {
        total: dbResult.fees.protocol + dbResult.fees.creator,
        protocol: dbResult.fees.protocol,
        creator: dbResult.fees.creator,
      },
    });

  } catch (error) {
    console.error('Error executing trade:', error);
    
    // Try to provide more specific error
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute trade';
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
