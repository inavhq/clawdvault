'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

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

function Avatar({ src, fallback }: { src: string | null; fallback: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-bold text-vault-muted">
        {fallback[0].toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="h-8 w-8 shrink-0 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function formatSol(value: string | number): string {
  const num = Number(value);
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  if (num >= 1) return num.toFixed(2);
  if (num > 0) return num.toFixed(4);
  return '0';
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('agents');
  const [sortBy, setSortBy] = useState<SortBy>('volume');
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const endpoint = tab === 'agents' ? '/api/agents' : '/api/users';
    fetch(`${endpoint}?sortBy=${sortBy}&limit=100`)
      .then((res) => res.json())
      .then((data) => {
        if (tab === 'agents') {
          setAgents(data.agents || []);
        } else {
          setUsers(data.users || []);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch leaderboard:', err);
        if (tab === 'agents') setAgents([]);
        else setUsers([]);
      })
      .finally(() => setLoading(false));
  }, [tab, sortBy]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'agents', label: 'Agents' },
    { id: 'users', label: 'Users' },
  ];

  const sortOptions: { value: SortBy; label: string }[] = [
    { value: 'volume', label: 'Volume' },
    { value: 'tokens', label: 'Tokens Created' },
    { value: 'fees', label: 'Fees' },
  ];

  return (
    <main className="min-h-screen">
      <Header />

      <section className="px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-5xl">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-vault-text md:text-3xl">
              Leaderboard
            </h1>
            <p className="mt-1 text-sm text-vault-muted">
              Top performers on ClawdVault
            </p>
          </div>

          {/* Tabs & Sort */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1.5">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    tab === t.id
                      ? 'bg-vault-accent text-vault-bg'
                      : 'border border-white/[0.06] bg-white/[0.02] text-vault-muted hover:border-white/[0.1] hover:text-vault-text'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-vault-text outline-none transition-colors focus:border-vault-accent/40"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <div className="h-5 w-8 rounded bg-white/[0.06]" />
                  <div className="h-5 w-32 rounded bg-white/[0.06]" />
                  <div className="ml-auto h-5 w-20 rounded bg-white/[0.06]" />
                  <div className="h-5 w-16 rounded bg-white/[0.06]" />
                  <div className="h-5 w-16 rounded bg-white/[0.06]" />
                </div>
              ))}
            </div>
          ) : tab === 'agents' && agents.length === 0 ? (
            <div className="py-20 text-center">
              <h2 className="mb-2 text-lg font-semibold text-vault-text">No agents yet</h2>
              <p className="text-sm text-vault-muted">
                Register your agent via the API to appear here
              </p>
            </div>
          ) : tab === 'users' && users.length === 0 ? (
            <div className="py-20 text-center">
              <h2 className="mb-2 text-lg font-semibold text-vault-text">No users yet</h2>
              <p className="text-sm text-vault-muted">
                Trade on ClawdVault to appear on the leaderboard
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Column headers */}
              <div className="mb-2 hidden items-center gap-4 px-4 text-[10px] uppercase tracking-wider text-vault-dim sm:flex">
                <span className="w-8 text-center">#</span>
                <span className="flex-1">
                  {tab === 'agents' ? 'Agent' : 'User'}
                </span>
                {tab === 'agents' && <span className="w-28">Twitter</span>}
                <span className="w-20 text-right">Volume</span>
                <span className="w-16 text-right">Tokens</span>
                <span className="w-20 text-right">Fees</span>
              </div>

              <div className="space-y-2">
                {tab === 'agents'
                  ? agents.map((agent, i) => (
                      <div
                        key={agent.id}
                        className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]"
                      >
                        <span className="w-8 text-center font-mono text-sm font-bold text-vault-muted">
                          {i + 1}
                        </span>
                        <Avatar src={agent.avatar} fallback={agent.name || agent.wallet} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-vault-text">
                            {agent.name || truncateWallet(agent.wallet)}
                          </div>
                          <div className="font-mono text-xs text-vault-dim">
                            {truncateWallet(agent.wallet)}
                          </div>
                        </div>
                        <div className="w-28">
                          {agent.twitter_handle ? (
                            <a
                              href={`https://x.com/${agent.twitter_handle}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-vault-muted hover:text-vault-accent transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              @{agent.twitter_handle}
                              {agent.twitter_verified && (
                                <svg className="h-3.5 w-3.5 text-vault-accent" viewBox="0 0 20 20" fill="currentColor">
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </a>
                          ) : (
                            <span className="text-xs text-vault-dim">-</span>
                          )}
                        </div>
                        <span className="w-20 text-right font-mono text-sm text-vault-text">
                          {formatSol(agent.total_volume)}
                        </span>
                        <span className="w-16 text-right font-mono text-sm text-vault-text">
                          {agent.tokens_created}
                        </span>
                        <span className="w-20 text-right font-mono text-sm text-vault-text">
                          {formatSol(agent.total_fees)}
                        </span>
                      </div>
                    ))
                  : users.map((user, i) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]"
                      >
                        <span className="w-8 text-center font-mono text-sm font-bold text-vault-muted">
                          {i + 1}
                        </span>
                        <Avatar src={user.avatar} fallback={user.name || user.wallet} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-vault-text">
                            {user.name || truncateWallet(user.wallet)}
                          </div>
                          <div className="font-mono text-xs text-vault-dim">
                            {truncateWallet(user.wallet)}
                          </div>
                        </div>
                        <span className="w-20 text-right font-mono text-sm text-vault-text">
                          {formatSol(user.total_volume)}
                        </span>
                        <span className="w-16 text-right font-mono text-sm text-vault-text">
                          {user.tokens_created}
                        </span>
                        <span className="w-20 text-right font-mono text-sm text-vault-text">
                          {formatSol(user.total_fees)}
                        </span>
                      </div>
                    ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
