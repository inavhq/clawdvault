import { NextRequest, NextResponse } from 'next/server';
import { claimAgentVerification } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/agent/claim
 *
 * Verify agent via Twitter tweet containing claim code.
 *
 * Request body:
 * - apiKey: string (required) — API key from /api/agent/register
 * - tweetUrl: string (required) — URL to top-level tweet containing claim code
 *
 * Response:
 * - success: boolean
 * - twitterHandle: string | null — Extracted Twitter handle
 * - verifiedAt: string — Verification timestamp
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 per hour per IP
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!rateLimit(ip, 'agent-claim', 10, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { apiKey, tweetUrl } = body;

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'apiKey is required' },
        { status: 400 }
      );
    }

    if (!tweetUrl || typeof tweetUrl !== 'string') {
      return NextResponse.json(
        { error: 'tweetUrl is required' },
        { status: 400 }
      );
    }

    // Validate tweet URL format
    if (!tweetUrl.match(/^https?:\/\/(twitter\.com|x\.com)\/[^/]+\/status\/\d+/)) {
      return NextResponse.json(
        { error: 'Invalid tweet URL format (must be https://twitter.com/handle/status/ID or https://x.com/handle/status/ID)' },
        { status: 400 }
      );
    }

    const agent = await claimAgentVerification(apiKey, tweetUrl);

    return NextResponse.json({
      success: true,
      twitterHandle: agent.twitterHandle,
      verifiedAt: agent.verifiedAt?.toISOString(),
    });
  } catch (error) {
    console.error('Agent claim error:', error);

    if (error instanceof Error) {
      if (error.message === 'Agent not found') {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 404 }
        );
      }
      if (error.message === 'Agent already verified') {
        return NextResponse.json(
          { error: 'Agent already verified' },
          { status: 409 }
        );
      }
      if (error.message === 'No claim code found (agent may have been verified already)') {
        return NextResponse.json(
          { error: 'No claim code found (agent may have been verified already)' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to claim verification' },
      { status: 500 }
    );
  }
}
