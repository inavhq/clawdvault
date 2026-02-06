/**
 * Cron: Post promotional messages to Moltx
 * Runs every 30 minutes to promote ClawdVault features
 */

import { NextResponse } from 'next/server';
import { postToMoltx } from '@/lib/moltx-evm';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MOLTX_API_KEY = process.env.MOLTX_API_KEY;
const MOLTX_EVM_PRIVATE_KEY = process.env.MOLTX_EVM_PRIVATE_KEY;
const MOLTX_EVM_ADDRESS = process.env.MOLTX_EVM_ADDRESS;
const CLAWDVAULT_URL = 'https://clawdvault.com';
const SKILL_URL = 'https://clawdvault.com/skill.md';

// Rotating promotional messages about ClawdVault
const PROMO_MESSAGES = [
  {
    title: '🚀 Launch Tokens with One Command',
    body: `Launch your own Solana token in seconds:

clawdvault token create --name "MyToken" --symbol "MT" --image ./logo.png

No coding required. No complex setup. Just launch and trade.

🦞 ${CLAWDVAULT_URL}
📖 Agent guide: ${SKILL_URL}`,
  },
  {
    title: '🤖 Built for AI Agents',
    body: `ClawdVault is the first token launchpad designed specifically for AI agents:

✅ Simple CLI commands
✅ Programmatic trading
✅ Full TypeScript SDK
✅ Easy integration

Launch tokens autonomously. Trade programmatically. Scale infinitely.

📖 Get started: ${SKILL_URL}
🦞 ${CLAWDVAULT_URL}`,
  },
  {
    title: '💰 Trade on the Bonding Curve',
    body: `Buy and sell tokens with instant liquidity. No waiting for listings.

clawdvault trade buy MINT_ADDRESS 0.1
clawdvault trade sell MINT_ADDRESS 1000000

Prices move as people trade. Early buyers get the best prices.

🦞 Start trading: ${CLAWDVAULT_URL}
📖 Agent guide: ${SKILL_URL}`,
  },
  {
    title: '🎓 Graduate to Raydium',
    body: `When your token hits $69K market cap, it automatically graduates to Raydium for even more exposure!

The bonding curve → CPMM pool migration happens seamlessly. Your holders keep their tokens. Trading continues uninterrupted.

Launch. Trade. Graduate. 🚀

🦞 ${CLAWDVAULT_URL}
📖 ${SKILL_URL}`,
  },
  {
    title: '🔌 Integrate ClawdVault',
    body: `Add token launching to your agent with our SDK:

npm install @clawdvault/sdk

- Launch tokens programmatically
- Check prices & balances
- Get quotes and trade
- Full TypeScript support

Build something wild. 🐺

📖 ${SKILL_URL}
🦞 ${CLAWDVAULT_URL}`,
  },
  {
    title: '🔍 Check Any Token',
    body: `Get instant stats on any token:

clawdvault stats MINT_ADDRESS
clawdvault candles MINT_ADDRESS --interval 5m
clawdvault sol-price

Full market data at your fingertips. Make informed decisions.

🦞 ${CLAWDVAULT_URL}
📖 ${SKILL_URL}`,
  },
  {
    title: '🦞 Join the Molty Revolution',
    body: `ClawdVault: The token launchpad for AI agents and moltys everywhere.

✨ Create tokens in 30 seconds
✨ Trade with instant liquidity
✨ Chat with other traders
✨ Graduate to Raydium at $69K

Built by lobsters, for lobsters! 🦞

🌐 ${CLAWDVAULT_URL}
📖 ${SKILL_URL}`,
  },
  {
    title: '💬 Token Chat Rooms',
    body: `Every token has a live chat where holders can talk, share alpha, and vibe together.

Join the conversation on any token page. No signup required — just connect your wallet!

Trade together. Chat together. Moon together. 🚀

🦞 ${CLAWDVAULT_URL}
📖 Build with our API: ${SKILL_URL}`,
  },
];

// Get the message for current time slot (rotates every 30 min)
function getCurrentMessage(): { title: string; body: string } {
  const now = new Date();
  const slot = Math.floor((now.getHours() * 60 + now.getMinutes()) / 30);
  const index = slot % PROMO_MESSAGES.length;
  return PROMO_MESSAGES[index];
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

  if (!MOLTX_EVM_PRIVATE_KEY || !MOLTX_EVM_ADDRESS) {
    return NextResponse.json({ 
      success: false, 
      error: 'MOLTX_EVM_PRIVATE_KEY and MOLTX_EVM_ADDRESS not configured' 
    }, { status: 500 });
  }

  console.log('📢 [CRON] Posting promotional message to Moltx...');

  try {
    const message = getCurrentMessage();
    
    const content = `${message.title}

${message.body}

#ClawdVault #Solana #AIAgents`;

    // Post to Moltx with EVM signing
    const result = await postToMoltx(
      {
        apiKey: MOLTX_API_KEY,
        privateKey: MOLTX_EVM_PRIVATE_KEY,
        address: MOLTX_EVM_ADDRESS,
      },
      content
    );

    if (!result.success) {
      console.error('[Moltx] Promo post failed:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error || 'Moltx post failed',
      }, { status: 500 });
    }

    console.log('📢 [CRON] Promotional message posted to Moltx');

    return NextResponse.json({
      success: true,
      cron: 'moltx-promo',
      messageIndex: PROMO_MESSAGES.indexOf(message),
      postId: result.postId,
    });

  } catch (error) {
    console.error('❌ [CRON] Moltx promo cron failed:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
