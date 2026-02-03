/**
 * Client-side Solana RPC utilities
 * These run in the browser to avoid rate limiting on our server
 */
import { PublicKey } from '@solana/web3.js';

// Public RPC endpoints (client can use these directly)
// Note: Solana Labs public RPCs block browser requests (CORS/403)
// Client-side code should use our API endpoints instead
const RPC_ENDPOINTS = {
  devnet: 'https://api.devnet.solana.com',
  mainnet: 'https://api.mainnet-beta.solana.com', // May fail client-side due to CORS
};

// Get RPC URL based on network
// NOTE: Client-side uses public RPCs to avoid leaking API keys
export function getRpcUrl(): string {
  // Server-side can use private RPC with API key
  if (typeof window === 'undefined') {
    const serverRpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
    if (serverRpc) return serverRpc;
  }
  
  // Client-side: use public RPCs only (no API keys!)
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
  if (network === 'mainnet-beta') {
    return RPC_ENDPOINTS.mainnet; // Public mainnet RPC
  }
  return RPC_ENDPOINTS.devnet;
}

// ClawdVault Program ID
const PROGRAM_ID = new PublicKey('GUyF2TVe32Cid4iGVt2F6wPYDhLSVmTUZBj2974outYM');
const CURVE_SEED = Buffer.from('bonding_curve');

// Derive bonding curve PDA for a given mint
function findBondingCurvePDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [CURVE_SEED, mint.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

// Legacy platform wallet (for old tokens before Anchor)
export const PLATFORM_WALLET = '3X8b5mRCzvvyVXarimyujxtCZ1Epn22oXVWbzUoxWKRH';

interface TokenHolder {
  address: string;
  balance: number;
  percentage: number;
  label?: string;
}

/**
 * Fetch token holders directly from Solana RPC (client-side)
 */
export async function fetchHoldersClient(
  mint: string, 
  creator?: string
): Promise<{
  holders: TokenHolder[];
  totalSupply: number;
  circulatingSupply: number;
}> {
  const rpcUrl = getRpcUrl();
  
  // Get largest token accounts
  const largestResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenLargestAccounts',
      params: [mint],
    }),
  });
  const largestData = await largestResponse.json();
  
  // Get total supply
  const supplyResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'getTokenSupply',
      params: [mint],
    }),
  });
  const supplyData = await supplyResponse.json();
  
  const totalSupply = parseFloat(supplyData.result?.value?.uiAmountString || '1000000000');
  const accounts = largestData.result?.value || [];
  
  // Get owner for each account (batch request)
  const ownerRequests = accounts.map((acc: any, i: number) => ({
    jsonrpc: '2.0',
    id: i + 10,
    method: 'getAccountInfo',
    params: [acc.address, { encoding: 'jsonParsed' }],
  }));
  
  const ownersResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ownerRequests),
  });
  const ownersData = await ownersResponse.json();
  
  // Derive the bonding curve PDA for this mint
  const mintPubkey = new PublicKey(mint);
  const bondingCurvePDA = findBondingCurvePDA(mintPubkey).toBase58();
  
  // Process holders
  const holders: TokenHolder[] = [];
  let bondingCurveBalance = 0;
  
  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    const balance = parseFloat(acc.uiAmountString || '0');
    if (balance === 0) continue;
    
    // Find the matching response for this account
    let owner = acc.address; // Default to token account address
    try {
      const ownerInfo = Array.isArray(ownersData) 
        ? ownersData.find((r: any) => r.id === i + 10)
        : (i === 0 ? ownersData : null);
      
      if (ownerInfo?.result?.value?.data?.parsed?.info?.owner) {
        owner = ownerInfo.result.value.data.parsed.info.owner;
      }
    } catch (e) {
      console.warn('Failed to get owner for account:', acc.address);
    }
    
    const percentage = (balance / totalSupply) * 100;
    // Check if owner is the bonding curve PDA or legacy platform wallet
    const isBondingCurve = owner === bondingCurvePDA || owner === PLATFORM_WALLET;
    const isCreator = creator && owner === creator;
    
    if (isBondingCurve) {
      bondingCurveBalance = balance;
    }
    
    let label: string | undefined;
    if (isBondingCurve) label = 'Liquidity Pool';
    else if (isCreator) label = 'Creator (dev)';
    
    holders.push({ address: owner, balance, percentage, label });
  }
  
  // Sort by balance
  holders.sort((a, b) => b.balance - a.balance);
  
  return {
    holders: holders.slice(0, 10),
    totalSupply,
    circulatingSupply: totalSupply - bondingCurveBalance,
  };
}

/**
 * Fetch token balance for a wallet (client-side)
 */
export async function fetchBalanceClient(
  mint: string,
  wallet: string
): Promise<number> {
  const rpcUrl = getRpcUrl();
  
  // Get token accounts for wallet
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        wallet,
        { mint },
        { encoding: 'jsonParsed' },
      ],
    }),
  });
  const data = await response.json();
  
  const accounts = data.result?.value || [];
  if (accounts.length === 0) return 0;
  
  // Sum up balances (usually just one account)
  let total = 0;
  for (const acc of accounts) {
    total += parseFloat(acc.account?.data?.parsed?.info?.tokenAmount?.uiAmountString || '0');
  }
  
  return total;
}

/**
 * Get SOL balance for a wallet (client-side)
 */
export async function fetchSolBalanceClient(wallet: string): Promise<number> {
  const rpcUrl = getRpcUrl();
  
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [wallet],
    }),
  });
  const data = await response.json();
  
  const lamports = data.result?.value || 0;
  return lamports / 1_000_000_000; // Convert to SOL
}
