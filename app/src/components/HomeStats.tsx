'use client';

import { useState, useEffect, useRef } from 'react';
import { useAllTokens, useAllTrades } from '@/lib/supabase-client';

interface HomeStatsProps {
  initialTokens: number;
  initialGraduated: number;
  initialVolume: number;
  initialAgents: number;
  initialUsers: number;
  initialPageViews: number;
  solPrice: number | null;
}

export default function HomeStats({
  initialTokens,
  initialGraduated,
  initialVolume,
  initialAgents,
  initialUsers,
  initialPageViews,
  solPrice,
}: HomeStatsProps) {
  const [totalTokens, setTotalTokens] = useState(initialTokens);
  const [graduatedCount, setGraduatedCount] = useState(initialGraduated);
  const [totalVolume, setTotalVolume] = useState(initialVolume);
  const [agentCount, setAgentCount] = useState(initialAgents);
  const [userCount, setUserCount] = useState(initialUsers);
  const [pageViews, setPageViews] = useState(initialPageViews);
  const tracked = useRef(false);

  // Fire page view beacon + refresh stats from API on mount
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    setPageViews((prev) => prev + 1);
    fetch('/api/track', { method: 'POST' }).catch(() => {});

    // Hydrate from API (catches any drift from SSR snapshot)
    fetch('/api/site-stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.totalTokens !== undefined) setTotalTokens(data.totalTokens);
        if (data.graduatedCount !== undefined) setGraduatedCount(data.graduatedCount);
        if (data.totalVolume !== undefined) setTotalVolume(data.totalVolume);
        if (data.agentCount !== undefined) setAgentCount(data.agentCount);
        if (data.userCount !== undefined) setUserCount(data.userCount);
        if (data.pageViews !== undefined) setPageViews(data.pageViews + 1); // +1 for this visit
      })
      .catch(() => {});
  }, []);

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
    { label: 'Site Visits', value: pageViews.toLocaleString(), color: 'text-vault-muted' },
    { label: '24h Volume', value: formatValue(totalVolume), color: 'text-vault-text' },
    { label: 'Tokens Launched', value: totalTokens.toLocaleString(), color: 'text-vault-accent' },
    { label: 'Graduated', value: graduatedCount.toLocaleString(), color: 'text-vault-green' },
    { label: 'Registered Agents', value: agentCount.toLocaleString(), color: 'text-vault-accent' },
    { label: 'Users', value: userCount.toLocaleString(), color: 'text-vault-text' },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.04] sm:grid-cols-3 md:grid-cols-6">
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
