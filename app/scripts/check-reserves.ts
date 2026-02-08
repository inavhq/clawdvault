import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('GUyF2TVe32Cid4iGVt2F6wPYDhLSVmTUZBj2974outYM');

const tokens = [
  { name: 'ClawdVault', mint: 'B7KpChn4dxioeuNzzEY9eioUwEi5xt5KYegytRottJgZ' },
  { name: 'Shadow Wolf', mint: 'HBcnWuDkZAPZ3qSUy6e8UkPZM3cCvs72DmYZavCaBaeM' },
  { name: 'Crab', mint: 'UUELtRkR5C6Yd5qq5sZoWztFEFe6V73VbuYYXEqoQiQ' },
];

async function main() {
  const conn = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
  
  console.log('Initial state: 30 SOL virtual / 1,000,000,000 tokens\n');
  
  for (const token of tokens) {
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding_curve'), new PublicKey(token.mint).toBuffer()],
      PROGRAM_ID
    );
    
    const account = await conn.getAccountInfo(bondingCurve);
    if (!account) {
      console.log(`${token.name}: no account found`);
      continue;
    }
    
    // Parse bonding curve state
    // Skip 8-byte discriminator
    const data = account.data;
    let offset = 8;
    
    // mint: Pubkey (32)
    offset += 32;
    // creator: Pubkey (32)  
    offset += 32;
    // virtual_sol_reserves: u64
    const virtualSol = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
    offset += 8;
    // virtual_token_reserves: u64
    const virtualToken = Number(data.readBigUInt64LE(offset));
    offset += 8;
    // real_sol_reserves: u64
    const realSol = Number(data.readBigUInt64LE(offset)) / LAMPORTS_PER_SOL;
    offset += 8;
    // real_token_reserves: u64
    const realToken = Number(data.readBigUInt64LE(offset));
    
    const _initialBuySol = realSol; // real_sol = what was actually deposited
    const tokensBought = 1_000_000_000 - realToken;
    
    console.log(`=== ${token.name} ===`);
    console.log(`  Virtual: ${virtualSol.toFixed(4)} SOL / ${virtualToken.toLocaleString()} tokens`);
    console.log(`  Real: ${realSol.toFixed(6)} SOL / ${realToken.toLocaleString()} tokens`);
    console.log(`  Implied trades: ${realSol.toFixed(6)} SOL deposited → ${tokensBought.toLocaleString()} tokens bought\n`);
  }
}

main();
