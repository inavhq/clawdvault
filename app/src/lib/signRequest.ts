import bs58 from 'bs58';

/**
 * Wallet interface matching our WalletContext
 */
interface WalletInterface {
  publicKey: string | null;
  signMessage: (message: string) => Promise<Uint8Array | null>;
}

/**
 * Create the message format that the server expects
 */
export function createSignableMessage(action: string, data: Record<string, unknown>): string {
  const timestamp = Math.floor(Date.now() / 1000);
  // Round to 5-minute windows to match server
  const window = Math.floor(timestamp / 300) * 300;
  return `ClawdVault:${action}:${window}:${JSON.stringify(data)}`;
}

/**
 * Sign a request with the connected wallet
 * Returns headers to include in the fetch request
 */
export async function signRequest(
  wallet: WalletInterface,
  action: string,
  data: Record<string, unknown>
): Promise<{ 'X-Wallet': string; 'X-Signature': string } | null> {
  if (!wallet.publicKey || !wallet.signMessage) {
    console.error('Wallet not connected or does not support signing');
    return null;
  }

  try {
    const message = createSignableMessage(action, data);
    const signature = await wallet.signMessage(message);
    
    if (!signature) {
      console.error('Wallet returned null signature');
      return null;
    }
    
    return {
      'X-Wallet': wallet.publicKey,
      'X-Signature': bs58.encode(signature),
    };
  } catch (error) {
    console.error('Failed to sign request:', error);
    return null;
  }
}

/**
 * Make an authenticated POST request
 */
export async function authenticatedPost(
  wallet: WalletInterface,
  url: string,
  action: string,
  data: Record<string, unknown>
): Promise<Response> {
  const authHeaders = await signRequest(wallet, action, data);
  
  if (!authHeaders) {
    throw new Error('Failed to sign request - wallet may have rejected');
  }

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(data),
  });
}

/**
 * Make an authenticated DELETE request
 */
export async function authenticatedDelete(
  wallet: WalletInterface,
  url: string,
  action: string,
  signedData: Record<string, unknown>
): Promise<Response> {
  const authHeaders = await signRequest(wallet, action, signedData);
  
  if (!authHeaders) {
    throw new Error('Failed to sign request - wallet may have rejected');
  }

  return fetch(url, {
    method: 'DELETE',
    headers: {
      ...authHeaders,
    },
  });
}
