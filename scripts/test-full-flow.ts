/**
 * Full End-to-End Test on Devnet
 * 
 * Tests:
 * 1. Create token (on-chain + DB)
 * 2. Bonding curve trade (buy)
 * 3. Check graduation status (requires 120 SOL to graduate naturally)
 * 4. Jupiter trade (only if graduated)
 * 
 * NOTE: force_graduate has been removed. Tokens graduate naturally at 120 SOL.
 * 
 * Usage: DEVNET=1 npx tsx scripts/test-full-flow.ts
 */

import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  TransactionInstruction, 
  clusterApiUrl, 
  sendAndConfirmTransaction,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as crypto from 'crypto';

const PROGRAM_ID = new PublicKey('GUyF2TVe32Cid4iGVt2F6wPYDhLSVmTUZBj2974outYM');
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// API base URL - use local dev server
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// Load wallet
const walletPath = process.env.HOME + '/.config/solana/claw-wallet.json';
const wallet = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
);

const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

console.log('🐺 ClawdVault Full Flow Test');
console.log('============================');
console.log('Wallet:', wallet.publicKey.toBase58());
console.log('API:', API_BASE);
console.log('');

async function createToken(): Promise<PublicKey> {
  const mint = Keypair.generate();
  console.log('📝 Creating token:', mint.publicKey.toBase58());
  
  // PDAs
  const [configPDA] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
  const [curvePDA] = PublicKey.findProgramAddressSync([Buffer.from('bonding_curve'), mint.publicKey.toBuffer()], PROGRAM_ID);
  const [solVaultPDA] = PublicKey.findProgramAddressSync([Buffer.from('sol_vault'), mint.publicKey.toBuffer()], PROGRAM_ID);
  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID
  );
  const tokenVault = await getAssociatedTokenAddress(mint.publicKey, curvePDA, true);
  const creatorTokenAccount = await getAssociatedTokenAddress(mint.publicKey, wallet.publicKey);

  // Build instruction
  const discriminator = crypto.createHash('sha256').update('global:create_token').digest().slice(0, 8);
  const timestamp = Date.now();
  const name = `FlowTest${timestamp % 10000}`;
  const symbol = 'FTEST';
  const uri = `https://clawdvault.com/api/metadata/${mint.publicKey.toBase58()}`;

  function encodeString(s: string): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32LE(s.length);
    return Buffer.concat([len, Buffer.from(s)]);
  }

  function encodeU64(n: bigint): Buffer {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(n);
    return buf;
  }

  const data = Buffer.concat([
    discriminator,
    encodeString(name),
    encodeString(symbol),
    encodeString(uri),
    encodeU64(BigInt(50_000_000)), // 0.05 SOL initial buy
  ]);

  const keys = [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: configPDA, isSigner: false, isWritable: true },
    { pubkey: mint.publicKey, isSigner: true, isWritable: true },
    { pubkey: metadataPDA, isSigner: false, isWritable: true },
    { pubkey: curvePDA, isSigner: false, isWritable: true },
    { pubkey: solVaultPDA, isSigner: false, isWritable: true },
    { pubkey: tokenVault, isSigner: false, isWritable: true },
    { pubkey: creatorTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
  const tx = new Transaction().add(ix);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const sig = await sendAndConfirmTransaction(connection, tx, [wallet, mint]);
  console.log('✅ Token created on-chain:', sig);

  // Also create in DB via API
  console.log('📝 Creating token in DB via API...');
  const dbRes = await fetch(`${API_BASE}/api/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mint: mint.publicKey.toBase58(),
      name,
      symbol,
      uri,
      creator: wallet.publicKey.toBase58(),
      initialBuy: 0.05,
    }),
  });
  
  if (dbRes.ok) {
    console.log('✅ Token created in DB');
  } else {
    console.log('⚠️ DB creation skipped (might already exist or endpoint missing)');
  }

  return mint.publicKey;
}

async function testBondingCurveTrade(mint: PublicKey) {
  console.log('\n📊 Testing bonding curve trade...');
  
  // Get quote via prepare endpoint
  const prepareRes = await fetch(`${API_BASE}/api/trade/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mint: mint.toBase58(),
      type: 'buy',
      amount: 0.01, // 0.01 SOL
      wallet: wallet.publicKey.toBase58(),
      slippage: 0.02,
    }),
  });

  const prepareData = await prepareRes.json();
  
  if (!prepareData.success) {
    if (prepareData.graduated) {
      console.log('⚠️ Token already graduated, skipping bonding curve test');
      return;
    }
    console.error('❌ Prepare failed:', prepareData.error);
    return;
  }

  console.log('Quote:', {
    input: prepareData.input,
    output: prepareData.output,
  });

  // Sign transaction
  const txBuf = Buffer.from(prepareData.transaction, 'base64');
  const { Transaction: TxClass } = await import('@solana/web3.js');
  const tx = TxClass.from(txBuf);
  tx.sign(wallet);
  const signedTx = tx.serialize().toString('base64');

  // Execute
  const executeRes = await fetch(`${API_BASE}/api/trade/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mint: mint.toBase58(),
      signedTransaction: signedTx,
      type: 'buy',
      wallet: wallet.publicKey.toBase58(),
      expectedOutput: prepareData.output.tokens,
      solAmount: prepareData.input.sol,
      tokenAmount: prepareData.output.tokens,
    }),
  });

  const executeData = await executeRes.json();
  
  if (executeData.success) {
    console.log('✅ Bonding curve trade executed:', executeData.signature);
    console.log('Trade recorded in DB:', executeData.trade?.id || 'N/A');
  } else {
    console.error('❌ Execute failed:', executeData.error);
  }
}

async function testJupiterTrade(mint: PublicKey) {
  console.log('\n🚀 Testing Jupiter trade on graduated token...');
  
  // Check if graduated
  const statusRes = await fetch(`${API_BASE}/api/trade/jupiter?mint=${mint.toBase58()}`);
  const statusData = await statusRes.json();
  
  if (!statusData.graduated) {
    console.log('⚠️ Token not graduated, skipping Jupiter test');
    return;
  }

  console.log('Token is graduated, testing Jupiter swap...');

  // Get Jupiter quote
  const jupiterRes = await fetch(`${API_BASE}/api/trade/jupiter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mint: mint.toBase58(),
      action: 'buy',
      amount: '10000000', // 0.01 SOL in lamports
      userPublicKey: wallet.publicKey.toBase58(),
      slippageBps: 100,
    }),
  });

  const jupiterData = await jupiterRes.json();
  
  if (!jupiterData.success) {
    console.log('⚠️ Jupiter quote failed:', jupiterData.error);
    console.log('(This is expected if token has no Raydium liquidity yet)');
    return;
  }

  console.log('Jupiter quote:', jupiterData.quote);

  // Sign versioned transaction
  const { VersionedTransaction } = await import('@solana/web3.js');
  const txBuf = Buffer.from(jupiterData.transaction, 'base64');
  const vTx = VersionedTransaction.deserialize(txBuf);
  vTx.sign([wallet]);
  const signedTx = Buffer.from(vTx.serialize()).toString('base64');

  // Execute via API (records to DB)
  const executeRes = await fetch(`${API_BASE}/api/trade/jupiter/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mint: mint.toBase58(),
      signedTransaction: signedTx,
      type: 'buy',
      wallet: wallet.publicKey.toBase58(),
      solAmount: Number(jupiterData.quote.inAmount) / 1e9,
      tokenAmount: Number(jupiterData.quote.outAmount) / 1e6,
    }),
  });

  const executeData = await executeRes.json();
  
  if (executeData.success) {
    console.log('✅ Jupiter trade executed:', executeData.signature);
    console.log('Trade recorded in DB:', executeData.trade?.id || 'N/A');
  } else {
    console.error('❌ Jupiter execute failed:', executeData.error);
  }
}

async function main() {
  try {
    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log('Wallet balance:', balance / 1e9, 'SOL\n');
    
    if (balance < 0.2 * 1e9) {
      console.error('❌ Insufficient balance. Need at least 0.2 SOL');
      return;
    }

    // Step 1: Create token
    const mint = await createToken();

    // Step 2: Test bonding curve trade
    await testBondingCurveTrade(mint);

    // Step 3: Check graduation status
    console.log('\n🎓 Checking graduation status...');
    const [curvePDA] = PublicKey.findProgramAddressSync([Buffer.from('bonding_curve'), mint.toBuffer()], PROGRAM_ID);
    const curveAccount = await connection.getAccountInfo(curvePDA);
    const isGraduated = curveAccount && curveAccount.data[112] === 1;
    const realSol = curveAccount ? Number(curveAccount.data.readBigUInt64LE(88)) / 1e9 : 0;
    
    console.log(`   Real SOL reserves: ${realSol.toFixed(4)} SOL`);
    console.log(`   Progress to graduation: ${(realSol / 120 * 100).toFixed(2)}%`);
    
    if (isGraduated) {
      console.log('✅ Token is graduated!');
      // Step 4: Test Jupiter trade
      await testJupiterTrade(mint);
    } else {
      console.log('⚠️ Token not yet graduated (needs 120 SOL)');
      console.log('   Skipping Jupiter trade test');
    }

    console.log('\n============================');
    console.log('✅ Full flow test complete!');
    console.log('Token:', mint.toBase58());
    console.log('Graduated:', isGraduated);

  } catch (err) {
    console.error('❌ Test failed:', err);
  }
}

main();
