import { NextRequest, NextResponse } from 'next/server';
import { claimAgentVerification } from '@/lib/db';

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
 *
 * MVP implementation:
 * - Does NOT actually fetch/verify tweet contents (pluggable stub)
 * - Extracts Twitter handle from URL
 * - Marks agent as verified and clears claim code
 *
 * Production TODO:
 * - Fetch tweet via Twitter API or scraping
 * - Verify tweet is top-level (not a reply)
 * - Verify tweet contains exact claim code
 * - Verify tweet author matches extracted handle
 */
export async function POST(req: NextRequest) {
  try {
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
    if (!tweetUrl.match(/^https?:\/\/(twitter\.com|x\.com)\/[^\/]+\/status\/\d+/)) {
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
