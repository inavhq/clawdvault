'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface WalletContextType {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  balance: number | null; // SOL balance
  connect: () => Promise<void>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<Uint8Array | null>;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  connected: false,
  connecting: false,
  publicKey: null,
  balance: null,
  connect: async () => {},
  disconnect: () => {},
  signMessage: async () => null,
  refreshBalance: async () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

interface PhantomProvider {
  isPhantom: boolean;
  publicKey: { toString: () => string } | null;
  isConnected: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>;
  on: (event: string, callback: () => void) => void;
  off: (event: string, callback: () => void) => void;
}

declare global {
  interface Window {
    phantom?: {
      solana?: PhantomProvider;
    };
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const getProvider = useCallback((): PhantomProvider | null => {
    if (typeof window !== 'undefined' && window.phantom?.solana?.isPhantom) {
      return window.phantom.solana;
    }
    return null;
  }, []);

  // Fetch SOL balance
  const refreshBalance = useCallback(async () => {
    if (!publicKey) {
      setBalance(null);
      return;
    }

    // Try multiple RPCs in case of rate limiting
    // Priority: custom env > reliable free tiers > public endpoints
    const rpcUrls = [
      process.env.NEXT_PUBLIC_RPC_URL,
      'https://rpc.ankr.com/solana',                    // Ankr free tier - most reliable
      'https://solana.public-rpc.com',                  // Public RPC pool
      'https://api.mainnet-beta.solana.com',            // Official (heavily rate limited)
    ].filter(Boolean) as string[];

    for (const rpcUrl of rpcUrls) {
      try {
        console.log(`[Wallet] Trying RPC: ${rpcUrl}`);
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getBalance',
            params: [publicKey],
          }),
        });
        
        if (!response.ok) {
          console.warn(`[Wallet] RPC ${rpcUrl} returned ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        if (data.result?.value !== undefined) {
          // Convert lamports to SOL
          const solBalance = data.result.value / 1e9;
          console.log(`[Wallet] Balance fetched from ${rpcUrl}: ${solBalance} SOL`);
          setBalance(solBalance);
          return; // Success, stop trying
        }
        if (data.error) {
          console.warn(`[Wallet] RPC error from ${rpcUrl}:`, data.error);
        }
      } catch (err) {
        console.warn(`[Wallet] Failed to fetch from ${rpcUrl}:`, err);
      }
    }
    // If all RPCs failed, set balance to null (unknown) instead of 0
    console.error('[Wallet] All RPCs failed to fetch balance');
    setBalance(null);
  }, [publicKey]);

  // Connect wallet
  const connect = useCallback(async () => {
    console.log('[Wallet] Connect clicked');
    const provider = getProvider();
    
    if (!provider) {
      console.log('[Wallet] No Phantom provider found, opening phantom.app');
      window.open('https://phantom.app/', '_blank');
      return;
    }

    console.log('[Wallet] Phantom provider found, attempting connection...');
    
    try {
      setConnecting(true);
      const response = await provider.connect();
      const address = response.publicKey.toString();
      console.log('[Wallet] Connected successfully:', address);
      setPublicKey(address);
      setConnected(true);
      
      // Store in localStorage for reconnection
      localStorage.setItem('walletConnected', 'true');
    } catch (err: any) {
      console.error('[Wallet] Connection failed:', err);
      // User rejected or other error
      if (err?.code === 4001) {
        console.log('[Wallet] User rejected connection');
      }
    } finally {
      setConnecting(false);
    }
  }, [getProvider]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    const provider = getProvider();
    if (provider) {
      provider.disconnect();
    }
    setPublicKey(null);
    setConnected(false);
    setBalance(null);
    localStorage.removeItem('walletConnected');
  }, [getProvider]);

  // Sign message (for verification)
  const signMessage = useCallback(async (message: string): Promise<Uint8Array | null> => {
    const provider = getProvider();
    if (!provider || !connected) return null;

    try {
      const encodedMessage = new TextEncoder().encode(message);
      const { signature } = await provider.signMessage(encodedMessage, 'utf8');
      return signature;
    } catch (err) {
      console.error('Failed to sign message:', err);
      return null;
    }
  }, [getProvider, connected]);

  // Auto-reconnect on page load
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    // Check if was previously connected
    const wasConnected = localStorage.getItem('walletConnected') === 'true';
    
    if (wasConnected && provider.isConnected && provider.publicKey) {
      setPublicKey(provider.publicKey.toString());
      setConnected(true);
    }

    // Listen for account changes
    const handleAccountChange = () => {
      if (provider.publicKey) {
        setPublicKey(provider.publicKey.toString());
      } else {
        disconnect();
      }
    };

    provider.on('accountChanged', handleAccountChange);
    
    return () => {
      provider.off('accountChanged', handleAccountChange);
    };
  }, [getProvider, disconnect]);

  // Refresh balance when connected
  useEffect(() => {
    if (connected && publicKey) {
      refreshBalance();
      // Refresh every 30 seconds
      const interval = setInterval(refreshBalance, 30000);
      return () => clearInterval(interval);
    }
  }, [connected, publicKey, refreshBalance]);

  return (
    <WalletContext.Provider
      value={{
        connected,
        connecting,
        publicKey,
        balance,
        connect,
        disconnect,
        signMessage,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
