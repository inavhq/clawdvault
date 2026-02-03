import { NextResponse } from 'next/server';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { findBondingCurvePDA, PROGRAM_ID } from '@/lib/anchor/client';
import { updateToken } from '@/lib/db';

export const dynamic = 'force-dynamic';

function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * POST /api/fix-reserves
 * Sync token reserves from on-chain state
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mint } = body;
    
    if (!mint) {
      return NextResponse.json(
        { success: false, error: 'mint is required' },
        { status: 400 }
      );
    }

    const connection = getConnection();
    const mintPubkey = new PublicKey(mint);
    const [bondingCurvePDA] = findBondingCurvePDA(mintPubkey);
    
    // Fetch on-chain bonding curve data
    const accountInfo = await connection.getAccountInfo(bondingCurvePDA);
    if (!accountInfo) {
      return NextResponse.json(
        { success: false, error: 'Bonding curve not found on-chain' },
        { status: 404 }
      );
    }
    
    // Parse bonding curve data (skip 8-byte discriminator)
    const data = accountInfo.data;
    let offset = 8;
    
    // Read fields in order from the BondingCurve struct
    const mintFromChain = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;
    
    const creator = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;
    
    const virtualSolReserves = Number(data.readBigUInt64LE(offset)) / 1e9;
    offset += 8;
    
    const virtualTokenReserves = Number(data.readBigUInt64LE(offset)) / 1e6;
    offset += 8;
    
    const realSolReserves = Number(data.readBigUInt64LE(offset)) / 1e9;
    offset += 8;
    
    const realTokenReserves = Number(data.readBigUInt64LE(offset)) / 1e6;
    offset += 8;
    
    const graduated = data[offset] === 1;
    
    console.log('📊 On-chain reserves:', {
      virtualSolReserves,
      virtualTokenReserves,
      realSolReserves,
      realTokenReserves,
      graduated,
    });
    
    // Update database
    const updated = await updateToken(mint, {
      virtualSolReserves,
      virtualTokenReserves,
      realSolReserves,
      realTokenReserves,
      graduated,
    });
    
    const newPrice = virtualSolReserves / virtualTokenReserves;
    
    return NextResponse.json({
      success: true,
      mint,
      reserves: {
        virtualSolReserves,
        virtualTokenReserves,
        realSolReserves,
        realTokenReserves,
      },
      price: newPrice,
      marketCap: newPrice * 1e9,
      graduated,
      updated: !!updated,
    });
    
  } catch (error) {
    console.error('Fix reserves error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
