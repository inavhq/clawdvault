import Link from 'next/link'
import { db } from '@/lib/prisma'
import { getSiteStats } from '@/lib/db'
import { INITIAL_VIRTUAL_TOKENS } from '@/lib/types'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import HomeStats from '@/components/HomeStats'
import { HeroSection, HowItWorksSection, SkillMdSection, OnboardAgentSection, TrustSignals } from '@/components/HomeSections'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cache for server-side SOL price
let cachedSolPrice: number | null = null;
let lastSolPriceFetch: number = 0;
const SOL_PRICE_CACHE_MS = 60 * 1000;

async function getSolPrice(): Promise<number | null> {
  const now = Date.now();
  if (cachedSolPrice !== null && (now - lastSolPriceFetch) < SOL_PRICE_CACHE_MS) {
    return cachedSolPrice;
  }
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000)
    });
    const data = await res.json();
    if (data.solana?.usd) {
      cachedSolPrice = data.solana.usd;
      lastSolPriceFetch = now;
      return cachedSolPrice;
    }
  } catch (e) {
    console.warn('[Homepage] CoinGecko failed:', e);
  }
  try {
    const res = await fetch('https://price.jup.ag/v6/price?ids=SOL', {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000)
    });
    const data = await res.json();
    if (data.data?.SOL?.price) {
      cachedSolPrice = data.data.SOL.price;
      lastSolPriceFetch = now;
      return cachedSolPrice;
    }
  } catch (e) {
    console.warn('[Homepage] Jupiter failed:', e);
  }
  return cachedSolPrice;
}

async function getHomeData() {
  try {
    const solPrice = await getSolPrice()
    const totalTokens = await db().token.count()
    const graduatedCount = await db().token.count({
      where: { graduated: true }
    })
    const agentCount = await db().agent.count()
    const userCount = await db().user.count({ where: { agent: { is: null } } })
    const pageViews = await getSiteStats('page_views')
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const volumeResult = await db().trade.aggregate({
      where: { createdAt: { gte: oneDayAgo } },
      _sum: { solAmount: true }
    })
    const totalVolume = Number(volumeResult._sum.solAmount || 0)

    const recentTokens = await db().token.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6
    })

    const trendingTrades = await db().trade.groupBy({
      by: ['tokenMint'],
      where: { createdAt: { gte: oneDayAgo } },
      _sum: { solAmount: true },
      orderBy: { _sum: { solAmount: 'desc' } },
      take: 6
    })

    const trendingMints = trendingTrades.map(t => t.tokenMint)
    const trendingTokens = trendingMints.length > 0
      ? await db().token.findMany({
          where: { mint: { in: trendingMints } }
        })
      : []

    const trendingWithVolume = trendingTokens.map(token => ({
      ...token,
      volume24h: Number(trendingTrades.find(t => t.tokenMint === token.mint)?._sum.solAmount || 0)
    })).sort((a, b) => b.volume24h - a.volume24h)

    const allTokenMints = [
      ...recentTokens.map(t => t.mint),
      ...trendingWithVolume.map(t => t.mint)
    ]
    const uniqueMints = Array.from(new Set(allTokenMints))

    const lastCandles = await db().priceCandle.findMany({
      where: { tokenMint: { in: uniqueMints } },
      orderBy: { bucketTime: 'desc' },
      distinct: ['tokenMint'],
      select: {
        tokenMint: true,
        close: true,
        closeUsd: true
      }
    })

    const lastCandleMap = new Map(lastCandles.map(c => [c.tokenMint, {
      priceSol: c.close ? Number(c.close) : undefined,
      priceUsd: c.closeUsd ? Number(c.closeUsd) : undefined
    }]))

    // Use token's price_24h_ago field (set by heartbeat cron) for price change
    const allTokens = [...recentTokens, ...trendingWithVolume]
    const priceChange24hMap = new Map<string, number | null>()
    for (const mint of uniqueMints) {
      const lastCandle = lastCandleMap.get(mint)
      const token = allTokens.find(t => t.mint === mint)
      const price24hAgo = token?.price24hAgo ? Number(token.price24hAgo) : null

      if (lastCandle?.priceUsd && price24hAgo && price24hAgo > 0) {
        const change = ((lastCandle.priceUsd - price24hAgo) / price24hAgo) * 100
        priceChange24hMap.set(mint, change)
      } else {
        priceChange24hMap.set(mint, null)
      }
    }

    return {
      totalTokens,
      graduatedCount,
      totalVolume,
      agentCount,
      userCount,
      pageViews,
      recentTokens,
      trendingTokens: trendingWithVolume,
      solPrice,
      lastCandleMap,
      priceChange24hMap
    }
  } catch (error) {
    console.error('Error fetching home data:', error)
    return {
      totalTokens: 0,
      graduatedCount: 0,
      totalVolume: 0,
      agentCount: 0,
      userCount: 0,
      pageViews: 0,
      recentTokens: [],
      trendingTokens: [],
      solPrice: 100,
      lastCandleMap: new Map(),
      priceChange24hMap: new Map()
    }
  }
}

function formatUsd(num: number): string {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`
  if (num >= 1) return `$${num.toFixed(0)}`
  return `$${num.toFixed(2)}`
}

function formatSol(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M SOL`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K SOL`
  return `${num.toFixed(2)} SOL`
}

function formatValue(solAmount: number, solPrice: number | null): string {
  if (solPrice !== null) {
    return formatUsd(solAmount * solPrice);
  }
  return formatSol(solAmount);
}

function getMarketCap(token: { virtualSolReserves: unknown; virtualTokenReserves: unknown }, lastCandle?: { priceUsd?: number | null; priceSol?: number | null }): { sol: number; usd: number | null } {
  if (lastCandle?.priceUsd) {
    return {
      sol: (lastCandle.priceUsd / (lastCandle.priceSol || 1)) * INITIAL_VIRTUAL_TOKENS,
      usd: lastCandle.priceUsd * INITIAL_VIRTUAL_TOKENS
    }
  }
  const virtualSol = Number(token.virtualSolReserves)
  const virtualTokens = Number(token.virtualTokenReserves)
  const price = virtualSol / virtualTokens
  return {
    sol: price * INITIAL_VIRTUAL_TOKENS,
    usd: null
  }
}

function TokenCard({ token, solPrice, lastCandle, priceChange24h }: { token: { mint: string; name: string; symbol: string; image: string | null; graduated: boolean; virtualSolReserves: unknown; virtualTokenReserves: unknown }; solPrice: number | null; lastCandle?: { priceUsd?: number | null; priceSol?: number | null }; priceChange24h?: number | null }) {
  const mcap = getMarketCap(token, lastCandle)
  const formatPriceChange = (change: number | null | undefined) => {
    if (change === null || change === undefined) return null
    const sign = change >= 0 ? '+' : ''
    return `${sign}${change.toFixed(1)}%`
  }
  const priceChangeText = formatPriceChange(priceChange24h)
  const isPositive = priceChange24h !== null && priceChange24h !== undefined && priceChange24h >= 0

  // Calculate bonding curve progress
  const GRADUATION_SOL = 85
  const virtualSol = Number(token.virtualSolReserves || 0)
  const initialSol = 30
  const progress = Math.min(((virtualSol - initialSol) / (GRADUATION_SOL - initialSol)) * 100, 100)

  return (
    <Link
      href={`/tokens/${token.mint}`}
      className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all hover:border-vault-accent/30 hover:bg-white/[0.04]"
    >
      {/* Token Image */}
      <div className="relative shrink-0">
        {token.image ? (
          <img
            src={token.image}
            alt={token.name}
            className="h-11 w-11 rounded-lg object-cover ring-1 ring-white/[0.06] transition-all group-hover:ring-vault-accent/30"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-vault-accent/10 text-lg font-bold text-vault-accent">
            {token.symbol?.[0] || '?'}
          </div>
        )}
      </div>

      {/* Token Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-vault-text transition-colors group-hover:text-vault-accent">
            {token.name}
          </span>
          {token.graduated && (
            <span className="shrink-0 rounded bg-vault-green/10 px-1.5 py-0.5 text-[10px] font-medium text-vault-green">
              GRAD
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-vault-muted">${token.symbol}</span>
          {priceChangeText && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              isPositive
                ? 'bg-vault-green/10 text-vault-green'
                : 'bg-vault-red/10 text-vault-red'
            }`}>
              {priceChangeText}
            </span>
          )}
        </div>
        {/* Bonding curve micro-bar */}
        {!token.graduated && (
          <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-vault-accent/60 transition-all"
              style={{ width: `${Math.max(progress, 2)}%` }}
            />
          </div>
        )}
      </div>

      {/* Market Cap */}
      <div className="shrink-0 text-right">
        <div className="font-mono text-sm font-semibold text-vault-green">
          {mcap.usd !== null ? formatUsd(mcap.usd) : formatValue(mcap.sol, solPrice)}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-vault-dim">mcap</div>
      </div>
    </Link>
  )
}

export default async function Home() {
  const data = await getHomeData()

  return (
    <main className="min-h-screen">
      <Header />

      <HeroSection />

      {/* Stats Bar */}
      <section className="px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <HomeStats
            initialTokens={data.totalTokens}
            initialGraduated={data.graduatedCount}
            initialVolume={data.totalVolume}
            initialAgents={data.agentCount}
            initialUsers={data.userCount}
            initialPageViews={data.pageViews}
            solPrice={data.solPrice}
          />
        </div>
      </section>

      <HowItWorksSection />

      {/* Live Activity Feed */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 flex items-center gap-3">
            <div className="relative flex h-2.5 w-2.5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vault-green opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-vault-green" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-vault-text md:text-3xl">
              Live on ClawdVault
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Trending */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vault-muted">
                Trending
              </h3>
              {data.trendingTokens.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {data.trendingTokens.slice(0, 4).map((token) => (
                    <TokenCard
                      key={token.mint}
                      token={token}
                      solPrice={data.solPrice}
                      lastCandle={data.lastCandleMap.get(token.mint)}
                      priceChange24h={data.priceChange24hMap.get(token.mint)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-vault-muted">
                  No trading activity yet
                </div>
              )}
            </div>

            {/* Just Launched */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vault-muted">
                Just Launched
              </h3>
              {data.recentTokens.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {data.recentTokens.slice(0, 4).map((token) => (
                    <TokenCard
                      key={token.mint}
                      token={token}
                      solPrice={data.solPrice}
                      lastCandle={data.lastCandleMap.get(token.mint)}
                      priceChange24h={data.priceChange24hMap.get(token.mint)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-vault-muted">
                  No tokens yet
                </div>
              )}
            </div>
          </div>

          {data.recentTokens.length > 0 && (
            <div className="mt-8 text-center">
              <Link
                href="/tokens"
                className="text-sm font-medium text-vault-accent transition-colors hover:text-vault-accent-hover"
              >
                View all tokens →
              </Link>
            </div>
          )}
        </div>
      </section>

      <SkillMdSection />
      <OnboardAgentSection />
      <TrustSignals />

      <Footer />
    </main>
  )
}
