'use client';

import { useState, useRef, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';

function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function WalletButton() {
  const { connected, connecting, publicKey, balance, connect, disconnect } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!connected) {
    return (
      <button
        onClick={connect}
        disabled={connecting}
        className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
      >
        {connecting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <span>👻</span>
            Connect Wallet
          </>
        )}
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
      >
        <div className="w-2 h-2 bg-green-400 rounded-full" />
        <span>{shortenAddress(publicKey!)}</span>
        {balance !== null && (
          <span className="text-gray-400 text-sm">
            {balance.toFixed(2)} SOL
          </span>
        )}
        <span className="text-gray-500">▼</span>
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <div className="text-gray-400 text-xs mb-1">Connected Wallet</div>
            <div className="text-white font-mono text-sm break-all">{publicKey}</div>
          </div>
          
          <div className="p-4 border-b border-gray-700">
            <div className="text-gray-400 text-xs mb-1">Balance</div>
            <div className="text-white text-lg font-semibold">
              {balance !== null ? `${balance.toFixed(4)} SOL` : 'Loading...'}
            </div>
          </div>

          <div className="p-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(publicKey!);
                setShowDropdown(false);
              }}
              className="w-full text-left px-3 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition flex items-center gap-2"
            >
              <span>📋</span>
              Copy Address
            </button>
            <a
              href={`https://solscan.io/account/${publicKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-left px-3 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition flex items-center gap-2 block"
              onClick={() => setShowDropdown(false)}
            >
              <span>🔍</span>
              View on Solscan
            </a>
            <button
              onClick={() => {
                disconnect();
                setShowDropdown(false);
              }}
              className="w-full text-left px-3 py-2 text-red-400 hover:bg-gray-700 rounded-lg transition flex items-center gap-2"
            >
              <span>🚪</span>
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
