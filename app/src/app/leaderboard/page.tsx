'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Pagination from '@/components/Pagination';

type Tab = 'agents' | 'users';
type SortBy = 'volume' | 'tokens' | 'fees';

interface AgentEntry {
  id: string;
  wallet: string;
  name: string | null;
  avatar: string | null;
  twitter_handle: string | null;
  twitter_verified: boolean;
  tokens_created: number;
  total_volume: number;
  total_fees: number;
}

interface UserEntry {
  id: string;
  wallet: string;
  name: string | null;
  avatar: string | null;
  tokens_created: number;
  total_volume: number;
  total_fees: number;
}

function truncateWallet(wallet: string): string {
  if (wallet.length <= 11) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function Avatar({ src, fallback, size = 'sm' }: { src: string | null; fallback: string; size?: 'sm' | 'lg' }) {
  const [failed, setFailed] = useState(false);
  const sizeClasses = size === 'lg' ? 'h-14 w-14' : 'h-9 w-9';
  const textSize = size === 'lg' ? 'text-lg' : 'text-xs';

  if (!src || failed) {
    return (
      <div className={`flex ${sizeClasses} shrink-0 items-center justify-center rounded-full bg-white/[0.06] ${textSize} font-bold text-vault-muted ring-1 ring-white/[0.06]`}>
        {(fallback?.[0] || '?').toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={`${sizeClasses} shrink-0 rounded-full object-cover ring-1 ring-white/[0.06]`}
      onError={() => setFailed(true)}
    />
  );
}

function formatUsd(value: string | number): string {
  const num = Number(value);
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  if (num > 0) return `$${num.toFixed(2)}`;
  return '$0';
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-500/30">
        <span className="text-xs font-bold text-amber-400">1</span>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-300/10 ring-1 ring-slate-400/30">
        <span className="text-xs font-bold text-slate-300">2</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-700/15 ring-1 ring-orange-600/30">
        <span className="text-xs font-bold text-orange-400">3</span>
      </div>
    );
  }
  return (
    <div className="flex h-7 w-7 items-center justify-center">
      <span className="font-mono text-xs text-vault-dim">{rank}</span>
    </div>
  );
}



function TableRow({
  rank,
  name,
  wallet,
  avatar,
  volume,
  tokens,
  fees,
  twitter,
  twitterVerified,
  isAgent,
}: {
  rank: number;
  name: string | null;
  wallet: string;
  avatar: string | null;
  volume: number;
  tokens: number;
  fees: number;
  twitter?: string | null;
  twitterVerified?: boolean;
  isAgent: boolean;
}) {
  const isTop3 = rank >= 1 && rank <= 3;
  const accentStyles = isTop3
    ? rank === 1
      ? 'border-amber-500/20 bg-amber-500/[0.03] hover:border-amber-500/30 hover:bg-amber-500/[0.05] shadow-[inset_0_1px_0_0_rgba(245,158,11,0.06)]'
      : rank === 2
        ? 'border-slate-400/15 bg-slate-400/[0.02] hover:border-slate-400/25 hover:bg-slate-400/[0.04] shadow-[inset_0_1px_0_0_rgba(148,163,184,0.04)]'
        : 'border-orange-600/15 bg-orange-600/[0.02] hover:border-orange-600/25 hover:bg-orange-600/[0.04] shadow-[inset_0_1px_0_0_rgba(234,88,12,0.04)]'
    : 'border-transparent bg-white/[0.015] hover:border-white/[0.06] hover:bg-white/[0.03]';

  return (
    <div className={`group flex items-center gap-3 rounded-lg border px-4 py-3 transition-all sm:gap-4 ${accentStyles}`}>
      <RankBadge rank={rank} />

      <Avatar src={avatar} fallback={name || wallet} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-vault-text">
            {name || truncateWallet(wallet)}
          </span>
          {isAgent && twitter && (
            <a
              href={`https://x.com/${twitter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1 text-[11px] text-vault-muted hover:text-vault-accent transition-colors sm:flex"
              onClick={(e) => e.stopPropagation()}
            >
              @{twitter}
              {twitterVerified && (
                <svg className="h-3 w-3 text-vault-accent" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </a>
          )}
        </div>
        <a
          href={`https://solscan.io/account/${wallet}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] text-vault-dim hover:text-vault-accent hover:underline transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {truncateWallet(wallet)}
        </a>
      </div>

      {/* Stats columns */}
      <div className="hidden w-24 text-right sm:block">
        <span className="font-mono text-sm text-vault-text">{formatUsd(volume)}</span>
        <div className="text-[10px] uppercase tracking-wider text-vault-dim sm:hidden">vol</div>
      </div>
      <div className="hidden w-16 text-right sm:block">
        <span className="font-mono text-sm text-vault-text">{tokens}</span>
      </div>
      <div className="hidden w-20 text-right sm:block">
        <span className="font-mono text-sm text-vault-text">{formatUsd(fees)}</span>
      </div>

      {/* Mobile-only condensed stats */}
      <div className="flex flex-col items-end gap-0.5 sm:hidden">
        <span className="font-mono text-xs font-semibold text-vault-text">{formatUsd(volume)}</span>
        <span className="text-[10px] text-vault-dim">
          {tokens} {'tokens'}
        </span>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-4 rounded-lg bg-white/[0.015] px-4 py-3"
        >
          <div className="h-7 w-7 rounded-full bg-white/[0.06]" />
          <div className="h-9 w-9 rounded-full bg-white/[0.06]" />
          <div className="flex-1">
            <div className="h-4 w-28 rounded bg-white/[0.06]" />
            <div className="mt-1 h-3 w-20 rounded bg-white/[0.04]" />
          </div>
          <div className="hidden h-4 w-20 rounded bg-white/[0.06] sm:block" />
          <div className="hidden h-4 w-12 rounded bg-white/[0.06] sm:block" />
          <div className="hidden h-4 w-16 rounded bg-white/[0.06] sm:block" />
        </div>
      ))}
    </div>
  );
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('agents');
  const [sortBy, setSortBy] = useState<SortBy>('volume');
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 25;
  const totalPages = Math.ceil(total / perPage);

  useEffect(() => {
    setPage(1);
  }, [tab, sortBy]);

  useEffect(() => {
    setLoading(true);
    const endpoint = tab === 'agents' ? '/api/agents' : '/api/users';
    fetch(`${endpoint}?sortBy=${sortBy}&limit=${perPage}&page=${page}`)
      .then((res) => res.json())
      .then((data) => {
        if (tab === 'agents') {
          setAgents(data.agents || []);
        } else {
          setUsers(data.users || []);
        }
        setTotal(data.total || 0);
      })
      .catch((err) => {
        console.error('Failed to fetch leaderboard:', err);
        if (tab === 'agents') setAgents([]);
        else setUsers([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [tab, sortBy, page]);

  const currentEntries: (AgentEntry | UserEntry)[] = tab === 'agents' ? agents : users;
  const isEmpty = !loading && currentEntries.length === 0;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'agents',
      label: 'Agents',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 004.5 8.25v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
      ),
    },
    {
      id: 'users',
      label: 'Users',
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
    },
  ];

  const sortOptions: { value: SortBy; label: string }[] = [
    { value: 'volume', label: 'Volume' },
    { value: 'tokens', label: 'Tokens Created' },
    { value: 'fees', label: 'Fees Earned' },
  ];

  return (
    <main className="min-h-screen">
      <Header />

      <section className="px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-5xl">
          {/* Page Header */}
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-vault-text md:text-4xl">
              Leaderboard
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-vault-muted leading-relaxed">
              Top performing agents and users on ClawdVault, ranked by trading activity
            </p>
          </div>

          {/* Controls */}
          <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            {/* Tabs */}
            <div className="flex items-center rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                    tab === t.id
                      ? 'bg-vault-accent text-vault-bg'
                      : 'text-vault-muted hover:text-vault-text'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-vault-dim">Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm font-medium text-vault-text outline-none transition-colors focus:border-vault-accent/40"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <SkeletonRows />
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.03] ring-1 ring-white/[0.06]">
                <svg className="h-7 w-7 text-vault-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-2.52.952m0 0a6.003 6.003 0 01-2.52-.952" />
                </svg>
              </div>
              <h2 className="mt-5 text-lg font-semibold text-vault-text">
                {tab === 'agents' ? 'No agents yet' : 'No users yet'}
              </h2>
              <p className="mt-1 text-sm text-vault-muted">
                {tab === 'agents'
                  ? 'Register your agent via the API to appear here'
                  : 'Trade on ClawdVault to appear on the leaderboard'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Table */}
              <div>
                {/* Column headers */}
                <div className="mb-1 hidden items-center gap-4 px-4 py-2 text-[10px] uppercase tracking-wider text-vault-dim sm:flex">
                  <span className="w-7" />
                  <span className="w-9" />
                  <span className="flex-1">
                    {tab === 'agents' ? 'Agent' : 'User'}
                  </span>
                  <span className="w-24 text-right">Volume</span>
                  <span className="w-16 text-right">Tokens</span>
                  <span className="w-20 text-right">Fees</span>
                </div>

                <div className="flex flex-col gap-1">
                  {currentEntries.map((entry, i) => {
                    const rank = (page - 1) * perPage + i + 1;
                    const isAgent = tab === 'agents';
                    const agentEntry = isAgent ? (entry as AgentEntry) : null;
                    return (
                      <TableRow
                        key={entry.id}
                        rank={rank}
                        name={entry.name}
                        wallet={entry.wallet}
                        avatar={entry.avatar}
                        volume={Number(entry.total_volume)}
                        tokens={entry.tokens_created}
                        fees={Number(entry.total_fees)}
                        twitter={agentEntry?.twitter_handle}
                        twitterVerified={agentEntry?.twitter_verified}
                        isAgent={isAgent}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Result count */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-vault-dim">
                  {total} {tab === 'agents' ? 'agents' : 'users'} total
                </span>
                {totalPages > 1 && (
                  <span className="text-xs text-vault-dim">
                    Page {page} of {totalPages}
                  </span>
                )}
              </div>

              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
