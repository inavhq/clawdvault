'use client';

import { createClient, SupabaseClient, RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useEffect, useRef, useCallback, useContext, createContext, ReactNode } from 'react';

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

// Subscription status type
export type SubscriptionStatus = 
  | 'SUBSCRIBING' 
  | 'SUBSCRIBED' 
  | 'CHANNEL_ERROR' 
  | 'CLOSED' 
  | 'TIMED_OUT';

interface SubscriptionCallbacks {
  onStatusChange?: (status: SubscriptionStatus) => void;
  onError?: (error: Error) => void;
}

// Create a channel with error handling and auto-retry
function createChannelWithRetry(
  channelName: string,
  callbacks?: SubscriptionCallbacks
): { channel: RealtimeChannel; cleanup: () => void } {
  const client = getSupabaseClient();
  let retryTimeout: NodeJS.Timeout | null = null;
  let isActive = true;
  
  const createChannel = (): RealtimeChannel => {
    const channel = client.channel(channelName);
    
    channel.subscribe((status, err) => {
      if (!isActive) return;
      
      console.log(`[Realtime] ${channelName} status:`, status);
      
      if (status === 'SUBSCRIBED') {
        callbacks?.onStatusChange?.('SUBSCRIBED');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        callbacks?.onStatusChange?.(status as SubscriptionStatus);
        callbacks?.onError?.(err || new Error(`Subscription ${status}`));
        
        // Auto-retry after 5 seconds
        if (isActive && !retryTimeout) {
          console.log(`[Realtime] Retrying ${channelName} in 5s...`);
          retryTimeout = setTimeout(() => {
            retryTimeout = null;
            if (isActive) {
              client.removeChannel(channel);
              createChannel();
            }
          }, 5000);
        }
      } else if (status === 'CLOSED') {
        callbacks?.onStatusChange?.('CLOSED');
      }
    });
    
    return channel;
  };
  
  const channel = createChannel();
  
  const cleanup = () => {
    isActive = false;
    if (retryTimeout) {
      clearTimeout(retryTimeout);
    }
    client.removeChannel(channel);
  };
  
  return { channel, cleanup };
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
      .channel(`chat:${mint}`)
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
      if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Chat subscription error:', err);
      }
    });
    
    return () => {
      client.removeChannel(channel);
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
      .channel(`trades:${mint}`)
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
        if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Trades subscription error:', err);
        }
      });
    
    return () => {
      client.removeChannel(channel);
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
      .channel(`candles:${mint}`)
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
        if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Candles subscription error:', err);
        }
      });
    
    return () => {
      client.removeChannel(channel);
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
      .channel('sol-price')
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
        if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] SOL price subscription error:', err);
        }
      });
    
    return () => {
      client.removeChannel(channel);
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
      .channel(`reactions:${mint}`)
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
        if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Reactions subscription error:', err);
        }
      });
    
    return () => {
      client.removeChannel(channel);
    };
  }, [mint]);
}

// ============================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================

// These are kept for backward compatibility but deprecated
/** @deprecated Use useChatMessages hook instead */
export function subscribeToChatMessages(
  mint: string,
  onInsert: (message: RealtimeMessage) => void,
  onDelete?: (id: string) => void
): RealtimeChannel {
  const client = getSupabaseClient();
  
  const channel = client
    .channel(`chat:${mint}:legacy`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `token_mint=eq.${mint}`,
      },
      (payload) => {
        onInsert(payload.new as RealtimeMessage);
      }
    );
  
  if (onDelete) {
    channel.on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_messages',
        filter: `token_mint=eq.${mint}`,
      },
      (payload) => {
        onDelete((payload.old as RealtimeMessage).id);
      }
    );
  }
  
  channel.subscribe((status, err) => {
    if (status === 'CHANNEL_ERROR') {
      console.error('[Realtime] Chat subscription error:', err);
    }
  });
  
  return channel;
}

/** @deprecated Use useTrades hook instead */
export function subscribeToTrades(
  mint: string,
  onInsert: (trade: RealtimeTrade) => void
): RealtimeChannel {
  const client = getSupabaseClient();
  
  const channel = client
    .channel(`trades:${mint}:legacy`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'trades',
        filter: `token_mint=eq.${mint}`,
      },
      (payload) => {
        onInsert(payload.new as RealtimeTrade);
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Trades subscription error:', err);
      }
    });
  
  return channel;
}

/** @deprecated Use useCandles hook instead */
export function subscribeToCandles(
  mint: string,
  onUpdate: () => void
): RealtimeChannel {
  const client = getSupabaseClient();
  
  const channel = client
    .channel(`candles:${mint}:legacy`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'price_candles',
        filter: `token_mint=eq.${mint}`,
      },
      () => {
        onUpdate();
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Candles subscription error:', err);
      }
    });
  
  return channel;
}

/** @deprecated Use useSolPrice hook instead */
export function subscribeToSolPrice(
  onUpdate: (price: SolPriceUpdate) => void
): RealtimeChannel {
  const client = getSupabaseClient();
  
  const channel = client
    .channel('sol-price:legacy')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'sol_price',
      },
      (payload) => {
        onUpdate(payload.new as SolPriceUpdate);
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] SOL price subscription error:', err);
      }
    });
  
  return channel;
}

/** @deprecated Use useReactions hook instead */
export function subscribeToReactions(
  mint: string,
  onChange: () => void
): RealtimeChannel {
  const client = getSupabaseClient();
  
  const channel = client
    .channel(`reactions:${mint}:legacy`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'message_reactions',
      },
      () => {
        onChange();
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Reactions subscription error:', err);
      }
    });
  
  return channel;
}

/** @deprecated Use useTokenStats hook instead */
export function subscribeToTokenStats(
  mint: string,
  onUpdate: (token: any) => void
): RealtimeChannel {
  const client = getSupabaseClient();
  
  const channel = client
    .channel(`token:${mint}:legacy`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'tokens',
        filter: `mint=eq.${mint}`,
      },
      (payload) => {
        onUpdate(payload.new);
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Token stats subscription error:', err);
      }
    });
  
  return channel;
}

/** @deprecated Use hooks instead */
export function subscribeToAllTokens(
  onInsert: (token: any) => void,
  onUpdate: (token: any) => void
): RealtimeChannel {
  const client = getSupabaseClient();
  
  const channel = client
    .channel('all-tokens:legacy')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'tokens',
      },
      (payload) => {
        onInsert(payload.new);
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
        onUpdate(payload.new);
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] All tokens subscription error:', err);
      }
    });
  
  return channel;
}

/** @deprecated Use hooks instead */
export function subscribeToAllTrades(
  onInsert: (trade: any) => void
): RealtimeChannel {
  const client = getSupabaseClient();
  
  const channel = client
    .channel('all-trades:legacy')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'trades',
      },
      (payload) => {
        onInsert(payload.new);
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] All trades subscription error:', err);
      }
    });
  
  return channel;
}

/** @deprecated Channels now auto-cleanup with hooks */
export function unsubscribeChannel(channel: RealtimeChannel): void {
  const client = getSupabaseClient();
  client.removeChannel(channel);
}

// ============================================
// ADDITIONAL REACT HOOKS WITH AUTO-CLEANUP
// ============================================

// Hook for subscribing to token stats updates
export function useTokenStats(
  mint: string | null,
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
      .channel(`token:${mint}:hook`)
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
        if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Token stats subscription error:', err);
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  }, [mint]);
}

// Hook for subscribing to all tokens (INSERT and UPDATE)
export function useAllTokens(
  onNewToken: (token: any) => void,
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
      .channel('all-tokens:hook')
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
        if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] All tokens subscription error:', err);
        }
      });

    return () => {
      client.removeChannel(channel);
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
      .channel('sol-price:hook')
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
        if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] SOL price subscription error:', err);
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  }, []);
}

// Hook for subscribing to all trades (for volume updates)
export function useAllTrades(
  onNewTrade: (trade: any) => void
) {
  const onNewTradeRef = useRef(onNewTrade);

  useEffect(() => {
    onNewTradeRef.current = onNewTrade;
  });

  useEffect(() => {
    const client = getSupabaseClient();
    const channel = client
      .channel('all-trades:hook')
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
        if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] All trades subscription error:', err);
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  }, []);
}
