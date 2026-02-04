'use client';

import { useState, useEffect } from 'react';
import { subscribeToAllTokens, subscribeToAllTrades, unsubscribeChannel } from '@/lib/supabase-client';

interface HomeStatsProps {
  initialTokens: number;
  initialGraduated: number;
  initialVolume: number;
  solPrice: number | null;
}

export default function HomeStats({ 
  initialTokens, 
  initialGraduated, 
  initialVolume,
  solPrice 
}: HomeStatsProps) {
  const [totalTokens, setTotalTokens] = useState(initialTokens);
  const [graduatedCount, setGraduatedCount] = useState(initialGraduated);
  const [totalVolume, setTotalVolume] = useState(initialVolume);

  useEffect(() => {
    // Subscribe to token changes
    const tokenChannel = subscribeToAllTokens(
      // New token created
      () => {
        setTotalTokens(prev => prev + 1);
      },
      // Token updated (check for graduation)
      (updatedToken) => {
        if (updatedToken.graduated) {
          setGraduatedCount(prev => prev + 1);
        }
      }
    );

    // Subscribe to trades for volume
    const tradeChannel = subscribeToAllTrades(
      (newTrade) => {
        const amount = newTrade.sol_amount || newTrade.solAmount || 0;
        setTotalVolume(prev => prev + Number(amount));
      }
    );

    return () => {
      unsubscribeChannel(tokenChannel);
      unsubscribeChannel(tradeChannel);
    };
  }, []);

  const formatValue = (solAmount: number) => {
    if (solPrice !== null) {
      const usd = solAmount * solPrice;
      if (usd >= 1000000) return `$${(usd / 1000000).toFixed(1)}M`;
      if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}K`;
      return `$${usd.toFixed(0)}`;
    }
    return `${solAmount.toFixed(1)} SOL`;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-gray-800/30 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-orange-400">{totalTokens}</div>
        <div className="text-gray-500 text-sm">Tokens</div>
      </div>
      <div className="bg-gray-800/30 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-green-400">{graduatedCount}</div>
        <div className="text-gray-500 text-sm">Graduated</div>
      </div>
      <div className="bg-gray-800/30 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-blue-400">{formatValue(totalVolume)}</div>
        <div className="text-gray-500 text-sm">Volume</div>
      </div>
      <div className="bg-gray-800/30 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-purple-400">∞</div>
        <div className="text-gray-500 text-sm">Happy Moltys</div>
      </div>
    </div>
  );
}
