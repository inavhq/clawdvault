'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Token, TokenListResponse } from '@/lib/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Pagination from '@/components/Pagination';
import { useAllTokens } from '@/lib/supabase-client';
import { useWallet } from '@/contexts/WalletContext';
import { useSolPrice } from '@/hooks/useSolPrice';

type FilterTab = 'all' | 'trending' | 'new' | 'near_grad' | 'graduated';

export default function TokensPage() {
  const { connected, publicKey } = useWallet();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('created_at');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [page, setPage] = useState(1);
  const [totalTokens, setTotalTokens] = useState(0);
  const perPage = 20;
  const totalPages = Math.ceil(totalTokens / perPage);
  const { price: solPrice } = useSolPrice();
  const [_walletBalances, setWalletBalances] = useState<Record<string, number>>({});
  const [_balancesLoading, setBalancesLoading] = useState(false);

  const fetchWalletBalances = useCallback(async () => {
    if (!connected || !publicKey) {
      setWalletBalances({});
      return;
    }
    setBalancesLoading(true);
    try {
      const res = await fetch(`/api/wallet/balances?wallet=${publicKey}`);
      const data = await res.json();
      if (data.success) setWalletBalances(data.balances || {});
    } catch (err) {
      console.warn('Failed to fetch wallet balances:', err);
      setWalletBalances({});
    } finally {
      setBalancesLoading(false);
    }
  }, [connected, publicKey]);

  // Reset page when sort or filter changes
  useEffect(() => {
    setPage(1);
  }, [sort, filter]);

  useEffect(() => {
    fetchTokens();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, page]);

  useAllTokens(
    (newToken) => setTokens((prev) => [newToken, ...prev]),
    (updatedToken) =>
      setTokens((prev) =>
        prev.map((t) => (t.mint === updatedToken.mint ? { ...t, ...updatedToken } : t))
      )
  );

  useEffect(() => {
    fetchWalletBalances();
  }, [fetchWalletBalances]);

  const fetchTokens = async () => {
    try {
      const res = await fetch(`/api/tokens?sort=${sort}&page=${page}&per_page=${perPage}`);
      const data: TokenListResponse = await res.json();
      setTokens(data.tokens || []);
      setTotalTokens(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch tokens:', err);
      setTokens([]);
      setTotalTokens(0);
    } finally {
      setLoading(false);
    }
  };

  const filteredTokens = useMemo(() => {
    if (!tokens || !Array.isArray(tokens)) return [];
    let result = [...tokens];

    switch (filter) {
      case 'trending':
        result = result.sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0)).slice(0, 20);
        break;
      case 'new':
        result = result.filter((t) => {
          const created = new Date(t.created_at);
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return created > dayAgo;
        });
        break;
      case 'near_grad': {
        const GRADUATION_SOL = 85;
        const INITIAL_SOL = 30;
        result = result
          .filter((t) => !t.graduated)
          .filter((t) => {
            const virtualSol = Number(t.virtual_sol_reserves || 0);
            const progress = ((virtualSol - INITIAL_SOL) / (GRADUATION_SOL - INITIAL_SOL)) * 100;
            return progress >= 60;
          })
          .sort((a, b) => Number(b.virtual_sol_reserves || 0) - Number(a.virtual_sol_reserves || 0));
        break;
      }
      case 'graduated':
        result = result.filter((t) => t.graduated);
        break;
    }

    if (search.trim()) {
      const query = search.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.symbol.toLowerCase().includes(query) ||
          t.name.toLowerCase().includes(query) ||
          t.mint.toLowerCase().includes(query) ||
          (t.creator_name && t.creator_name.toLowerCase().includes(query))
      );
    }

    return result;
  }, [tokens, filter, search]);

  const formatMcap = (mcapSol: number, mcapUsd?: number) => {
    if (mcapUsd !== undefined && mcapUsd !== null) {
      if (mcapUsd >= 1000000) return '$' + (mcapUsd / 1000000).toFixed(1) + 'M';
      if (mcapUsd >= 1000) return '$' + (mcapUsd / 1000).toFixed(1) + 'K';
      return '$' + mcapUsd.toFixed(0);
    }
    if (solPrice !== null) {
      const usd = mcapSol * solPrice;
      if (usd >= 1000000) return '$' + (usd / 1000000).toFixed(1) + 'M';
      if (usd >= 1000) return '$' + (usd / 1000).toFixed(1) + 'K';
      return '$' + usd.toFixed(0);
    }
    if (mcapSol >= 1000) return (mcapSol / 1000).toFixed(1) + 'K SOL';
    return mcapSol.toFixed(2) + ' SOL';
  };

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  // Bonding curve progress
  const getBondingProgress = (token: Token) => {
    if (token.graduated) return 100;
    const GRADUATION_SOL = 85;
    const INITIAL_SOL = 30;
    const virtualSol = Number(token.virtual_sol_reserves || 0);
    return Math.min(((virtualSol - INITIAL_SOL) / (GRADUATION_SOL - INITIAL_SOL)) * 100, 100);
  };

  // Has recent activity (trade within last 5 min)
  const hasRecentActivity = (token: Token) => {
    if (!token.last_trade_at) return false;
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    return new Date(token.last_trade_at).getTime() > fiveMinAgo;
  };

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'trending', label: 'Trending' },
    { id: 'new', label: 'New' },
    { id: 'near_grad', label: 'Near Graduation' },
    { id: 'graduated', label: 'Graduated' },
  ];

  return (
    <main className="min-h-screen">
      <Header />

      <section className="px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-7xl">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-vault-text md:text-3xl">
              Browse Tokens
            </h1>
            <p className="mt-1 text-sm text-vault-muted">
              {tokens.length} tokens on ClawdVault
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative mb-6">
            <svg
              className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-vault-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, symbol, mint, or creator..."
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] py-3 pl-11 pr-10 text-sm text-vault-text placeholder-vault-dim outline-none transition-colors focus:border-vault-accent/40 focus:bg-white/[0.04]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-vault-muted transition-colors hover:text-vault-text"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filters & Sort */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    filter === tab.id
                      ? 'bg-vault-accent text-vault-bg'
                      : 'border border-white/[0.06] bg-white/[0.02] text-vault-muted hover:border-white/[0.1] hover:text-vault-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-vault-text outline-none transition-colors focus:border-vault-accent/40"
            >
              <option value="created_at">Newest</option>
              <option value="market_cap">Market Cap</option>
              <option value="volume">24h Volume</option>
              <option value="price">Price</option>
              <option value="price_change">24h Change</option>
            </select>
          </div>

          {/* Results count */}
          {search && (
            <p className="mb-4 text-xs text-vault-muted">
              {filteredTokens.length} result{filteredTokens.length !== 1 ? 's' : ''} for &quot;{search}&quot;
            </p>
          )}

          {/* Content */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-white/[0.06]" />
                    <div className="flex-1">
                      <div className="mb-1.5 h-4 w-20 rounded bg-white/[0.06]" />
                      <div className="h-3 w-14 rounded bg-white/[0.04]" />
                    </div>
                  </div>
                  <div className="mb-3 h-5 w-16 rounded bg-white/[0.06]" />
                  <div className="h-1 w-full rounded-full bg-white/[0.04]" />
                </div>
              ))}
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="py-20 text-center">
              {search ? (
                <>
                  <h2 className="mb-2 text-lg font-semibold text-vault-text">No tokens found</h2>
                  <p className="mb-4 text-sm text-vault-muted">Try a different search term</p>
                  <button
                    onClick={() => setSearch('')}
                    className="text-sm font-medium text-vault-accent transition-colors hover:text-vault-accent-hover"
                  >
                    Clear search
                  </button>
                </>
              ) : filter !== 'all' ? (
                <>
                  <h2 className="mb-2 text-lg font-semibold text-vault-text">
                    No {tabs.find((t) => t.id === filter)?.label.toLowerCase()} tokens
                  </h2>
                  <button
                    onClick={() => setFilter('all')}
                    className="text-sm font-medium text-vault-accent transition-colors hover:text-vault-accent-hover"
                  >
                    View all tokens
                  </button>
                </>
              ) : (
                <>
                  <h2 className="mb-2 text-lg font-semibold text-vault-text">No tokens yet</h2>
                  <p className="mb-4 text-sm text-vault-muted">Be the first to launch</p>
                  <Link
                    href="/create"
                    className="inline-flex items-center gap-2 rounded-lg bg-vault-accent px-5 py-2.5 text-sm font-semibold text-vault-bg transition hover:bg-vault-accent-hover"
                  >
                    Create Token
                  </Link>
                </>
              )}
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredTokens.map((token) => {
                const progress = getBondingProgress(token);
                const isActive = hasRecentActivity(token);
                // Compute change from streamed price_24h_ago + current price, fallback to API value
                const change = token.price_24h_ago && token.price_usd && token.price_24h_ago > 0
                  ? ((token.price_usd - token.price_24h_ago) / token.price_24h_ago) * 100
                  : token.price_change_24h ?? null;

                return (
                  <Link
                    key={token.mint}
                    href={`/tokens/${token.mint}`}
                    className={`group relative rounded-xl border bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04] ${
                      isActive
                        ? 'border-vault-accent/20 animate-pulse-border'
                        : 'border-white/[0.06] hover:border-vault-accent/20'
                    }`}
                  >
                    {/* Header row */}
                    <div className="mb-3 flex items-center gap-3">
                      {token.image ? (
                        <img
                          src={token.image}
                          alt={token.name}
                          className="h-10 w-10 rounded-lg object-cover ring-1 ring-white/[0.06] transition-all group-hover:ring-vault-accent/30"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vault-accent/10 text-sm font-bold text-vault-accent">
                          {token.symbol?.[0] || '?'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-vault-text">
                            {token.name}
                          </span>
                          {token.graduated && (
                            <span className="shrink-0 rounded bg-vault-green/10 px-1 py-0.5 text-[9px] font-medium text-vault-green">
                              GRAD
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-vault-muted">${token.symbol}</span>
                      </div>
                      <span className="shrink-0 text-[10px] text-vault-dim">
                        {formatTimeAgo(token.created_at)}
                      </span>
                    </div>

                    {/* Market cap + change */}
                    <div className="mb-3 flex items-end justify-between">
                      <div>
                        <div className="font-mono text-lg font-semibold text-vault-green">
                          {formatMcap(token.market_cap_sol, token.market_cap_usd)}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-vault-dim">mcap</div>
                      </div>
                      {change !== null && change !== undefined && (
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-xs font-medium ${
                            change >= 0
                              ? 'bg-vault-green/10 text-vault-green'
                              : 'bg-vault-red/10 text-vault-red'
                          }`}
                        >
                          {change >= 0 ? '+' : ''}
                          {change.toFixed(1)}%
                        </span>
                      )}
                    </div>

                    {/* Bonding curve progress */}
                    {!token.graduated && (
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[10px] text-vault-dim">Bonding Curve</span>
                          <span className="font-mono text-[10px] text-vault-muted">
                            {progress.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-vault-accent/70 transition-all"
                            style={{ width: `${Math.max(progress, 2)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>

            {filter === 'all' && !search.trim() && (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
