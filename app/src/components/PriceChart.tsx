'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, CandlestickData, ColorType, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { useCandles, useSolPriceHook } from '@/lib/supabase-client';
import { INITIAL_VIRTUAL_TOKENS, INITIAL_VIRTUAL_SOL } from '@/lib/types';
import { useSolPrice } from '@/hooks/useSolPrice';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PriceChartProps {
  mint: string;
  height?: number;
  totalSupply?: number;
  // Live stats from parent
  currentMarketCap?: number;
  marketCapSol?: number;
  marketCapUsd?: number | null;
  volume24h?: number;
  holders?: number;
  priceChange24h?: number | null;
  // ATH from token record (streamed via Supabase realtime)
  athUsd?: number;
  // Callback when market cap updates (source of truth)
  onMarketCapUpdate?: (marketCap: number) => void;
}

type ChartType = 'line' | 'candle';
type Interval = '1m' | '5m' | '15m' | '1h' | '1d';


export default function PriceChart({
  mint,
  height = 400,
  totalSupply = INITIAL_VIRTUAL_TOKENS,
  currentMarketCap = 0,
  priceChange24h: priceChange24hProp,
  athUsd: athUsdProp,
  onMarketCapUpdate,
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // Separate refs for each series type to prevent recreation on updates (Issue #47)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  // Ref to store last rendered time interval for viewport preservation (Issue #36)
  const lastRenderedRangeRef = useRef<Interval | null>(null);
  // Track if chart has ever been initialized to prevent unmounting on refetch
  const hasChartInitializedRef = useRef(false);
  // Track last candle count to detect actual data updates vs just re-renders
  const lastCandleCountRef = useRef<number>(0);
  
  const [candles, setCandles] = useState<Candle[]>([]);
  const [candles24h, setCandles24h] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<ChartType>('candle');
  // Group interval with candles to update atomically - prevents double render on change
  const [chartData, setChartData] = useState<{ interval: Interval; candles: Candle[] }>({
    interval: '5m',
    candles: [],
  });
  const timeInterval = chartData.interval;
  const candlesForChart = chartData.candles;

  // Get SOL price for virtual liquidity adjustment
  const { price: solPriceUsd } = useSolPrice();

  // Use API-provided 24h change for consistency across all intervals
  // This is well-defined (1m candle 24h ago vs current) vs ambiguous "today"
  const priceChange24h = useMemo(() => {
    if (priceChange24hProp !== null && priceChange24hProp !== undefined) {
      return priceChange24hProp;
    }

    // Fallback: calculate from visible candles
    const candlesToUse = candles24h.length > 0 ? candles24h : candles;

    if (candlesToUse.length === 0) return 0;

    // First candle's OPEN vs last candle's CLOSE
    const firstOpen = candlesToUse[0].open;
    const lastClose = candlesToUse[candlesToUse.length - 1].close;

    if (firstOpen === 0) return 0;

    return ((lastClose - firstOpen) / firstOpen) * 100;
  }, [candles24h, candles, priceChange24hProp]);

  // Calculate current market cap from last candle close (candles are USD price)
  const candleMarketCap = useMemo(() => {
    const candlesToUse = candles.length > 0 ? candles : candles24h;
    if (candlesToUse.length === 0) return null;
    
    const lastClose = candlesToUse[candlesToUse.length - 1].close;
    // Candles are USD price per token, multiply by supply for market cap
    const mcapUsd = lastClose * totalSupply;
    
    return { usd: mcapUsd };
  }, [candles, candles24h, totalSupply]);

  // ATH price: prefer DB value (streamed), fallback to visible candle highs
  const athPrice = useMemo(() => {
    // DB ATH is the source of truth (set by heartbeat cron, covers all history)
    if (athUsdProp && athUsdProp > 0) {
      return athUsdProp; // Already USD price per token
    }

    // Fallback: find ATH from visible candle highs
    const allCandles = candles24h.length > candles.length ? candles24h : candles;
    let maxPrice = 0;
    allCandles.forEach(c => {
      if (c.high > maxPrice) maxPrice = c.high;
    });
    if (maxPrice === 0 && currentMarketCap > 0) {
      maxPrice = currentMarketCap / totalSupply;
    }
    return maxPrice;
  }, [athUsdProp, candles, candles24h, currentMarketCap, totalSupply]);

  // Effective market cap: last candle close * totalSupply (in USD)
  const effectiveMarketCap = useMemo(() => {
    if (candles.length > 0) {
      return candles[candles.length - 1].close * totalSupply;
    }
    return 0; // No candles = no market cap yet
  }, [candles, totalSupply]);

  // Notify parent when market cap updates (candles = source of truth)
  useEffect(() => {
    if (effectiveMarketCap > 0 && onMarketCapUpdate) {
      onMarketCapUpdate(effectiveMarketCap);
    }
  }, [effectiveMarketCap, onMarketCapUpdate]);

  // Calculate ATH progress (how close current market cap is to ATH market cap)
  // Subtract virtual liquidity to show real tradeable value
  const virtualLiquidityUsd = solPriceUsd ? INITIAL_VIRTUAL_SOL * solPriceUsd : 0;
  const athMarketCap = athPrice > 0 ? Math.max(0, athPrice * totalSupply - virtualLiquidityUsd) : 0;
  const adjustedEffectiveMarketCap = Math.max(0, effectiveMarketCap - virtualLiquidityUsd);
  const athProgress = athMarketCap > 0 ? (adjustedEffectiveMarketCap / athMarketCap) * 100 : 100;

  // Track which interval fetch is in-flight to prevent stale updates
  const fetchIntervalRef = useRef<Interval | null>(null);

  // Fetch candles function (reusable) - updates chartData atomically
  const fetchCandles = useCallback(async (targetInterval: Interval) => {
    // Mark this interval as the one we're loading
    fetchIntervalRef.current = targetInterval;
    try {
      // Fetch USD candles directly from API
      const res = await fetch(`/api/candles?mint=${mint}&interval=${targetInterval}&limit=200&currency=usd`);
      const data = await res.json();
      // Only apply if this is still the interval we want (prevents stale race conditions)
      if (fetchIntervalRef.current !== targetInterval) return;
      const newCandles = data.candles?.length > 0 ? data.candles : [];
      setCandles(newCandles);
      // Update chartData atomically with interval and candles together
      setChartData({ interval: targetInterval, candles: newCandles });
    } catch (err) {
      console.error('Failed to fetch candles:', err);
      if (fetchIntervalRef.current !== targetInterval) return;
      setCandles([]);
      setChartData({ interval: targetInterval, candles: [] });
    }
  }, [mint]);

  const fetch24hCandles = useCallback(async () => {
    try {
      // Fetch USD candles for 24h view
      const res = await fetch(`/api/candles?mint=${mint}&interval=1h&limit=30&currency=usd`);
      const data = await res.json();
      setCandles24h(data.candles?.length > 0 ? data.candles : []);
    } catch (err) {
      console.error('Failed to fetch 24h candles:', err);
    }
  }, [mint]);

  // Initial fetch on mount
  useEffect(() => {
    fetchCandles('5m').finally(() => setLoading(false));
    fetch24hCandles();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount/mint change
  }, [mint]);

  // Subscribe to realtime candle updates
  useCandles(mint, () => {
    console.log('[PriceChart] Candle update received, refetching...');
    fetchCandles(chartData.interval);
    fetch24hCandles();
  });

  // Subscribe to SOL price updates - refetch candles when SOL price changes
  // This updates the USD close price dynamically
  useSolPriceHook(() => {
    console.log('[PriceChart] SOL price update received, refetching candles...');
    fetchCandles(chartData.interval);
    fetch24hCandles();
  });

  // Create/update chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Format price axis values (e.g., 3.2K instead of 3200)
    const formatAxisPrice = (price: number): string => {
      if (price >= 1000000) return '$' + (price / 1000000).toFixed(1) + 'M';
      if (price >= 1000) return '$' + (price / 1000).toFixed(1) + 'K';
      if (price >= 1) return '$' + price.toFixed(2);
      return '$' + price.toFixed(4);
    };

    if (!chartRef.current) {
      chartRef.current = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#6b7280',
        },
        grid: {
          vertLines: { color: 'rgba(55, 65, 81, 0.3)' },
          horzLines: { color: 'rgba(55, 65, 81, 0.3)' },
        },
        width: chartContainerRef.current.clientWidth,
        height: height - 160, // Account for header
        crosshair: {
          mode: 1,
          vertLine: { color: '#f97316', width: 1, style: 2 },
          horzLine: { color: '#f97316', width: 1, style: 2 },
        },
        timeScale: {
          borderColor: 'rgba(55, 65, 81, 0.5)',
          timeVisible: true,
          secondsVisible: false,
          barSpacing: 3, // Narrow candles like pump.fun
        },
        rightPriceScale: {
          borderColor: 'rgba(55, 65, 81, 0.5)',
        },
        localization: {
          priceFormatter: formatAxisPrice,
        },
      });
      // Mark chart as initialized to prevent unmounting on data refetch
      hasChartInitializedRef.current = true;
    }

    // Get the visible logical range BEFORE the data update (index-based, not time-based) (Issue #36)
    const timeScale = chartRef.current?.timeScale();
    const logicalRange = timeScale?.getVisibleLogicalRange();

    // Candles are USD price per token from API - convert to market cap for display
    const mcapMultiplier = totalSupply;

    // Create candle series once (Issue #47)
    if (!candleSeriesRef.current) {
      candleSeriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
        priceScaleId: 'right',
      });
      candleSeriesRef.current.priceScale().applyOptions({
        scaleMargins: { top: 0.1, bottom: 0.3 }, // More room at top for pumps
      });
    }

    // Create line series once (Issue #47)
    if (!lineSeriesRef.current) {
      lineSeriesRef.current = chartRef.current.addSeries(LineSeries, {
        color: priceChange24h >= 0 ? '#22c55e' : '#ef4444',
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        priceLineVisible: false,
        priceScaleId: 'right',
      });
      lineSeriesRef.current.priceScale().applyOptions({
        scaleMargins: { top: 0.1, bottom: 0.3 }, // More room at top for pumps
      });
    }

    // Update candle data (Issue #47)
    if (candlesForChart.length > 0 && candleSeriesRef.current) {
      const candleData: CandlestickData[] = candlesForChart.map(c => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lightweight-charts Time type
        time: c.time as any,
        open: c.open * mcapMultiplier,
        high: c.high * mcapMultiplier,
        low: c.low * mcapMultiplier,
        close: c.close * mcapMultiplier,
      }));
      candleSeriesRef.current.setData(candleData);
    }

    // Update line data (Issue #47)
    if (candlesForChart.length > 0 && lineSeriesRef.current) {
      const lineData: LineData[] = candlesForChart.map(c => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lightweight-charts Time type
        time: c.time as any,
        value: c.close * mcapMultiplier,
      }));
      lineSeriesRef.current.setData(lineData);
    }

    // Toggle visibility based on chart type (Issue #47)
    if (candleSeriesRef.current) {
      candleSeriesRef.current.applyOptions({ visible: chartType === 'candle' });
    }
    if (lineSeriesRef.current) {
      lineSeriesRef.current.applyOptions({ visible: chartType === 'line' });
    }

    // Handle viewport preservation (Issue #36)
    // If the chart is already rendered
    if (candlesForChart.length > 0 && chartRef.current) {
      if (timeInterval !== lastRenderedRangeRef.current) {
        // New time range selected - fit content initially, then set 24h range for short intervals
        chartRef.current?.timeScale().fitContent();
        
        // For intervals other than 1d, set visible range to last 24 hours
        if (timeInterval !== '1d' && candlesForChart.length > 0) {
          const lastCandle = candlesForChart[candlesForChart.length - 1];
          const firstCandle = candlesForChart[0];
          const twentyFourHoursAgo = lastCandle.time - (24 * 60 * 60); // 24 hours in seconds
          
          // Only set range if we have data older than 24 hours
          if (firstCandle.time <= twentyFourHoursAgo) {
            chartRef.current.timeScale().setVisibleRange({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lightweight-charts Time type
              from: twentyFourHoursAgo as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lightweight-charts Time type
              to: lastCandle.time as any,
            });
          }
        }
        
        lastRenderedRangeRef.current = timeInterval;
        lastCandleCountRef.current = candlesForChart.length;
      } else if (timeScale && logicalRange && candlesForChart.length !== lastCandleCountRef.current) {
        // Same range, new data arrived (candle count changed) - preserve viewport position
        // Only preserve if user has panned away from the right edge (viewing history)
        const isAtLiveEdge = logicalRange.to >= candlesForChart.length - 2;
        if (!isAtLiveEdge) {
          timeScale.setVisibleLogicalRange(logicalRange);
        }
        lastCandleCountRef.current = candlesForChart.length;
      }
    } else if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
      lastRenderedRangeRef.current = timeInterval;
      lastCandleCountRef.current = candlesForChart.length;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refs and multiplier are stable
  }, [chartData, chartType, height, totalSupply]);

  // Separate effect for line color updates - only runs when priceChange24h actually changes
  useEffect(() => {
    if (lineSeriesRef.current && chartType === 'line') {
      lineSeriesRef.current.applyOptions({
        color: priceChange24h >= 0 ? '#22c55e' : '#ef4444',
      });
    }
  }, [priceChange24h, chartType]);

  // Separate resize handling effect - only depends on chart existence
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        const width = chartContainerRef.current.clientWidth;
        if (width > 0) {
          chartRef.current.applyOptions({ width });
        }
      }
    };

    // Initial resize after a small delay to ensure container is measured
    const timeoutId = setTimeout(handleResize, 100);

    // Watch for container size changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    // Also listen to window resize
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Format helpers
  const formatMcap = (n: number) => {
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
    if (n >= 1) return '$' + n.toFixed(2);
    return '$' + n.toFixed(4);
  };



  return (
    <div className="flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden min-w-0">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.04]">
        {/* Market Cap + ATH */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-vault-dim mb-1">Market Cap</div>
            <div className="text-2xl font-bold text-vault-text font-mono lg:text-3xl">
              {candleMarketCap?.usd ? formatMcap(candleMarketCap.usd) : '--'}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-sm font-medium font-mono ${priceChange24h >= 0 ? 'text-vault-green' : 'text-vault-red'}`}>
                {priceChange24h >= 0 ? '+' : ''}
                {candleMarketCap?.usd
                  ? formatMcap(Math.abs(priceChange24h / 100 * candleMarketCap.usd))
                  : '--'
                } ({priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%)
              </span>
              <span className="text-vault-dim text-xs">24h</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-vault-dim mb-1">ATH</div>
            <div className="text-vault-green font-bold text-lg font-mono">
              {athMarketCap > 0 ? formatMcap(athMarketCap) : '--'}
            </div>
          </div>
        </div>

        {/* ATH progress */}
        <div className="mb-4">
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${athProgress >= 95 ? 'bg-vault-green' : 'bg-vault-accent/70'}`}
              style={{ width: `${Math.min(athProgress, 100)}%` }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {(['1m', '5m', '15m', '1h', '1d'] as Interval[]).map((i) => (
              <button
                key={i}
                onClick={() => { if (i !== timeInterval) fetchCandles(i); }}
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition sm:px-3 ${
                  timeInterval === i
                    ? 'bg-vault-accent text-vault-bg'
                    : 'border border-white/[0.06] bg-white/[0.02] text-vault-muted hover:border-white/[0.1] hover:text-vault-text'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setChartType('line')}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition sm:px-3 ${
                chartType === 'line'
                  ? 'bg-vault-accent text-vault-bg'
                  : 'border border-white/[0.06] bg-white/[0.02] text-vault-muted hover:border-white/[0.1] hover:text-vault-text'
              }`}
              aria-label="Line chart"
            >
              <span className="sm:hidden">Line</span>
              <span className="hidden sm:inline">Line</span>
            </button>
            <button
              onClick={() => setChartType('candle')}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition sm:px-3 ${
                chartType === 'candle'
                  ? 'bg-vault-accent text-vault-bg'
                  : 'border border-white/[0.06] bg-white/[0.02] text-vault-muted hover:border-white/[0.1] hover:text-vault-text'
              }`}
              aria-label="Candlestick chart"
            >
              <span className="sm:hidden">Candles</span>
              <span className="hidden sm:inline">Candles</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chart area */}
      {loading && candlesForChart.length === 0 ? (
        <div className="flex items-center justify-center text-vault-dim" style={{ height: height - 160 }}>
          <div className="flex flex-col items-center gap-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-vault-accent border-t-transparent" />
            <span className="text-xs">Loading chart...</span>
          </div>
        </div>
      ) : candlesForChart.length === 0 && !hasChartInitializedRef.current ? (
        <div className="flex flex-col items-center justify-center text-vault-dim" style={{ height: height - 160 }}>
          <svg className="mb-2 h-8 w-8 text-vault-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
          <span className="text-sm">No price history yet</span>
          <span className="text-xs text-vault-dim mt-1">Chart appears after first trade</span>
        </div>
      ) : (
        <div ref={chartContainerRef} className="w-full dark-scrollbar overflow-hidden" />
      )}
    </div>
  );
}
