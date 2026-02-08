import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import ClawdVaultClient, { findSolVaultPDA } from '@/lib/anchor/client';
import { getSolPrice } from '@/lib/sol-price';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

export const dynamic = 'force-dynamic';

// GET /api/stats?mint=xxx - Get on-chain stats for a token
export async function GET(request: NextRequest) {
  const mint = request.nextUrl.searchParams.get('mint');
  
  if (!mint) {
    return NextResponse.json(
      { success: false, error: 'Missing mint parameter' },
      { status: 400 }
    );
  }

  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const mintPubkey = new PublicKey(mint);
    const client = new ClawdVaultClient(connection);
    
    // Get bonding curve state from on-chain
    const curveState = await client.getBondingCurve(mintPubkey);
    
    if (!curveState) {
      // Fallback for tokens not on Anchor program
      const solPriceUsd = await getSolPrice();
      const price = 0.000000028;
      const marketCap = 30;
      return NextResponse.json({
        success: true,
        mint,
        onChain: {
          totalSupply: 1_000_000_000,
          bondingCurveBalance: 1_000_000_000,
          circulatingSupply: 0,
          bondingCurveSol: 0,
          price,
          priceUsd: solPriceUsd ? price * solPriceUsd : null,
          marketCap,
          marketCapUsd: solPriceUsd ? marketCap * solPriceUsd : null,
          solPriceUsd,
        }
      });
    }

    // Get total supply
    const supplyInfo = await connection.getTokenSupply(mintPubkey);
    const totalSupply = Number(supplyInfo.value.uiAmount) || 1_000_000_000;

    // Get SOL vault balance
    const [solVaultPDA] = findSolVaultPDA(mintPubkey);
    const solVaultBalance = await connection.getBalance(solVaultPDA);
    const bondingCurveSol = solVaultBalance / LAMPORTS_PER_SOL;

    // Use actual on-chain reserves for accurate pricing
    const virtualSolReserves = Number(curveState.virtualSolReserves) / LAMPORTS_PER_SOL;
    const virtualTokenReserves = Number(curveState.virtualTokenReserves) / 1_000_000; // 6 decimals
    const realTokenReserves = Number(curveState.realTokenReserves) / 1_000_000;
    
    // Calculate price from actual reserves
    const price = virtualSolReserves / virtualTokenReserves;
    const circulatingSupply = totalSupply - realTokenReserves;
    const marketCap = price * totalSupply;
    
    // Get SOL price for USD calculations
    const solPriceUsd = await getSolPrice();
    const priceUsd = solPriceUsd ? price * solPriceUsd : null;
    const marketCapUsd = solPriceUsd ? marketCap * solPriceUsd : null;

    return NextResponse.json({
      success: true,
      mint,
      onChain: {
        totalSupply,
        bondingCurveBalance: realTokenReserves,
        circulatingSupply,
        bondingCurveSol,
        virtualSolReserves,
        virtualTokenReserves,
        price,
        priceUsd,
        marketCap,
        marketCapUsd,
        solPriceUsd,
        graduated: curveState.graduated,
      }
    });

  } catch (error) {
    console.error('Error fetching on-chain stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch on-chain stats' },
      { status: 500 }
    );
  }
}
