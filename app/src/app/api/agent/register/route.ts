import { NextRequest, NextResponse } from 'next/server';
import { registerAgent } from '@/lib/db';

/**
 * POST /api/agent/register
 *
 * Register a new agent.
 *
 * Request body:
 * - wallet: string (required) — Solana wallet address
 * - name: string (optional) — Agent display name
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
    const body = await req.json();
    const { wallet, name } = body;

    if (!wallet || typeof wallet !== 'string') {
      return NextResponse.json(
        { error: 'wallet is required' },
        { status: 400 }
      );
    }

    const result = await registerAgent(wallet, name);

    return NextResponse.json({
      apiKey: result.apiKey,
      claimCode: result.claimCode,
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
