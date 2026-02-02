/**
 * Initialize ClawdVault Protocol
 * Run after deploying the program
 * 
 * Usage: npx ts-node scripts/initialize.ts [network]
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, Connection, clusterApiUrl } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

// Load IDL
const IDL = require("../target/idl/clawdvault.json");

async function main() {
  const network = process.argv[2] || "devnet";
  console.log(`🐺 Initializing ClawdVault on ${network}...`);
  
  // Connect to network
  const endpoint = network === "mainnet" 
    ? "https://api.mainnet-beta.solana.com"
    : clusterApiUrl("devnet");
  const connection = new Connection(endpoint, "confirmed");
  
  // Load wallet
  const walletPath = process.env.ANCHOR_WALLET || 
    path.join(process.env.HOME!, ".config/solana/id.json");
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  console.log(`💰 Authority: ${walletKeypair.publicKey.toBase58()}`);
  
  // Fee recipient (Keitsu's wallet)
  const feeRecipient = new PublicKey(
    process.env.FEE_RECIPIENT || "7b9191rMLP8yZaKYudWiFtFZwtaEYX5Tyy2hZeEKDyWq"
  );
  console.log(`🎁 Fee recipient: ${feeRecipient.toBase58()}`);
  
  // Load program ID from keypair
  const programKeypairPath = path.join(__dirname, "../target/deploy/clawdvault-keypair.json");
  const programKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(programKeypairPath, "utf-8")))
  );
  const programId = programKeypair.publicKey;
  console.log(`📜 Program ID: ${programId.toBase58()}`);
  
  // Create provider
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);
  
  // Load program (anchor 0.32+ API)
  const program = new Program(IDL, provider);
  
  // Find config PDA
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
  console.log(`⚙️  Config PDA: ${configPDA.toBase58()}`);
  
  // Check if already initialized
  try {
    const config = await (program.account as any).config.fetch(configPDA);
    console.log("\n✅ Protocol already initialized!");
    console.log(`   Authority: ${config.authority.toBase58()}`);
    console.log(`   Fee recipient: ${config.feeRecipient.toBase58()}`);
    console.log(`   Total tokens created: ${config.totalTokensCreated.toString()}`);
    return;
  } catch (e) {
    // Not initialized yet, continue
  }
  
  // Initialize
  console.log("\n🚀 Initializing protocol...");
  
  // @ts-ignore
  const tx = await program.methods
    .initialize()
    .accounts({
      authority: walletKeypair.publicKey,
      feeRecipient: feeRecipient,
      config: configPDA,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  
  console.log(`✅ Initialized! Tx: ${tx}`);
  console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${network}`);
  
  // Verify
  const config = await (program.account as any).config.fetch(configPDA);
  console.log("\n📊 Protocol Config:");
  console.log(`   Authority: ${config.authority.toBase58()}`);
  console.log(`   Fee recipient: ${config.feeRecipient.toBase58()}`);
  console.log(`   Total tokens created: ${config.totalTokensCreated.toString()}`);
  
  console.log("\n🐺 Protocol ready! Let's print some tokens!");
}

main().catch(console.error);
