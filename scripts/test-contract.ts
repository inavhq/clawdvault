/**
 * Test ClawdVault contract on devnet
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { 
  PublicKey, Keypair, SystemProgram, Connection, clusterApiUrl,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress 
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const IDL = require("../target/idl/clawdvault.json");

async function main() {
  console.log("🐺 Testing ClawdVault on devnet...\n");
  
  // Setup
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const walletPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  console.log(`💰 Wallet: ${wallet.publicKey.toBase58()}`);
  
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💵 Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);
  
  const programKeypairPath = path.join(__dirname, "../target/deploy/clawdvault-keypair.json");
  const programKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(programKeypairPath, "utf-8")))
  );
  const programId = programKeypair.publicKey;
  
  const provider = new anchor.AnchorProvider(
    connection, 
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);
  
  // @ts-ignore
  const program = new Program(IDL, provider);
  
  // Find PDAs
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
  
  // Check config
  console.log("📊 Checking protocol config...");
  // @ts-ignore
  const config = await (program.account as any).config.fetch(configPDA);
  console.log(`   Authority: ${config.authority.toBase58()}`);
  console.log(`   Fee recipient: ${config.feeRecipient.toBase58()}`);
  console.log(`   Tokens created: ${config.totalTokensCreated.toString()}\n`);
  
  // ============================================
  // TEST 1: Create Token
  // ============================================
  console.log("🪙 TEST 1: Creating token...");
  
  const mintKeypair = Keypair.generate();
  const tokenName = "TestToken" + Date.now().toString().slice(-4);
  const tokenSymbol = "TEST";
  const tokenUri = "https://example.com/token.json";
  
  const [bondingCurvePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), mintKeypair.publicKey.toBuffer()],
    programId
  );
  
  const [solVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("sol_vault"), mintKeypair.publicKey.toBuffer()],
    programId
  );
  
  // Token vault is an ATA owned by bonding curve
  const tokenVaultPDA = await getAssociatedTokenAddress(
    mintKeypair.publicKey,
    bondingCurvePDA,
    true // allowOwnerOffCurve for PDAs
  );
  
  console.log(`   Mint: ${mintKeypair.publicKey.toBase58()}`);
  console.log(`   Bonding curve: ${bondingCurvePDA.toBase58()}`);
  console.log(`   Token vault: ${tokenVaultPDA.toBase58()}`);
  
  try {
    // @ts-ignore
    const createTx = await program.methods
      .createToken(tokenName, tokenSymbol, tokenUri)
      .accounts({
        creator: wallet.publicKey,
        config: configPDA,
        mint: mintKeypair.publicKey,
        bondingCurve: bondingCurvePDA,
        solVault: solVaultPDA,
        tokenVault: tokenVaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mintKeypair])
      .rpc();
    
    console.log(`   ✅ Created! Tx: ${createTx}`);
    
    // Check bonding curve state
    // @ts-ignore
    const curve = await (program.account as any).bondingCurve.fetch(bondingCurvePDA);
    console.log(`   Virtual SOL: ${curve.virtualSolReserves.toString() / LAMPORTS_PER_SOL} SOL`);
    console.log(`   Virtual tokens: ${curve.virtualTokenReserves.toString() / 1e6}`);
    console.log(`   Real SOL: ${curve.realSolReserves.toString() / LAMPORTS_PER_SOL} SOL`);
    console.log(`   Real tokens: ${curve.realTokenReserves.toString() / 1e6}\n`);
    
    // ============================================
    // TEST 2: Buy tokens
    // ============================================
    console.log("💰 TEST 2: Buying tokens (0.1 SOL)...");
    
    const buyAmountSol = 0.1 * LAMPORTS_PER_SOL;
    const minTokensOut = 1; // Minimum tokens to receive
    
    const buyerTokenAccount = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      wallet.publicKey
    );
    
    const balanceBefore = await connection.getBalance(wallet.publicKey);
    const feeRecipientBalanceBefore = await connection.getBalance(config.feeRecipient);
    
    // @ts-ignore
    const buyTx = await program.methods
      .buy(new anchor.BN(buyAmountSol), new anchor.BN(minTokensOut))
      .accounts({
        buyer: wallet.publicKey,
        bondingCurve: bondingCurvePDA,
        config: configPDA,
        mint: mintKeypair.publicKey,
        solVault: solVaultPDA,
        tokenVault: tokenVaultPDA,
        buyerTokenAccount: buyerTokenAccount,
        feeRecipient: config.feeRecipient,
        creator: curve.creator,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log(`   ✅ Bought! Tx: ${buyTx}`);
    
    const balanceAfter = await connection.getBalance(wallet.publicKey);
    const solSpent = (balanceBefore - balanceAfter) / LAMPORTS_PER_SOL;
    console.log(`   SOL spent (incl. fees): ${solSpent.toFixed(6)} SOL`);
    
    // Check fees
    const feeRecipientBalanceAfter = await connection.getBalance(config.feeRecipient);
    const protocolFee = (feeRecipientBalanceAfter - feeRecipientBalanceBefore) / LAMPORTS_PER_SOL;
    console.log(`   Protocol fee received: ${protocolFee.toFixed(6)} SOL`);
    
    // Check token balance
    const tokenBalance = await connection.getTokenAccountBalance(buyerTokenAccount);
    console.log(`   Tokens received: ${tokenBalance.value.uiAmount}`);
    
    // Check updated curve state
    // @ts-ignore
    const curveAfterBuy = await (program.account as any).bondingCurve.fetch(bondingCurvePDA);
    console.log(`   Curve real SOL: ${curveAfterBuy.realSolReserves.toString() / LAMPORTS_PER_SOL} SOL`);
    console.log(`   Curve real tokens: ${curveAfterBuy.realTokenReserves.toString() / 1e6}\n`);
    
    // ============================================
    // TEST 3: Sell tokens
    // ============================================
    console.log("📉 TEST 3: Selling half the tokens...");
    
    const tokensToSell = Math.floor(tokenBalance.value.uiAmount! / 2 * 1e6);
    const minSolOut = 1; // Minimum SOL to receive
    
    const balanceBeforeSell = await connection.getBalance(wallet.publicKey);
    
    // @ts-ignore
    const sellTx = await program.methods
      .sell(new anchor.BN(tokensToSell), new anchor.BN(minSolOut))
      .accounts({
        seller: wallet.publicKey,
        bondingCurve: bondingCurvePDA,
        config: configPDA,
        mint: mintKeypair.publicKey,
        solVault: solVaultPDA,
        tokenVault: tokenVaultPDA,
        sellerTokenAccount: buyerTokenAccount,
        feeRecipient: config.feeRecipient,
        creator: curve.creator,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log(`   ✅ Sold! Tx: ${sellTx}`);
    
    const balanceAfterSell = await connection.getBalance(wallet.publicKey);
    const solReceived = (balanceAfterSell - balanceBeforeSell) / LAMPORTS_PER_SOL;
    console.log(`   SOL received (after fees): ${solReceived.toFixed(6)} SOL`);
    
    // Check final token balance
    const finalTokenBalance = await connection.getTokenAccountBalance(buyerTokenAccount);
    console.log(`   Remaining tokens: ${finalTokenBalance.value.uiAmount}`);
    
    // Final curve state
    // @ts-ignore
    const finalCurve = await (program.account as any).bondingCurve.fetch(bondingCurvePDA);
    console.log(`   Final curve SOL: ${finalCurve.realSolReserves.toString() / LAMPORTS_PER_SOL} SOL`);
    console.log(`   Final curve tokens: ${finalCurve.realTokenReserves.toString() / 1e6}\n`);
    
    console.log("🎉 All tests passed!");
    console.log(`\n📜 Explorer links:`);
    console.log(`   Create: https://explorer.solana.com/tx/${createTx}?cluster=devnet`);
    console.log(`   Buy: https://explorer.solana.com/tx/${buyTx}?cluster=devnet`);
    console.log(`   Sell: https://explorer.solana.com/tx/${sellTx}?cluster=devnet`);
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.logs) {
      console.error("Logs:", error.logs);
    }
  }
}

main().catch(console.error);
