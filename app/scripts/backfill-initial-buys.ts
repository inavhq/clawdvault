/**
 * Backfill initial buy trades from on-chain CreateEvents
 */

import { PrismaClient } from '@prisma/client';
import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bc8abd94-3db9-4d85-8870-65d72824c7fa';
const PROGRAM_ID = new PublicKey('GUyF2TVe32Cid4iGVt2F6wPYDhLSVmTUZBj2974outYM');

// CreateEvent discriminator
const CREATE_EVENT_DISCRIMINATOR = Buffer.from([27, 114, 169, 77, 222, 235, 99, 118]);

async function main() {
  const prisma = new PrismaClient();
  const connection = new Connection(RPC_URL, 'confirmed');

  console.log('🔍 Looking for initial buys from CreateEvents...\n');

  // Get all tokens
  const tokens = await prisma.token.findMany();
  
  for (const token of tokens) {
    // Check if this token already has any trades
    const existingTrades = await prisma.trade.count({
      where: { tokenMint: token.mint }
    });
    
    // Check if there's a creation signature we can look up
    // We need to find the token creation transaction
    console.log(`\n${token.symbol}:`);
    console.log(`  Existing trades: ${existingTrades}`);
    
    // For now, just log - we'd need to scan for CreateEvent
    // This is complex - would need to search all program txs
  }

  console.log('\n⚠️ Full backfill requires scanning on-chain CreateEvents.');
  console.log('For now, you can manually re-create tokens with initial buys,');
  console.log('or we can add CreateEvent parsing to sync-trades.');
  
  await prisma.$disconnect();
}

main().catch(console.error);
