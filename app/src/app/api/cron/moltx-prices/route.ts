/**
 * Cron: Post top token prices to Moltx
 * Runs every 30 minutes
 */

import { NextResponse } from 'next/server';
import { getAllTokens } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MOLTX_API_KEY = process.env.MOLTX_API_KEY;
const MOLTX_BASE_URL = 'https://moltx.io/v1';
const CLAWDVAULT_URL = 'https://clawdvault.com';
const TOP_N = 5; // Number of tokens to feature

// Fetch SOL price
async function getSolPrice(): Promise<number> {
  try {
    const res = await fetch(`${CLAWDVAULT_URL}/api/sol-price`);
    const data = await res.json();
    return data.price || 0;
  } catch {
    return 0;
  }
}

// Format SOL amount (handles very small prices like 0.00000003)
function formatSol(amount: number): string {
  if (amount >= 1) return amount.toFixed(2);
  if (amount >= 0.1) return amount.toFixed(3);
  if (amount >= 0.0001) return amount.toFixed(4);
  if (amount >= 0.0000001) return amount.toFixed(8);
  // For extremely small numbers, use scientific notation
  return amount.toExponential(2);
}

// Format market cap in SOL
function formatMcap(mcap: number): string {
  if (mcap >= 1000) return (mcap / 1000).toFixed(1) + 'K';
  return mcap.toFixed(1);
}

// Format USD amount
function formatUsd(amount: number): string {
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(2) + 'M';
  if (amount >= 1000) return '$' + (amount / 1000).toFixed(1) + 'K';
  if (amount >= 1) return '$' + amount.toFixed(0);
  return '$' + amount.toFixed(2);
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('⚠️ Unauthorized cron attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!MOLTX_API_KEY) {
    return NextResponse.json({ 
      success: false, 
      error: 'MOLTX_API_KEY not configured' 
    }, { status: 500 });
  }

  console.log('📊 [CRON] Posting top token prices to Moltx...');

  try {
    // Get top tokens by market cap (non-graduated)
    const { tokens } = await getAllTokens({ 
      sort: 'market_cap', 
      graduated: false,
      perPage: TOP_N 
    });

    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active tokens to report',
      });
    }

    // Get SOL price for USD conversion
    const solPrice = await getSolPrice();
    
    // Build the price update post
    let content = `📊 ClawdVault Top ${tokens.length} Tokens\n\n`;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const rank = i + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      
      const mcapUsd = solPrice ? ` (${formatUsd(token.market_cap_sol * solPrice)})` : '';
      
      content += `${medal} $${token.symbol}\n`;
      content += `   🏦 MCap: ${formatMcap(token.market_cap_sol)} SOL${mcapUsd}\n`;
    }

    content += `\n🦞 Trade now: ${CLAWDVAULT_URL}\n`;
    content += `🤖 Agent API: ${CLAWDVAULT_URL}/skills.md\n`;
    content += `\n#ClawdVault #Solana`;

    // Post to Moltx
    const response = await fetch(`${MOLTX_BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MOLTX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Moltx] Price post failed:', data);
      return NextResponse.json({
        success: false,
        error: data.error || 'Moltx post failed',
      }, { status: 500 });
    }

    console.log('📊 [CRON] Price update posted to Moltx');

    return NextResponse.json({
      success: true,
      cron: 'moltx-prices',
      tokensReported: tokens.length,
      postId: data.data?.post?.id,
    });

  } catch (error) {
    console.error('❌ [CRON] Moltx prices cron failed:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
