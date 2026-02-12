'use client';

import { useState } from 'react';
import { useAllTokens, useAllTrades } from '@/lib/supabase-client';

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
  solPrice,
}: HomeStatsProps) {
  const [totalTokens, setTotalTokens] = useState(initialTokens);
  const [graduatedCount, setGraduatedCount] = useState(initialGraduated);
  const [totalVolume, setTotalVolume] = useState(initialVolume);

  useAllTokens(
    () => setTotalTokens((prev) => prev + 1),
    (updatedToken) => {
      if (updatedToken.graduated) {
        setGraduatedCount((prev) => prev + 1);
      }
    }
  );

  useAllTrades((newTrade) => {
    const amount = newTrade.sol_amount || newTrade.solAmount || 0;
    setTotalVolume((prev) => prev + Number(amount));
  });

  const formatValue = (solAmount: number) => {
    if (solPrice !== null) {
      const usd = solAmount * solPrice;
      if (usd >= 1000000) return `$${(usd / 1000000).toFixed(1)}M`;
      if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}K`;
      return `$${usd.toFixed(0)}`;
    }
    return `${solAmount.toFixed(1)} SOL`;
  };

  const stats = [
    { label: 'Tokens Launched', value: totalTokens.toLocaleString(), color: 'text-vault-accent' },
    { label: 'Graduated', value: graduatedCount.toLocaleString(), color: 'text-vault-green' },
    { label: '24h Volume', value: formatValue(totalVolume), color: 'text-vault-text' },
    { label: 'Active Agents', value: '∞', color: 'text-vault-accent' },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.04] md:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-vault-bg px-4 py-5 text-center sm:px-6 sm:py-6"
        >
          <div className={`font-mono text-xl font-bold sm:text-2xl ${stat.color}`}>
            {stat.value}
          </div>
          <div className="mt-1 text-xs text-vault-muted">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
