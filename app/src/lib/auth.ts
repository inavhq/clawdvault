import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

/**
 * Verify a signed message from a Solana wallet
 * 
 * @param message - The original message that was signed
 * @param signature - Base58 encoded signature
 * @param publicKey - Wallet public key (base58 string)
 * @returns true if signature is valid
 */
export function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = new PublicKey(publicKey).toBytes();
    
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Create the message to sign for an authenticated action
 * Uses a timestamp to prevent replay attacks (valid for 5 minutes)
 */
export function createSignableMessage(action: string, data: Record<string, unknown>): string {
  const timestamp = Math.floor(Date.now() / 1000);
  // Round to 5-minute windows to allow for clock skew
  const window = Math.floor(timestamp / 300) * 300;
  return `ClawdVault:${action}:${window}:${JSON.stringify(data)}`;
}

/**
 * Verify a request is authenticated by the claimed wallet
 * 
 * @param wallet - Claimed wallet address
 * @param signature - Signature from wallet
 * @param action - Action being performed (e.g., "chat", "react")
 * @param data - Data being signed
 * @returns true if authenticated
 */
export function verifyWalletAuth(
  wallet: string,
  signature: string,
  action: string,
  data: Record<string, unknown>
): boolean {
  // Check current and previous time windows (10 min total validity)
  const now = Math.floor(Date.now() / 1000);
  const currentWindow = Math.floor(now / 300) * 300;
  const prevWindow = currentWindow - 300;
  
  const currentMessage = `ClawdVault:${action}:${currentWindow}:${JSON.stringify(data)}`;
  const prevMessage = `ClawdVault:${action}:${prevWindow}:${JSON.stringify(data)}`;
  
  return (
    verifySignature(currentMessage, signature, wallet) ||
    verifySignature(prevMessage, signature, wallet)
  );
}

/**
 * Extract and verify auth from request headers
 * Expected headers:
 * - X-Wallet: wallet public key (base58)
 * - X-Signature: signature of the action message (base58)
 */
export function extractAuth(request: Request): { wallet: string; signature: string } | null {
  const wallet = request.headers.get('X-Wallet');
  const signature = request.headers.get('X-Signature');
  
  if (!wallet || !signature) {
    return null;
  }
  
  // Validate wallet is a valid public key
  try {
    new PublicKey(wallet);
  } catch {
    return null;
  }
  
  return { wallet, signature };
}
