'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { authenticatedPost, authenticatedDelete } from '@/lib/signRequest';
import { Trade } from '@/lib/types';
import { 
  useChatMessages, 
  useTrades, 
  useReactions,
  RealtimeMessage,
  RealtimeTrade
} from '@/lib/supabase-client';

interface ReactionData {
  count: number;
  wallets: string[];
}

interface ChatMessage {
  id: string;
  sender: string;
  username: string | null;
  avatar: string | null;
  message: string;
  replyTo: string | null;
  createdAt: string;
  reactions: Record<string, ReactionData>;
}

const EMOJI_OPTIONS = ['🔥', '👍', '😂', '❤️', '🚀', '👀'];

interface UserProfile {
  wallet: string;
  username: string | null;
  avatar: string | null;
  messageCount: number;
}

interface ChatAndTradesProps {
  mint: string;
  tokenSymbol: string;
  trades: Trade[];
  onTradesUpdate?: () => void;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function shortenAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatNumber(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return '0';
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function ChatAndTrades({ mint, tokenSymbol, trades, onTradesUpdate }: ChatAndTradesProps) {
  const wallet = useWallet();
  const { connected, publicKey, connect } = wallet;
  
  const [activeTab, setActiveTab] = useState<'thread' | 'trades'>('thread');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const tradesContainerRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat?mint=${mint}&limit=100`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  }, [mint]);

  // Fetch profile when wallet connects
  const fetchProfile = useCallback(async (wallet: string) => {
    try {
      const res = await fetch(`/api/profile?wallet=${wallet}`);
      const data = await res.json();
      if (data.success && data.profile) {
        setProfile(data.profile);
        setNewUsername(data.profile.username || '');
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime chat messages subscription (auto-cleanup via hook)
  useChatMessages(
    mint,
    async (_newMsg: RealtimeMessage) => {
      // Fetch the full message with profile info from API
      // (realtime only gives us the raw row)
      try {
        const res = await fetch(`/api/chat?mint=${mint}&limit=100`);
        const data = await res.json();
        if (data.success) {
          setMessages(data.messages);
        }
      } catch (err) {
        console.error('Failed to fetch after realtime update:', err);
      }
    },
    (deletedId: string) => {
      setMessages(prev => prev.filter(m => m.id !== deletedId));
    }
  );

  // Realtime reactions subscription (auto-cleanup via hook)
  useReactions(mint, () => {
    fetchMessages();
  });

  // Initial trades fetch
  useEffect(() => {
    if (onTradesUpdate) onTradesUpdate();
  }, [onTradesUpdate]);

  // Realtime trades subscription (auto-cleanup via hook)
  useTrades(mint, (_newTrade: RealtimeTrade) => {
    if (onTradesUpdate) onTradesUpdate();
  });

  // Fetch profile when connected
  useEffect(() => {
    if (connected && publicKey) {
      fetchProfile(publicKey);
    } else {
      setProfile(null);
    }
  }, [connected, publicKey, fetchProfile]);

  // Chat scroll is handled by flex-direction: column-reverse - no auto-scroll needed

  // Save username
  const saveUsername = async () => {
    if (!publicKey || savingUsername) return;
    
    setSavingUsername(true);
    setError('');

    try {
      const profileData = {
        username: newUsername.trim() || null,
        avatar: null,
      };
      
      const res = await authenticatedPost(wallet, '/api/profile', 'profile', profileData);
      const data = await res.json();
      
      if (data.success) {
        setProfile(data.profile);
        setEditingUsername(false);
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch (err) {
      setError((err as Error).message || 'Network error');
    } finally {
      setSavingUsername(false);
    }
  };

  // Get user's current reaction on a message
  const getUserReaction = (msg: ChatMessage): string | null => {
    if (!publicKey) return null;
    for (const [emoji, data] of Object.entries(msg.reactions)) {
      if (data.wallets.includes(publicKey)) return emoji;
    }
    return null;
  };

  // Toggle reaction
  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!connected || !publicKey) return;

    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const currentReaction = getUserReaction(message);
    const isSameEmoji = currentReaction === emoji;

    try {
      if (isSameEmoji) {
        const signedData = { messageId, emoji };
        await authenticatedDelete(
          wallet, 
          `/api/reactions?messageId=${messageId}&emoji=${encodeURIComponent(emoji)}`,
          'unreact',
          signedData
        );
        setMessages(prev => prev.map(m => {
          if (m.id !== messageId) return m;
          const newReactions = { ...m.reactions };
          if (newReactions[emoji]) {
            newReactions[emoji] = {
              count: newReactions[emoji].count - 1,
              wallets: newReactions[emoji].wallets.filter(w => w !== publicKey),
            };
            if (newReactions[emoji].count === 0) {
              delete newReactions[emoji];
            }
          }
          return { ...m, reactions: newReactions };
        }));
      } else {
        if (currentReaction) {
          const oldSignedData = { messageId, emoji: currentReaction };
          await authenticatedDelete(
            wallet,
            `/api/reactions?messageId=${messageId}&emoji=${encodeURIComponent(currentReaction)}`,
            'unreact',
            oldSignedData
          );
        }
        const newSignedData = { messageId, emoji };
        await authenticatedPost(wallet, '/api/reactions', 'react', newSignedData);
        setMessages(prev => prev.map(m => {
          if (m.id !== messageId) return m;
          const newReactions = { ...m.reactions };
          if (currentReaction && newReactions[currentReaction]) {
            newReactions[currentReaction] = {
              count: newReactions[currentReaction].count - 1,
              wallets: newReactions[currentReaction].wallets.filter(w => w !== publicKey),
            };
            if (newReactions[currentReaction].count === 0) {
              delete newReactions[currentReaction];
            }
          }
          if (newReactions[emoji]) {
            newReactions[emoji] = {
              count: newReactions[emoji].count + 1,
              wallets: [...newReactions[emoji].wallets, publicKey],
            };
          } else {
            newReactions[emoji] = { count: 1, wallets: [publicKey] };
          }
          return { ...m, reactions: newReactions };
        }));
      }
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  // Send message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !publicKey) return;

    setSending(true);
    setError('');

    try {
      const chatData = {
        mint,
        message: newMessage.trim(),
        replyTo: null,
      };
      
      const res = await authenticatedPost(wallet, '/api/chat', 'chat', chatData);
      const data = await res.json();
      
      if (data.success) {
        setMessages(prev => [data.message, ...prev]);
        setNewMessage('');
      } else {
        setError(data.error || 'Failed to send');
      }
    } catch (err) {
      setError((err as Error).message || 'Network error');
    } finally {
      setSending(false);
    }
  };

  const getDisplayName = (msg: ChatMessage) => {
    if (msg.username) return msg.username;
    return shortenAddress(msg.sender);
  };

  return (
    <div className="flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden" style={{ height: '480px' }}>
      {/* Tabs Header */}
      <div className="border-b border-white/[0.04]">
        <div className="flex">
          <button
            onClick={() => setActiveTab('thread')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition border-b-2 ${
              activeTab === 'thread'
                ? 'text-vault-accent border-vault-accent'
                : 'text-vault-muted border-transparent hover:text-vault-text'
            }`}
          >
            Thread
            <span className="ml-1 text-xs text-vault-dim">({messages.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition border-b-2 ${
              activeTab === 'trades'
                ? 'text-vault-accent border-vault-accent'
                : 'text-vault-muted border-transparent hover:text-vault-text'
            }`}
          >
            Trades
            <span className="ml-1 text-xs text-vault-dim">({trades.length})</span>
          </button>
        </div>
        
        {/* Username edit */}
        {activeTab === 'thread' && connected && publicKey && (
          <div className="flex items-center justify-between border-t border-white/[0.04] px-4 py-2">
            {editingUsername ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="username"
                  maxLength={20}
                  className="w-24 rounded border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-xs text-vault-text outline-none focus:border-vault-accent/40"
                />
                <button onClick={saveUsername} disabled={savingUsername} className="text-xs text-vault-green hover:brightness-110">
                  {savingUsername ? '...' : '✓'}
                </button>
                <button onClick={() => { setEditingUsername(false); setNewUsername(profile?.username || ''); }} className="text-xs text-vault-muted hover:text-vault-text">
                  ✕
                </button>
              </div>
            ) : (
              <button onClick={() => setEditingUsername(true)} className="text-xs text-vault-accent transition-colors hover:text-vault-accent-hover" title="Edit username">
                {profile?.username || shortenAddress(publicKey)}
              </button>
            )}
            <span className="text-xs text-vault-green">Connected</span>
          </div>
        )}
      </div>

      {/* Thread Content */}
      {activeTab === 'thread' && (
        <>
          <div ref={chatContainerRef} className="flex flex-1 flex-col-reverse overflow-y-auto min-h-0 dark-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-vault-accent border-t-transparent" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-vault-dim">
                <span className="text-sm">No messages yet</span>
                <span className="text-xs">{connected ? 'Be the first to chat!' : 'Connect wallet to chat'}</span>
              </div>
            ) : (
              messages.map((msg) => {
                const hasReactions = Object.keys(msg.reactions).length > 0;
                return (
                  <div key={msg.id} className="group mb-1 px-4 py-1 last:mb-0">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className={`text-sm font-medium ${msg.username ? 'text-vault-accent' : 'text-vault-muted'}`} title={msg.sender}>
                            {getDisplayName(msg)}
                          </span>
                          <span className="text-xs text-vault-dim">{formatTimeAgo(new Date(msg.createdAt))}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <p className="break-words text-sm text-vault-text">{msg.message}</p>
                          {!hasReactions && connected && (
                            <div className="relative inline-block">
                              <button
                                className="flex h-5 w-5 items-center justify-center text-xs text-vault-dim opacity-0 transition hover:text-vault-text group-hover:opacity-100"
                                onClick={(e) => { e.currentTarget.nextElementSibling?.classList.toggle('hidden'); }}
                              >+</button>
                              <div className="absolute bottom-full left-0 z-10 mb-1 hidden flex gap-1 rounded-lg border border-white/[0.06] bg-vault-bg p-1 shadow-lg">
                                {EMOJI_OPTIONS.map(emoji => {
                                  const isSelected = getUserReaction(msg) === emoji;
                                  return (
                                    <button key={emoji} onClick={(e) => { toggleReaction(msg.id, emoji); e.currentTarget.parentElement?.classList.add('hidden'); }}
                                      className={`rounded p-1.5 transition ${isSelected ? 'bg-vault-accent/20 ring-1 ring-vault-accent' : 'hover:bg-white/[0.06]'}`}
                                      title={isSelected ? 'Click to remove' : 'Click to react'}
                                    >{emoji}</button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        {hasReactions && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            {Object.entries(msg.reactions).map(([emoji, data]) => (
                              <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition ${
                                  connected && publicKey && data.wallets.includes(publicKey)
                                    ? 'border border-vault-accent/30 bg-vault-accent/10 text-vault-accent'
                                    : 'bg-white/[0.04] text-vault-muted hover:bg-white/[0.06]'
                                }`}
                                title={`${data.count} reaction${data.count !== 1 ? 's' : ''}`}
                              >
                                <span>{emoji}</span><span>{data.count}</span>
                              </button>
                            ))}
                            {connected && (
                              <div className="relative inline-block">
                                <button className="flex h-5 w-5 items-center justify-center text-xs text-vault-dim transition hover:text-vault-text"
                                  onClick={(e) => { e.currentTarget.nextElementSibling?.classList.toggle('hidden'); }}
                                >+</button>
                                <div className="absolute bottom-full left-0 z-10 mb-1 hidden flex gap-1 rounded-lg border border-white/[0.06] bg-vault-bg p-1 shadow-lg">
                                  {EMOJI_OPTIONS.map(emoji => {
                                    const isSelected = getUserReaction(msg) === emoji;
                                    return (
                                      <button key={emoji} onClick={(e) => { toggleReaction(msg.id, emoji); e.currentTarget.parentElement?.classList.add('hidden'); }}
                                        className={`rounded p-1.5 transition ${isSelected ? 'bg-vault-accent/20 ring-1 ring-vault-accent' : 'hover:bg-white/[0.06]'}`}
                                        title={isSelected ? 'Click to remove' : 'Click to react'}
                                      >{emoji}</button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Chat Input */}
          <div className="border-t border-white/[0.04] p-3">
            {error && <div className="mb-2 text-xs text-vault-red">{error}</div>}
            <form onSubmit={sendMessage}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={connected ? "Type a message..." : "Connect wallet to chat..."}
                  maxLength={500}
                  disabled={!connected}
                  className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-vault-text placeholder-vault-dim outline-none transition-colors focus:border-vault-accent/40 disabled:opacity-50"
                />
                {connected ? (
                  <button type="submit" disabled={!newMessage.trim() || sending}
                    className="rounded-lg bg-vault-accent px-4 py-2 text-sm font-medium text-vault-bg transition-colors hover:bg-vault-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >{sending ? '...' : 'Send'}</button>
                ) : (
                  <button type="button" onClick={connect}
                    className="whitespace-nowrap rounded-lg bg-vault-accent px-4 py-2 text-sm font-medium text-vault-bg transition-colors hover:bg-vault-accent-hover"
                  >Connect</button>
                )}
              </div>
              {connected && <div className="mt-2 text-xs text-vault-dim">{newMessage.length}/500</div>}
            </form>
          </div>
        </>
      )}

      {/* Trades Content */}
      {activeTab === 'trades' && (
        <div ref={tradesContainerRef} className="flex-1 min-h-0 overflow-y-auto dark-scrollbar">
          {trades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-vault-dim">
              <span className="text-sm">No trades yet</span>
              <span className="text-xs">Be the first to trade!</span>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {trades.map((trade) => (
                <div key={trade.id} className={`flex items-center gap-3 px-4 py-3 transition ${trade.type === 'buy' ? 'hover:bg-vault-green/5' : 'hover:bg-vault-red/5'}`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${trade.type === 'buy' ? 'bg-vault-green/10' : 'bg-vault-red/10'}`}>
                    <span className={`text-sm ${trade.type === 'buy' ? 'text-vault-green' : 'text-vault-red'}`}>
                      {trade.type === 'buy' ? '\u2197' : '\u2198'}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <a href={`https://solscan.io/account/${trade.trader}${process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta' ? '' : '?cluster=' + (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet')}`}
                        target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-vault-muted hover:text-vault-accent hover:underline"
                      >{shortenAddress(trade.trader)}</a>
                      <span className={`text-xs font-medium ${trade.type === 'buy' ? 'text-vault-green' : 'text-vault-red'}`}>
                        {trade.type === 'buy' ? 'bought' : 'sold'}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium text-vault-text">{formatNumber(trade.token_amount)} {tokenSymbol}</span>
                      <span className="text-[10px] text-vault-dim">for</span>
                      <span className={`font-mono text-sm ${trade.type === 'buy' ? 'text-vault-green' : 'text-vault-red'}`}>
                        {(trade.sol_amount || 0).toFixed(4)} SOL
                      </span>
                      {trade.sol_price_usd && (
                        <span className="text-[10px] text-vault-dim">
                          (${(trade.sol_amount * trade.sol_price_usd).toLocaleString(undefined, { maximumFractionDigits: 2 })})
                        </span>
                      )}
                    </div>
                    {trade.price_usd && (
                      <div className="mt-0.5 text-[10px] text-vault-dim">
                        @ ${trade.price_usd.toLocaleString(undefined, { maximumFractionDigits: 6 })}/token
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-right">
                    <span className="text-[10px] text-vault-dim">{formatTimeAgo(new Date(trade.created_at))}</span>
                    {trade.signature && (
                      <a href={`https://solscan.io/tx/${trade.signature}${process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta' ? '' : '?cluster=' + (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet')}`}
                        target="_blank" rel="noopener noreferrer" className="text-vault-dim transition-colors hover:text-vault-accent" title="View transaction"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
