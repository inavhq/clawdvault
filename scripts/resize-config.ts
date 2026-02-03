/**
 * Resize Config Account
 * 
 * One-time migration to add migration_operator field to Config.
 * Run this AFTER deploying the updated contract.
 * 
 * Usage: 
 *   MAINNET=1 npx tsx scripts/resize-config.ts
 */

import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction,
  TransactionInstruction,
  clusterApiUrl, 
  sendAndConfirmTransaction,
  SystemProgram,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as crypto from 'crypto';

const PROGRAM_ID = new PublicKey('GUyF2TVe32Cid4iGVt2F6wPYDhLSVmTUZBj2974outYM');

// Expected sizes
const OLD_CONFIG_SIZE = 8 + 32 + 32 + 8 + 8 + 1; // 89 bytes
const NEW_CONFIG_SIZE = 8 + 32 + 32 + 32 + 8 + 8 + 1; // 121 bytes

// Get connection based on env
const isMainnet = process.env.MAINNET === '1';
const rpcUrl = isMainnet 
  ? (process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com')
  : clusterApiUrl('devnet');
const connection = new Connection(rpcUrl, 'confirmed');

console.log(`Network: ${isMainnet ? 'MAINNET' : 'devnet'}`);
console.log(`RPC: ${rpcUrl}`);

// Load authority wallet
const walletPath = process.env.WALLET_PATH || process.env.HOME + '/.config/solana/claw-wallet.json';
const authority = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
);

console.log('Authority wallet:', authority.publicKey.toBase58());

// Compute discriminator
function getDiscriminator(name: string): Buffer {
  return crypto.createHash('sha256').update(`global:${name}`).digest().slice(0, 8);
}

async function main() {
  // Find config PDA
  const [configPDA] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
  console.log('Config PDA:', configPDA.toBase58());

  // Check current config
  const configAccount = await connection.getAccountInfo(configPDA);
  if (!configAccount) {
    console.error('❌ Config not found! Protocol may not be initialized.');
    return;
  }

  console.log('\nCurrent config size:', configAccount.data.length, 'bytes');
  console.log('Expected old size:', OLD_CONFIG_SIZE, 'bytes');
  console.log('Expected new size:', NEW_CONFIG_SIZE, 'bytes');

  if (configAccount.data.length >= NEW_CONFIG_SIZE) {
    console.log('\n✅ Config already at new size. No resize needed.');
    
    // Check if migration_operator is set
    const migrationOperator = new PublicKey(configAccount.data.slice(72, 104));
    console.log('Migration operator:', migrationOperator.toBase58());
    return;
  }

  // Parse current authority
  const currentAuthority = new PublicKey(configAccount.data.slice(8, 40));
  console.log('\nCurrent authority:', currentAuthority.toBase58());

  if (!currentAuthority.equals(authority.publicKey)) {
    console.error('\n❌ Your wallet is not the authority!');
    console.error(`   Your wallet: ${authority.publicKey.toBase58()}`);
    console.error(`   On-chain authority: ${currentAuthority.toBase58()}`);
    return;
  }

  console.log('\n📝 Resizing config account...');
  console.log(`   From: ${configAccount.data.length} bytes`);
  console.log(`   To: ${NEW_CONFIG_SIZE} bytes`);

  // Calculate rent difference
  const oldRent = await connection.getMinimumBalanceForRentExemption(configAccount.data.length);
  const newRent = await connection.getMinimumBalanceForRentExemption(NEW_CONFIG_SIZE);
  const rentDiff = newRent - oldRent;
  console.log(`   Additional rent: ${rentDiff / 1e9} SOL`);

  // Build transaction
  const discriminator = getDiscriminator('resize_config');
  console.log('Discriminator:', discriminator.toString('hex'));

  // Get bump from existing account data (last byte for old format)
  const bump = configAccount.data[configAccount.data.length - 1];
  console.log('Config bump:', bump);

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: configPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: discriminator,
  });

  const tx = new Transaction().add(instruction);
  tx.feePayer = authority.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  console.log('\n📤 Sending transaction...');
  const signature = await sendAndConfirmTransaction(connection, tx, [authority]);
  console.log('✅ Config resized!');
  console.log('   Signature:', signature);

  // Verify
  const updatedConfig = await connection.getAccountInfo(configPDA);
  if (updatedConfig) {
    console.log('\n✅ New config size:', updatedConfig.data.length, 'bytes');
    
    if (updatedConfig.data.length >= 104) {
      const migrationOperator = new PublicKey(updatedConfig.data.slice(72, 104));
      console.log('Migration operator (set to authority):', migrationOperator.toBase58());
    }
  }

  console.log('\n📋 Next steps:');
  console.log('1. Generate operator wallet: solana-keygen new -o ~/.config/solana/operator-wallet.json');
  console.log('2. Set operator: MAINNET=1 npx tsx scripts/set-migration-operator.ts <pubkey>');
  console.log('3. Fund operator: solana transfer <pubkey> 0.5 --url mainnet-beta');
}

main().catch(console.error);
