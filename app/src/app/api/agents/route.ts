import { NextRequest, NextResponse } from 'next/server';
import { getAgentsLeaderboard } from '@/lib/db';

/**
 * GET /api/agents
 *
 * Get agents leaderboard.
 *
 * Query params:
 * - sortBy: 'volume' | 'tokens' | 'fees' (default: 'volume')
 * - limit: number (default: 100, max: 500)
 *
 * Response:
 * - agents: Array of agents with user data
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sortBy = (searchParams.get('sortBy') as 'volume' | 'tokens' | 'fees') || 'volume';
    const limit = Math.min(parseInt(searchParams.get('limit') || '25') || 25, 500);
    const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1);

    if (!['volume', 'tokens', 'fees'].includes(sortBy)) {
      return NextResponse.json(
        { error: 'Invalid sortBy (must be volume, tokens, or fees)' },
        { status: 400 }
      );
    }

    const { agents, total } = await getAgentsLeaderboard({ sortBy, limit, page });

    // Transform to API response format
    const result = agents.map((agent) => ({
      id: agent.id,
      wallet: agent.user.wallet,
      name: agent.user.name,
      avatar: agent.user.avatar,
      twitter_handle: agent.twitterHandle,
      twitter_verified: agent.twitterVerified,
      tokens_created: agent.user.tokensCreated,
      total_volume: Number(agent.user.totalVolume),
      total_fees: Number(agent.user.totalFees),
      verified_at: agent.verifiedAt?.toISOString(),
      created_at: agent.createdAt.toISOString(),
    }));

    return NextResponse.json({ agents: result, total, page, per_page: limit });
  } catch (error) {
    console.error('Agents leaderboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents leaderboard' },
      { status: 500 }
    );
  }
}
