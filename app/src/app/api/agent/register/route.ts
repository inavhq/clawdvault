import { NextRequest, NextResponse } from 'next/server';
import { registerAgent } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/agent/register
 *
 * Register a new agent.
 *
 * Request body:
 * - wallet: string (required) — Solana wallet address
 * - name: string (optional) — Agent display name
 * - avatar: string (optional) — Avatar image URL
 *
 * Response:
 * - apiKey: string — API key for authenticated requests
 * - claimCode: string — Code to include in Twitter verification tweet
 * - userId: string — User ID
 * - agentId: string — Agent ID
 *
 * Twitter verification flow:
 * 1. Agent calls this endpoint → receives apiKey + claimCode
 * 2. Agent tells owner: "Post this claim code on Twitter: {claimCode}"
 * 3. Owner posts top-level tweet containing the claim code
 * 4. Agent submits tweet URL to /api/agent/claim
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 per hour per IP
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!await rateLimit(ip, 'agent-register', 10, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { wallet, name, avatar } = body;

    if (!wallet || typeof wallet !== 'string') {
      return NextResponse.json(
        { error: 'wallet is required' },
        { status: 400 }
      );
    }

    const result = await registerAgent(wallet, name, avatar);

    const isDev = process.env.NODE_ENV === 'development';
    const tweetTemplate = isDev
      ? `🤖 [DEV] Testing agent verification on @ClawdVault\n\nClaim code: ${result.claimCode}\n\n⚠️ This is a dev/test registration`
      : `🤖 I'm verifying my agent on @ClawdVault!\n\nClaim code: ${result.claimCode}\n\nBuild AI agents that trade on Solana → clawdvault.com`;

    return NextResponse.json({
      apiKey: result.apiKey,
      claimCode: result.claimCode,
      tweetTemplate,
      userId: result.user.id,
      agentId: result.agent.id,
    });
  } catch (error) {
    console.error('Agent registration error:', error);

    if (error instanceof Error && error.message === 'Agent already registered for this wallet') {
      return NextResponse.json(
        { error: 'Agent already registered for this wallet' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to register agent' },
      { status: 500 }
    );
  }
}
