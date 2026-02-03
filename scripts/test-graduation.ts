/**
 * Test Graduation Flow on Devnet
 * 
 * This script tests the release_for_migration flow for tokens that have
 * naturally graduated (reached 120 SOL threshold).
 * 
 * Prerequisites:
 * 1. Deploy program to devnet
 * 2. Have a token that has graduated (120 SOL threshold reached)
 * 
 * Usage: npx tsx scripts/test-graduation.ts <mint>
 */

import { Connection, PublicKey, Keypair, clusterApiUrl, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import * as fs from 'fs';
import ClawdVaultClient, { findBondingCurvePDA, findConfigPDA, PROGRAM_ID } from '../app/src/lib/anchor/client';

const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// Load authority wallet
const walletPath = process.env.HOME + '/.config/solana/claw-wallet.json';
const authority = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
);
console.log('Authority:', authority.publicKey.toBase58());

async function main() {
  const mintArg = process.argv[2];
  
  if (!mintArg) {
    // List existing tokens
    console.log('\nFetching existing bonding curves...\n');
    
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [{ dataSize: 123 }],
    });
    
    if (accounts.length === 0) {
      console.log('No tokens found on devnet. Create one first on the app.');
      return;
    }
    
    console.log('Available tokens:');
    for (const { account } of accounts) {
      const data = account.data;
      const mint = new PublicKey(data.slice(40, 72)).toBase58();
      const realSol = Number(data.readBigUInt64LE(88)) / 1e9;
      const graduated = data[112] === 1;
      const migrated = data.length > 113 ? data[113] === 1 : false;
      const status = migrated ? '🔄 MIGRATED' : graduated ? '✅ GRADUATED' : '';
      console.log(`  ${mint} - ${realSol.toFixed(4)} SOL ${status}`);
    }
    console.log('\nUsage: npx tsx scripts/test-graduation.ts <mint>');
    return;
  }
  
  const mint = new PublicKey(mintArg);
  console.log('\nTesting graduation for:', mint.toBase58());
  
  const client = new ClawdVaultClient(connection);
  const [curvePDA] = findBondingCurvePDA(mint);
  
  // Check current state
  const curveAccount = await connection.getAccountInfo(curvePDA);
  if (!curveAccount) {
    console.error('❌ Bonding curve not found!');
    return;
  }
  
  const data = curveAccount.data;
  const graduated = data[112] === 1;
  const migrated = data.length > 113 ? data[113] === 1 : false;
  const realSol = Number(data.readBigUInt64LE(88)) / 1e9;
  const realTokens = Number(data.readBigUInt64LE(96));
  
  console.log('Current state:');
  console.log('  Graduated:', graduated);
  console.log('  Migrated:', migrated);
  console.log('  SOL reserves:', realSol);
  console.log('  Token reserves:', realTokens);
  
  if (!graduated) {
    console.log('\n⚠️ Token not graduated yet!');
    console.log('   Needs 120 SOL in real_sol_reserves to graduate naturally.');
    console.log(`   Current: ${realSol.toFixed(4)} SOL (${(realSol / 120 * 100).toFixed(1)}%)`);
    return;
  }
  
  if (migrated) {
    console.log('\n✅ Token already migrated to Raydium!');
    return;
  }
  
  // Token is graduated but not migrated - we can test release_for_migration
  console.log('\n📝 Testing release_for_migration...');
  
  // Step 1: Ensure migration wallet has token account
  const migrationWallet = authority.publicKey; // Using authority as migration wallet for testing
  const migrationTokenAccount = await getAssociatedTokenAddress(mint, migrationWallet);
  
  try {
    await getAccount(connection, migrationTokenAccount);
    console.log('✅ Migration token account exists');
  } catch {
    console.log('Creating migration token account...');
    const createAtaIx = createAssociatedTokenAccountInstruction(
      authority.publicKey,
      migrationTokenAccount,
      migrationWallet,
      mint
    );
    const tx = new Transaction().add(createAtaIx);
    tx.feePayer = authority.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const sig = await sendAndConfirmTransaction(connection, tx, [authority]);
    console.log('✅ Created ATA:', sig);
  }
  
  // Step 2: Call release_for_migration
  console.log('\n📝 Calling release_for_migration...');
  
  const releaseTx = await client.buildReleaseForMigrationTx(
    authority.publicKey,
    mint,
    migrationWallet
  );
  
  const releaseSig = await sendAndConfirmTransaction(connection, releaseTx, [authority]);
  console.log('✅ Assets released:', releaseSig);
  
  // Verify
  const finalAccount = await connection.getAccountInfo(curvePDA);
  if (finalAccount) {
    const finalData = finalAccount.data;
    const finalMigrated = finalData.length > 113 ? finalData[113] === 1 : false;
    console.log('\nFinal state:');
    console.log('  Migrated:', finalMigrated);
    
    if (finalMigrated) {
      console.log('\n🎉 Migration test successful!');
      console.log('   SOL and tokens released to migration wallet');
      console.log('   Ready for Raydium pool creation');
    }
  }
}

main().catch(console.error);
