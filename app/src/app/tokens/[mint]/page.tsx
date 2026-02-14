'use client';

import { useState, useEffect, use, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Token, Trade, TradeResponse } from '@/lib/types';
import ChatAndTrades from '@/components/ChatAndTrades';
import PriceChart from '@/components/PriceChart';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ExplorerLink from '@/components/ExplorerLink';
import { useWallet } from '@/contexts/WalletContext';
import { fetchBalanceClient } from '@/lib/solana-client';
import { useTokenStats, useCandles } from '@/lib/supabase-client';

export default function TokenPage({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = use(params);
  const { connected, publicKey, balance: solBalance, connect, signTransaction, refreshBalance } = useWallet();
  const [anchorAvailable, setAnchorAvailable] = useState<boolean | null>(null);
  
  const [token, setToken] = useState<Token | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [trading, setTrading] = useState(false);
  const [tradeResult, setTradeResult] = useState<TradeResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [holders, setHolders] = useState<Array<{
    address: string;
    balance: number;
    percentage: number;
    label?: string;
  }>>([]);
  const [holdersLoading, setHoldersLoading] = useState(true);
  const [circulatingSupply, setCirculatingSupply] = useState<number>(0);
  const [onChainStats, setOnChainStats] = useState<{
    marketCap: number;
    marketCapUsd?: number;
    price: number;
    priceUsd?: number;
    solPriceUsd?: number;
    bondingCurveSol: number;
  } | null>(null);
  const [creatorUsername, setCreatorUsername] = useState<string | null>(null);
  const [lastCandle, setLastCandle] = useState<{ closeUsd: number; close: number } | null>(null);

  const priceChange24h = useMemo(() => {
    // Realtime: current candle price vs 24h-ago reference from token record (streamed)
    if (lastCandle?.closeUsd && token?.price_24h_ago && token.price_24h_ago > 0) {
      const change = ((lastCandle.closeUsd - token.price_24h_ago) / token.price_24h_ago) * 100;
      return Number(change.toFixed(2));
    }
    return token?.price_change_24h ?? null;
  }, [lastCandle, token?.price_24h_ago, token?.price_change_24h]);

  const currentPrice = useMemo(() => {
    if (lastCandle) {
      return { sol: lastCandle.close, usd: lastCandle.closeUsd };
    }
    return {
      sol: token?.price_sol ?? onChainStats?.price ?? 0,
      usd: token?.price_usd ?? onChainStats?.priceUsd ?? null,
    };
  }, [lastCandle, token, onChainStats]);

  const fetchTokenBalance = useCallback(async () => {
    if (!connected || !publicKey || !token) { setTokenBalance(0); return; }
    try {
      const balance = await fetchBalanceClient(mint, publicKey);
      setTokenBalance(balance);
    } catch (err) {
      console.error('Failed to fetch token balance:', err);
      try {
        const res = await fetch(`/api/balance?wallet=${publicKey}&mint=${mint}`);
        const data = await res.json();
        if (data.success) setTokenBalance(data.tokenBalance || 0);
      } catch (_e) { setTokenBalance(0); }
    }
  }, [connected, publicKey, token, mint]);

  const refreshBalancesAfterTrade = useCallback(async () => {
    await refreshBalance();
    setTimeout(async () => {
      await fetchTokenBalance();
      setTimeout(async () => { await fetchTokenBalance(); }, 1500);
    }, 500);
  }, [refreshBalance, fetchTokenBalance]);

  const fetchHolders = useCallback(async (creator?: string) => {
    setHoldersLoading(true);
    try {
      const url = creator ? `/api/holders?mint=${mint}&creator=${creator}` : `/api/holders?mint=${mint}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setHolders(data.holders || []);
        setCirculatingSupply(data.circulatingSupply || 0);
      }
    } catch (err) { console.warn('Holders fetch failed:', err); }
    finally { setHoldersLoading(false); }
  }, [mint]);

  useEffect(() => {
    fetchToken(); fetchNetworkMode(); fetchOnChainStats(); fetchLatestCandle();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mint]);

  useTokenStats(mint, (updatedToken) => {
    setToken(prev => prev ? {
      ...prev,
      virtual_sol_reserves: updatedToken.virtual_sol_reserves,
      virtual_token_reserves: updatedToken.virtual_token_reserves,
      real_sol_reserves: updatedToken.real_sol_reserves,
      real_token_reserves: updatedToken.real_token_reserves,
      graduated: updatedToken.graduated,
      volume_24h: updatedToken.volume_24h,
      price_24h_ago: updatedToken.price_24h_ago ? Number(updatedToken.price_24h_ago) : undefined,
      ath: updatedToken.ath ? Number(updatedToken.ath) : undefined,
    } : null);
    fetchOnChainStats();
  });

  useCandles(mint, () => { fetchLatestCandle(); });

  useEffect(() => {
    if (token?.mint) fetchHolders(token.creator || undefined);
  }, [token?.mint, token?.creator, fetchHolders]);

  useEffect(() => {
    if (token?.creator) {
      fetch(`/api/user/profile?wallet=${token.creator}`)
        .then(res => res.json())
        .then(data => { if (data.username) setCreatorUsername(data.username); })
        .catch(() => {});
    }
  }, [token?.creator]);

  const fetchOnChainStats = async () => {
    try {
      const res = await fetch(`/api/stats?mint=${mint}`);
      const data = await res.json();
      if (data.success && data.onChain) {
        setOnChainStats({
          marketCap: data.onChain.marketCap, marketCapUsd: data.onChain.marketCapUsd,
          price: data.onChain.price, priceUsd: data.onChain.priceUsd,
          solPriceUsd: data.onChain.solPriceUsd, bondingCurveSol: data.onChain.bondingCurveSol,
        });
      }
    } catch (_err) { console.warn('On-chain stats fetch failed'); }
  };

  const fetchLatestCandle = async () => {
    try {
      const res = await fetch(`/api/candles?mint=${mint}&interval=1m&limit=1&currency=usd`);
      const data = await res.json();
      if (data.candles?.length > 0) {
        const candle = data.candles[0];
        setLastCandle({ closeUsd: candle.close, close: candle.closeSol || candle.close });
      }
    } catch (err) { console.warn('Failed to fetch latest candle:', err); }
  };

  const fetchNetworkMode = async () => {
    try {
      const res = await fetch('/api/network');
      const data = await res.json();
      setAnchorAvailable(data.anchorProgram === true);
    } catch (_err) { setAnchorAvailable(false); }
  };

  useEffect(() => {
    if (token && connected) fetchTokenBalance();
  }, [token, connected, fetchTokenBalance]);

  const fetchToken = async () => {
    try {
      const res = await fetch(`/api/tokens/${mint}`);
      const data = await res.json();
      if (data.token) { setToken(data.token); setTrades(data.trades || []); }
    } catch (err) { console.error('Failed to fetch token:', err); }
    finally { setLoading(false); }
  };

  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch(`/api/trades?mint=${mint}&limit=50`);
      const data = await res.json();
      if (data.success && data.trades) setTrades(data.trades);
    } catch (_err) { console.warn('Trades fetch failed'); }
  }, [mint]);

  useEffect(() => {
    if (token) document.title = `$${token.symbol} - ${token.name} | ClawdVault`;
    return () => { document.title = 'ClawdVault | Token Launchpad for AI Agents'; };
  }, [token]);

  const estimatedOutput = useMemo(() => {
    if (!token || !amount || parseFloat(amount) <= 0) return null;
    const inputAmount = parseFloat(amount);
    if (tradeType === 'buy') {
      const solAfterFee = inputAmount * 0.99;
      const k = token.virtual_sol_reserves * token.virtual_token_reserves;
      const newSolReserves = token.virtual_sol_reserves + solAfterFee;
      const newTokenReserves = k / newSolReserves;
      return { tokens: token.virtual_token_reserves - newTokenReserves, sol: null };
    } else {
      const tokensAfterFee = inputAmount * 0.99;
      const k = token.virtual_sol_reserves * token.virtual_token_reserves;
      const newTokenReserves = token.virtual_token_reserves + tokensAfterFee;
      const newSolReserves = k / newTokenReserves;
      const solOutRaw = token.virtual_sol_reserves - newSolReserves;
      const solOut = Math.min(solOutRaw, token.real_sol_reserves || 0);
      return { tokens: null, sol: solOut, cappedByLiquidity: solOutRaw > (token.real_sol_reserves || 0) };
    }
  }, [token, amount, tradeType]);

  const priceImpact = useMemo(() => {
    if (!token || !amount || parseFloat(amount) <= 0) return 0;
    const inputAmount = parseFloat(amount);
    const spotPrice = token.virtual_sol_reserves / token.virtual_token_reserves;
    if (tradeType === 'buy') {
      const solAfterFee = inputAmount * 0.99;
      const tokensOut = estimatedOutput?.tokens || 0;
      if (tokensOut <= 0) return 0;
      return ((solAfterFee / tokensOut - spotPrice) / spotPrice) * 100;
    } else {
      const tokensAfterFee = inputAmount * 0.99;
      const solOut = estimatedOutput?.sol || 0;
      if (solOut <= 0 || tokensAfterFee <= 0) return 0;
      return ((spotPrice - solOut / tokensAfterFee) / spotPrice) * 100;
    }
  }, [token, amount, tradeType, estimatedOutput]);

  const handleTrade = async () => {
    if (!amount || !token || !connected || !publicKey) return;
    if (anchorAvailable === null) { setTradeResult({ success: false, error: 'Loading network status...' }); return; }
    if (!anchorAvailable && !token.graduated) { setTradeResult({ success: false, error: 'Anchor program not deployed - cannot trade on bonding curve' }); return; }
    
    setTrading(true); setTradeResult(null);
    try {
      if (token.graduated) {
        const amountUnits = tradeType === 'buy' 
          ? Math.floor(parseFloat(amount) * 1e9).toString()
          : Math.floor(parseFloat(amount) * 1e6).toString();
        const jupiterRes = await fetch('/api/trade/jupiter', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mint: token.mint, action: tradeType, amount: amountUnits, userPublicKey: publicKey, slippageBps: 100 }),
        });
        const jupiterData = await jupiterRes.json();
        if (!jupiterData.success) { setTradeResult({ success: false, error: jupiterData.error || 'Jupiter swap failed' }); return; }
        const signedTx = await signTransaction(jupiterData.transaction);
        if (!signedTx) { setTradeResult({ success: false, error: 'Transaction signing cancelled' }); return; }
        const solAmountDecimal = tradeType === 'buy' ? Number(jupiterData.quote.inAmount) / 1e9 : Number(jupiterData.quote.outAmount) / 1e9;
        const tokenAmountDecimal = tradeType === 'buy' ? Number(jupiterData.quote.outAmount) / 1e6 : Number(jupiterData.quote.inAmount) / 1e6;
        const executeRes = await fetch('/api/trade/jupiter/execute', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mint: token.mint, signedTransaction: signedTx, type: tradeType, wallet: publicKey, solAmount: solAmountDecimal, tokenAmount: tokenAmountDecimal }),
        });
        const executeData = await executeRes.json();
        if (!executeData.success) { setTradeResult({ success: false, error: executeData.error || 'Jupiter trade failed' }); return; }
        setTradeResult({ success: true, signature: executeData.signature, trade: executeData.trade, message: 'Trade executed via Jupiter!' });
        setAmount(''); fetchToken(); fetchOnChainStats(); refreshBalancesAfterTrade();
        return;
      }
      
      const prepareRes = await fetch('/api/trade/prepare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: token.mint, type: tradeType, amount: parseFloat(amount), wallet: publicKey, slippage: 0.01 }),
      });
      const prepareData = await prepareRes.json();
      if (!prepareData.success) {
        if (prepareData.graduated) { await fetchToken(); setTradeResult({ success: false, error: 'Token just graduated! Please retry to trade via Raydium.' }); return; }
        setTradeResult({ success: false, error: prepareData.error || 'Failed to prepare transaction' }); return;
      }
      const signedTx = await signTransaction(prepareData.transaction);
      if (!signedTx) { setTradeResult({ success: false, error: 'Transaction signing cancelled or failed' }); return; }
      const executeRes = await fetch('/api/trade/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint: token.mint, type: tradeType, signedTransaction: signedTx, wallet: publicKey,
          expectedOutput: tradeType === 'buy' ? prepareData.output.tokens : prepareData.output.sol,
          solAmount: tradeType === 'buy' ? prepareData.input.sol : prepareData.output.sol,
          tokenAmount: tradeType === 'sell' ? prepareData.input.tokens : prepareData.output.tokens,
        }),
      });
      const executeData = await executeRes.json();
      if (executeData.success) {
        setTradeResult({ success: true, trade: executeData.trade, newPrice: executeData.newPrice, fees: executeData.fees, signature: executeData.signature });
        setAmount(''); fetchToken(); fetchHolders(token?.creator); fetchOnChainStats(); refreshBalancesAfterTrade();
      } else {
        setTradeResult({ success: false, error: executeData.error || 'Trade execution failed' });
      }
    } catch (err) {
      console.error('Trade error:', err);
      setTradeResult({ success: false, error: err instanceof Error ? err.message : 'Network error' });
    } finally { setTrading(false); }
  };

  const handleQuickSell = (percent: number) => { setAmount((tokenBalance * percent / 100).toString()); };

  const formatPrice = (price: number) => {
    if (price < 0.0000000001) return '<0.0000000001';
    if (price < 0.000001) return price.toFixed(12);
    if (price < 0.001) return price.toFixed(9);
    return price.toFixed(6);
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000000) return (n / 1000000000).toFixed(2) + 'B';
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
    return n.toFixed(2);
  };

  const formatSolOutput = (n: number) => {
    if (n === 0) return '0 SOL';
    if (n >= 1) return n.toFixed(4) + ' SOL';
    if (n >= 0.0001) return n.toFixed(6) + ' SOL';
    if (n >= 0.0000001) return n.toFixed(9) + ' SOL';
    return n.toExponential(4) + ' SOL';
  };

  const fundsRaised = useMemo(() => token?.real_sol_reserves || 0, [token?.real_sol_reserves]);
  const progressPercent = token?.graduated ? 100 : Math.min((fundsRaised / 120) * 100, 100);

  /* ---- LOADING ---- */
  if (loading) {
    return (
      <main className="min-h-screen bg-vault-bg">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-vault-accent border-t-transparent" />
            <span className="text-sm text-vault-muted">Loading token...</span>
          </div>
        </div>
      </main>
    );
  }

  /* ---- NOT FOUND ---- */
  if (!token) {
    return (
      <main className="min-h-screen bg-vault-bg">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold text-vault-text">Token Not Found</h1>
            <Link href="/tokens" className="text-sm font-medium text-vault-accent transition-colors hover:text-vault-accent-hover">
              Browse all tokens
            </Link>
          </div>
        </div>
      </main>
    );
  }

  /* ---- MAIN RENDER ---- */
  return (
    <main className="min-h-screen bg-vault-bg">
      <Header />

      <section className="px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[1400px]">
          {/* Token Header */}
          <div className="mb-6 flex items-start gap-4">
            <div className="relative h-12 w-12 shrink-0 lg:h-14 lg:w-14">
              {token.image ? (
                <img src={token.image} alt="" className="h-full w-full rounded-xl object-cover ring-1 ring-white/[0.06]" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-xl bg-vault-accent/10 text-xl font-bold text-vault-accent">
                  {token.symbol?.[0] || '?'}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-vault-text lg:text-2xl">${token.symbol}</h1>
                <span className="text-vault-muted">{token.name}</span>
                {token.graduated && (
                  <span className="rounded-md bg-vault-green/10 px-2 py-0.5 text-xs font-medium text-vault-green">
                    Graduated
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-vault-dim">
                  by{' '}
                  {creatorUsername ? (
                    <ExplorerLink address={token.creator} label={creatorUsername} />
                  ) : (
                    <ExplorerLink address={token.creator} />
                  )}
                </span>
                <span className="hidden text-vault-dim sm:inline">&middot;</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-vault-dim">CA:</span>
                  <a
                    href={`https://solscan.io/account/${token.mint}${process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta' ? '' : '?cluster=' + (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-vault-accent transition-colors hover:text-vault-accent-hover"
                    title={token.mint}
                  >
                    {token.mint.slice(0, 6)}...{token.mint.slice(-4)}
                  </a>
                  <button
                    onClick={() => { navigator.clipboard.writeText(token.mint); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="text-vault-dim transition-colors hover:text-vault-text"
                    title="Copy mint address"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {copied ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      )}
                    </svg>
                  </button>
                </span>
                {(token.twitter || token.telegram || token.website) && (
                  <>
                    <span className="hidden text-vault-dim sm:inline">&middot;</span>
                    <div className="flex items-center gap-2">
                      {token.twitter && (
                        <a href={token.twitter.startsWith('http') ? token.twitter : `https://twitter.com/${token.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-vault-dim transition-colors hover:text-vault-text" title="Twitter">
                          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                        </a>
                      )}
                      {token.telegram && (
                        <a href={token.telegram.startsWith('http') ? token.telegram : `https://t.me/${token.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-vault-dim transition-colors hover:text-vault-text" title="Telegram">
                          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                        </a>
                      )}
                      {token.website && (
                        <a href={token.website.startsWith('http') ? token.website : `https://${token.website}`} target="_blank" rel="noopener noreferrer" className="text-vault-dim transition-colors hover:text-vault-text" title="Website">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                        </a>
                      )}
                    </div>
                  </>
                )}
              </div>
              {token.description && (
                <p className="mt-1 line-clamp-2 text-sm text-vault-dim">{token.description}</p>
              )}
            </div>
          </div>

          {/* Main Grid */}
          <div className="flex w-full min-w-0 flex-col gap-4 lg:grid lg:grid-cols-3">
            {/* Chart */}
            <div className="order-1 min-w-0 lg:order-none lg:col-span-2">
              <PriceChart
                mint={token.mint}
                height={500}
                currentMarketCap={token?.market_cap_usd ?? onChainStats?.marketCapUsd ?? 0}
                marketCapSol={token?.market_cap_sol ?? onChainStats?.marketCap ?? 0}
                marketCapUsd={token?.market_cap_usd ?? onChainStats?.marketCapUsd ?? null}
                volume24h={token.volume_24h || 0}
                holders={holders.length > 0 ? holders.length : (token.holders || 0)}
                priceChange24h={priceChange24h}
              />
            </div>

            {/* Mobile bonding curve */}
            <div className="order-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 lg:hidden">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-vault-text">Bonding Curve</span>
                <span className="font-mono text-sm font-bold text-vault-accent">{progressPercent.toFixed(1)}%</span>
              </div>
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-vault-accent transition-all duration-500" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
              </div>
              <div className="text-xs">
                {token.graduated ? (
                  <span className="text-vault-green">Graduated to Raydium</span>
                ) : (
                  <span className="text-vault-dim">{fundsRaised.toFixed(2)} / 120 SOL raised</span>
                )}
              </div>
            </div>

            {/* Mobile holders */}
            <div className="order-5 lg:hidden">
              <HolderDistribution
                holders={holders}
                holdersLoading={holdersLoading}
                circulatingSupply={circulatingSupply}
                formatNumber={formatNumber}
              />
            </div>

            {/* Chat & Trades */}
            <div className="order-4 lg:order-none lg:col-span-2">
              <ChatAndTrades mint={token.mint} tokenSymbol={token.symbol} trades={trades} onTradesUpdate={fetchTrades} />
            </div>

            {/* Sidebar: Trade + Bonding + Holders */}
            <div className="order-3 flex flex-col gap-4 lg:order-none lg:row-span-3 lg:row-start-1 lg:col-start-3">
              {/* Trade Panel */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vault-muted">Trade</h3>

                {/* Price */}
                <div className="mb-4 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-vault-dim">Price</span>
                    <span className="font-mono text-vault-text">
                      {currentPrice?.sol ? formatPrice(currentPrice.sol) : (onChainStats?.price ? formatPrice(onChainStats.price) : '--')} SOL
                    </span>
                  </div>
                  {(currentPrice?.usd || onChainStats?.priceUsd) && (
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-vault-dim">USD</span>
                      <span className="font-mono text-vault-green">
                        ${(currentPrice?.usd ?? onChainStats?.priceUsd ?? 0).toFixed((currentPrice?.usd ?? onChainStats?.priceUsd ?? 0) < 0.01 ? 8 : 4)}
                      </span>
                    </div>
                  )}
                  {priceChange24h !== null && priceChange24h !== undefined && (
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-vault-dim">24h</span>
                      <span className={`font-mono ${priceChange24h >= 0 ? 'text-vault-green' : 'text-vault-red'}`}>
                        {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* User Balance */}
                {connected && (
                  <div className="mb-4 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-vault-dim">Your SOL</span>
                      <span className="font-mono text-vault-text">{solBalance !== null ? solBalance.toFixed(4) : '--'}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-vault-dim">Your ${token.symbol}</span>
                      <span className="font-mono text-vault-text">{formatNumber(tokenBalance)}</span>
                    </div>
                  </div>
                )}

                {/* Buy/Sell Toggle */}
                <div className="mb-4 flex rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
                  <button
                    onClick={() => { setTradeType('buy'); setAmount(''); }}
                    className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                      tradeType === 'buy' ? 'bg-vault-green text-vault-bg' : 'text-vault-muted hover:text-vault-text'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => { setTradeType('sell'); setAmount(''); }}
                    className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                      tradeType === 'sell' ? 'bg-vault-red text-white' : 'text-vault-muted hover:text-vault-text'
                    }`}
                  >
                    Sell
                  </button>
                </div>

                {/* Amount Input */}
                <div className="mb-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <label className="text-vault-dim">{tradeType === 'buy' ? 'SOL Amount' : 'Token Amount'}</label>
                    {connected && (
                      <span className="text-vault-dim">
                        Max: {tradeType === 'buy' ? (solBalance?.toFixed(4) || '0') + ' SOL' : formatNumber(tokenBalance)}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      step="any"
                      min="0"
                      className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 pr-16 font-mono text-lg text-vault-text placeholder-vault-dim outline-none transition-colors focus:border-vault-accent/40"
                    />
                    <button
                      onClick={() => setAmount(tradeType === 'buy' ? (solBalance || 0).toString() : tokenBalance.toString())}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-vault-accent/10 px-2 py-1 text-xs font-medium text-vault-accent transition-colors hover:bg-vault-accent/20"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                {/* Quick amounts */}
                {tradeType === 'buy' ? (
                  <div className="mb-4 flex gap-2">
                    {[0.1, 0.5, 1, 5].map((val) => (
                      <button key={val} onClick={() => setAmount(val.toString())} className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] py-1.5 text-xs font-medium text-vault-muted transition-colors hover:border-vault-accent/20 hover:text-vault-text">
                        {val} SOL
                      </button>
                    ))}
                  </div>
                ) : connected ? (
                  <div className="mb-4 flex gap-2">
                    {[25, 50, 75, 100].map((percent) => (
                      <button key={percent} onClick={() => handleQuickSell(percent)} className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] py-1.5 text-xs font-medium text-vault-muted transition-colors hover:border-vault-accent/20 hover:text-vault-text">
                        {percent === 100 ? 'MAX' : `${percent}%`}
                      </button>
                    ))}
                  </div>
                ) : null}

                {/* Estimated Output */}
                {estimatedOutput && (
                  <div className="mb-4 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-vault-dim">{"You'll receive (est.)"}</span>
                      <span className="font-mono text-vault-text">
                        {tradeType === 'buy' ? formatNumber(estimatedOutput.tokens || 0) + ' ' + token.symbol : formatSolOutput(estimatedOutput.sol || 0)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-vault-dim">Price Impact</span>
                      <span className={`font-mono ${tradeType === 'sell' ? 'text-vault-red' : priceImpact > 5 ? 'text-vault-red' : priceImpact > 2 ? 'text-yellow-400' : 'text-vault-green'}`}>
                        {tradeType === 'sell' ? '-' : ''}{priceImpact.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {priceImpact > 5 && (
                  <div className="mb-4 rounded-lg border border-vault-red/30 bg-vault-red/5 p-3">
                    <p className="flex items-center gap-2 text-xs text-vault-red">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.27 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                      High price impact! Consider a smaller trade.
                    </p>
                  </div>
                )}
                {estimatedOutput?.cappedByLiquidity && (
                  <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                    <p className="text-xs text-blue-400">Partial fill - only tokens up to available liquidity will be sold.</p>
                  </div>
                )}

                {/* Trade Result */}
                {tradeResult && (
                  <div className={`mb-4 rounded-lg border p-3 ${tradeResult.success ? 'border-vault-green/30 bg-vault-green/5' : 'border-vault-red/30 bg-vault-red/5'}`}>
                    {tradeResult.success ? (
                      <p className="text-xs text-vault-green">
                        Trade successful!
                        {tradeResult.tokens_received && <span className="block">Received: {formatNumber(tradeResult.tokens_received)} tokens</span>}
                        {tradeResult.sol_received && <span className="block">Received: {tradeResult.sol_received.toFixed(6)} SOL</span>}
                      </p>
                    ) : (
                      <p className="text-xs text-vault-red">{tradeResult.error}</p>
                    )}
                  </div>
                )}

                {/* Trade Button */}
                {connected ? (
                  <button
                    onClick={handleTrade}
                    disabled={trading || !amount || parseFloat(amount) <= 0}
                    className={`w-full rounded-lg py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                      tradeType === 'buy' ? 'bg-vault-green text-vault-bg hover:brightness-110' : 'bg-vault-red text-white hover:brightness-110'
                    }`}
                  >
                    {trading ? 'Processing...' : tradeType === 'buy' ? 'Buy Tokens' : 'Sell Tokens'}
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={connect}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-vault-accent py-3 text-sm font-semibold text-vault-bg transition-all hover:bg-vault-accent-hover"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 200 180" fill="none">
                        <path fillRule="evenodd" clipRule="evenodd" d="M89.1138 112.613C83.1715 121.719 73.2139 133.243 59.9641 133.243C53.7005 133.243 47.6777 130.665 47.6775 119.464C47.677 90.9369 86.6235 46.777 122.76 46.7764C143.317 46.776 151.509 61.0389 151.509 77.2361C151.509 98.0264 138.018 121.799 124.608 121.799C120.352 121.799 118.264 119.462 118.264 115.756C118.264 114.789 118.424 113.741 118.746 112.613C114.168 120.429 105.335 127.683 97.0638 127.683C91.0411 127.683 87.9898 123.895 87.9897 118.576C87.9897 116.642 88.3912 114.628 89.1138 112.613ZM115.936 68.7103C112.665 68.7161 110.435 71.4952 110.442 75.4598C110.449 79.4244 112.689 82.275 115.96 82.2693C119.152 82.2636 121.381 79.4052 121.374 75.4405C121.367 71.4759 119.128 68.7047 115.936 68.7103ZM133.287 68.6914C130.016 68.6972 127.786 71.4763 127.793 75.4409C127.8 79.4055 130.039 82.2561 133.311 82.2504C136.503 82.2448 138.732 79.3863 138.725 75.4216C138.718 71.457 136.479 68.6858 133.287 68.6914Z" fill="currentColor" />
                      </svg>
                      Connect Phantom Wallet
                    </button>
                    <p className="text-center text-[10px] text-vault-dim">
                      {"Don't have Phantom? "}
                      <a href="https://phantom.app/" target="_blank" rel="noopener noreferrer" className="text-vault-accent underline">Download here</a>
                    </p>
                  </div>
                )}

                <p className="mt-4 text-center text-[10px] text-vault-dim">
                  {token.graduated ? 'Trades via Raydium - ~0.25% swap fee' : '1% fee (0.5% creator + 0.5% protocol)'}
                </p>
              </div>

              {/* Bonding Curve - Desktop sidebar */}
              <div className="hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 lg:block">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-vault-text">Bonding Curve</span>
                  <span className="font-mono text-sm font-bold text-vault-accent">{progressPercent.toFixed(1)}%</span>
                </div>
                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-vault-accent transition-all duration-500" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
                </div>
                <div className="text-xs">
                  {token.graduated ? (
                    <span className="text-vault-green">Graduated to Raydium</span>
                  ) : (
                    <span className="text-vault-dim">{fundsRaised.toFixed(2)} / 120 SOL raised</span>
                  )}
                </div>
              </div>

              {/* Holders - Desktop sidebar */}
              <div className="hidden lg:block">
                <HolderDistribution
                  holders={holders}
                  holdersLoading={holdersLoading}
                  circulatingSupply={circulatingSupply}
                  formatNumber={formatNumber}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}


/* ---- Holder Distribution Component ---- */
function HolderDistribution({ holders, holdersLoading, circulatingSupply, formatNumber }: {
  holders: Array<{ address: string; balance: number; percentage: number; label?: string }>;
  holdersLoading: boolean;
  circulatingSupply: number;
  formatNumber: (n: number) => string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-vault-text">
        <svg className="h-4 w-4 text-vault-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Holder Distribution
      </h3>
      {holdersLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex animate-pulse items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-white/[0.06]" />
              <div className="flex-1"><div className="mb-1 h-3 w-20 rounded bg-white/[0.06]" /><div className="h-2 w-14 rounded bg-white/[0.04]" /></div>
              <div className="h-1.5 w-14 rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      ) : holders.length === 0 ? (
        <div className="py-4 text-center text-xs text-vault-dim">No holder data available</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {holders.slice(0, 5).map((holder, i) => (
            <div key={holder.address} className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-[10px] font-bold text-vault-dim">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                {holder.label ? (
                  <a
                    href={`https://solscan.io/account/${holder.address}${process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta' ? '' : '?cluster=' + (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet')}`}
                    target="_blank" rel="noopener noreferrer"
                    className={`text-xs font-medium hover:underline ${holder.label === 'Liquidity Pool' ? 'text-vault-accent' : 'text-blue-400'}`}
                  >{holder.label}</a>
                ) : (
                  <a
                    href={`https://solscan.io/account/${holder.address}${process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta' ? '' : '?cluster=' + (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="truncate font-mono text-xs text-vault-muted hover:text-vault-accent hover:underline"
                  >
                    {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                  </a>
                )}
                <div className="text-[10px] text-vault-dim">{formatNumber(holder.balance)} tokens</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/[0.06]" title={`${holder.percentage.toFixed(2)}%`}>
                  <div
                    className={`h-full rounded-full ${holder.label === 'Liquidity Pool' ? 'bg-vault-accent' : holder.label === 'Creator (dev)' ? 'bg-blue-500' : 'bg-vault-green'}`}
                    style={{ width: `${Math.min(holder.percentage, 100)}%` }}
                  />
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-vault-dim">
                  {holder.percentage < 0.1 ? holder.percentage.toFixed(3) : holder.percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          ))}

          {circulatingSupply > 0 && (
            <div className="mt-2 border-t border-white/[0.04] pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-vault-dim">Circulating</span>
                <span className="font-mono text-vault-text">{formatNumber(circulatingSupply)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-vault-dim">Total Supply</span>
                <span className="font-mono text-vault-dim">1,000,000,000</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
