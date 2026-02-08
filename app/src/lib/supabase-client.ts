'use client';

import { createClient, SupabaseClient, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

// Client-side Supabase client for realtime subscriptions
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase URL and Anon Key are required');
    }
    
    supabaseClient = createClient(url, key, {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
  }
  return supabaseClient;
}

// Types for realtime payloads
export interface RealtimeMessage {
  id: string;
  token_mint: string;
  sender: string;
  message: string;
  reply_to: string | null;
  created_at: string;
}

export interface RealtimeTrade {
  id: string;
  token_mint: string;
  trader: string;
  trade_type: 'buy' | 'sell';
  sol_amount: number;
  token_amount: number;
  price_sol: number;
  signature: string | null;
  created_at: string;
}

export interface SolPriceUpdate {
  id: string;
  price: number;
  source: string;
  updated_at: string;
}



// Shared logging helper for subscription status
function logSubscriptionStatus(hookName: string, status: string, err?: Error | null) {
  if (status === 'SUBSCRIBED') {
    console.log(`[Realtime] ${hookName}: SUBSCRIBED`);
  } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    console.warn(`[Realtime] ${hookName}: ${status}`, err || '');
  } else if (status === 'CLOSED') {
    console.log(`[Realtime] ${hookName}: CLOSED`);
  }
}

const isDev = process.env.NODE_ENV === 'development';

// Counter for unique channel names — prevents StrictMode "mismatch" errors
// when dev skips cleanup and a remount creates a new channel with the same name.
let channelCounter = 0;
function uniqueChannel(name: string): string {
  return isDev ? `${name}:${++channelCounter}` : name;
}

// ============================================
// REACT HOOKS WITH AUTO-CLEANUP
// ============================================

// Hook for subscribing to chat messages
export function useChatMessages(
  mint: string | null,
  onInsert: (message: RealtimeMessage) => void,
  onDelete?: (id: string) => void
) {
  const onInsertRef = useRef(onInsert);
  const onDeleteRef = useRef(onDelete);
  
  // Keep callbacks fresh without re-subscribing
  useEffect(() => {
    onInsertRef.current = onInsert;
    onDeleteRef.current = onDelete;
  });
  
  useEffect(() => {
    if (!mint) return;
    
    const client = getSupabaseClient();
    const channel = client
      .channel(uniqueChannel(`chat:${mint}`))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `token_mint=eq.${mint}`, // Server-side filter
        },
        (payload: RealtimePostgresChangesPayload<RealtimeMessage>) => {
          onInsertRef.current?.(payload.new as RealtimeMessage);
        }
      );
    
    if (onDeleteRef.current) {
      channel.on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `token_mint=eq.${mint}`,
        },
        (payload: RealtimePostgresChangesPayload<RealtimeMessage>) => {
          onDeleteRef.current?.((payload.old as RealtimeMessage).id);
        }
      );
    }
    
    channel.subscribe((status, err) => {
      logSubscriptionStatus('useChatMessages/chat_messages', status, err);
    });
    
    return () => {
      // In dev, StrictMode double-invokes effects. Skipping cleanup on the
      // fake unmount prevents killing the WebSocket prematurely.
      // Real navigation/unmount in dev may leak channels, but that's acceptable.
      if (!isDev) {
        client.removeChannel(channel);
      }
    };
  }, [mint]);
}

// Hook for subscribing to trades
export function useTrades(
  mint: string | null,
  onInsert: (trade: RealtimeTrade) => void
) {
  const onInsertRef = useRef(onInsert);
  
  useEffect(() => {
    onInsertRef.current = onInsert;
  });
  
  useEffect(() => {
    if (!mint) return;
    
    const client = getSupabaseClient();
    const channel = client
      .channel(uniqueChannel(`trades:${mint}`))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trades',
          filter: `token_mint=eq.${mint}`, // Server-side filter
        },
        (payload: RealtimePostgresChangesPayload<RealtimeTrade>) => {
          onInsertRef.current?.(payload.new as RealtimeTrade);
        }
      )
      .subscribe((status, err) => {
        logSubscriptionStatus('useTrades/trades', status, err);
      });
    
    return () => {
      // In dev, StrictMode double-invokes effects. Skipping cleanup on the
      // fake unmount prevents killing the WebSocket prematurely.
      // Real navigation/unmount in dev may leak channels, but that's acceptable.
      if (!isDev) {
        client.removeChannel(channel);
      }
    };
  }, [mint]);
}

// Hook for subscribing to candles
export function useCandles(
  mint: string | null,
  onUpdate: () => void
) {
  const onUpdateRef = useRef(onUpdate);
  
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });
  
  useEffect(() => {
    if (!mint) return;
    
    const client = getSupabaseClient();
    const channel = client
      .channel(uniqueChannel(`candles:${mint}`))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'price_candles',
          filter: `token_mint=eq.${mint}`, // Server-side filter
        },
        () => {
          onUpdateRef.current?.();
        }
      )
      .subscribe((status, err) => {
        logSubscriptionStatus('useCandles/price_candles', status, err);
      });
    
    return () => {
      // In dev, StrictMode double-invokes effects. Skipping cleanup on the
      // fake unmount prevents killing the WebSocket prematurely.
      // Real navigation/unmount in dev may leak channels, but that's acceptable.
      if (!isDev) {
        client.removeChannel(channel);
      }
    };
  }, [mint]);
}

// Hook for subscribing to SOL price
export function useSolPrice(onUpdate: (price: SolPriceUpdate) => void) {
  const onUpdateRef = useRef(onUpdate);
  
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });
  
  useEffect(() => {
    const client = getSupabaseClient();
    const channel = client
      .channel(uniqueChannel('sol-price'))
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sol_price',
        },
        (payload: RealtimePostgresChangesPayload<SolPriceUpdate>) => {
          onUpdateRef.current?.(payload.new as SolPriceUpdate);
        }
      )
      .subscribe((status, err) => {
        logSubscriptionStatus('useSolPrice/sol_price', status, err);
      });
    
    return () => {
      // In dev, StrictMode double-invokes effects. Skipping cleanup on the
      // fake unmount prevents killing the WebSocket prematurely.
      // Real navigation/unmount in dev may leak channels, but that's acceptable.
      if (!isDev) {
        client.removeChannel(channel);
      }
    };
  }, []);
}

// Hook for subscribing to reactions
export function useReactions(
  mint: string | null,
  onChange: () => void
) {
  const onChangeRef = useRef(onChange);
  
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  
  useEffect(() => {
    if (!mint) return;
    
    const client = getSupabaseClient();
    const channel = client
      .channel(uniqueChannel(`reactions:${mint}`))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        () => {
          onChangeRef.current?.();
        }
      )
      .subscribe((status, err) => {
        logSubscriptionStatus('useReactions/message_reactions', status, err);
      });
    
    return () => {
      // In dev, StrictMode double-invokes effects. Skipping cleanup on the
      // fake unmount prevents killing the WebSocket prematurely.
      // Real navigation/unmount in dev may leak channels, but that's acceptable.
      if (!isDev) {
        client.removeChannel(channel);
      }
    };
  }, [mint]);
}


// ============================================
// ADDITIONAL REACT HOOKS WITH AUTO-CLEANUP
// ============================================

// Hook for subscribing to token stats updates
export function useTokenStats(
  mint: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase realtime payload
  onUpdate: (token: any) => void
) {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  useEffect(() => {
    if (!mint) return;

    const client = getSupabaseClient();
    const channel = client
      .channel(uniqueChannel(`token:${mint}:hook`))
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tokens',
          filter: `mint=eq.${mint}`,
        },
        (payload) => {
          onUpdateRef.current?.(payload.new);
        }
      )
      .subscribe((status, err) => {
        logSubscriptionStatus('useTokenStats/tokens', status, err);
      });

    return () => {
      // In dev, StrictMode double-invokes effects. Skipping cleanup on the
      // fake unmount prevents killing the WebSocket prematurely.
      // Real navigation/unmount in dev may leak channels, but that's acceptable.
      if (!isDev) {
        client.removeChannel(channel);
      }
    };
  }, [mint]);
}

// Hook for subscribing to all tokens (INSERT and UPDATE)
export function useAllTokens(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase realtime payload
  onNewToken: (token: any) => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase realtime payload
  onUpdateToken: (token: any) => void
) {
  const onNewTokenRef = useRef(onNewToken);
  const onUpdateTokenRef = useRef(onUpdateToken);

  useEffect(() => {
    onNewTokenRef.current = onNewToken;
    onUpdateTokenRef.current = onUpdateToken;
  });

  useEffect(() => {
    const client = getSupabaseClient();
    const channel = client
      .channel(uniqueChannel('all-tokens:hook'))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tokens',
        },
        (payload) => {
          onNewTokenRef.current?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tokens',
        },
        (payload) => {
          onUpdateTokenRef.current?.(payload.new);
        }
      )
      .subscribe((status, err) => {
        logSubscriptionStatus('useAllTokens/tokens', status, err);
      });

    return () => {
      // In dev, StrictMode double-invokes effects. Skipping cleanup on the
      // fake unmount prevents killing the WebSocket prematurely.
      // Real navigation/unmount in dev may leak channels, but that's acceptable.
      if (!isDev) {
        client.removeChannel(channel);
      }
    };
  }, []);
}

// Hook for subscribing to SOL price updates
export function useSolPriceHook(
  onUpdate: (price: SolPriceUpdate) => void
) {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  useEffect(() => {
    const client = getSupabaseClient();
    const channel = client
      .channel(uniqueChannel('sol-price:hook'))
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sol_price',
        },
        (payload) => {
          onUpdateRef.current?.(payload.new as SolPriceUpdate);
        }
      )
      .subscribe((status, err) => {
        logSubscriptionStatus('useSolPriceHook/sol_price', status, err);
      });

    return () => {
      // In dev, StrictMode double-invokes effects. Skipping cleanup on the
      // fake unmount prevents killing the WebSocket prematurely.
      // Real navigation/unmount in dev may leak channels, but that's acceptable.
      if (!isDev) {
        client.removeChannel(channel);
      }
    };
  }, []);
}

// Hook for subscribing to all trades (for volume updates)
export function useAllTrades(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase realtime payload
  onNewTrade: (trade: any) => void
) {
  const onNewTradeRef = useRef(onNewTrade);

  useEffect(() => {
    onNewTradeRef.current = onNewTrade;
  });

  useEffect(() => {
    const client = getSupabaseClient();
    const channel = client
      .channel(uniqueChannel('all-trades:hook'))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trades',
        },
        (payload) => {
          onNewTradeRef.current?.(payload.new);
        }
      )
      .subscribe((status, err) => {
        logSubscriptionStatus('useAllTrades/trades', status, err);
      });

    return () => {
      // In dev, StrictMode double-invokes effects. Skipping cleanup on the
      // fake unmount prevents killing the WebSocket prematurely.
      // Real navigation/unmount in dev may leak channels, but that's acceptable.
      if (!isDev) {
        client.removeChannel(channel);
      }
    };
  }, []);
}
