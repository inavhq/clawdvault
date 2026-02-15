import { NextRequest, NextResponse } from 'next/server';
import { getUsersLeaderboard } from '@/lib/db';

/**
 * GET /api/users
 *
 * Get users leaderboard.
 *
 * Query params:
 * - sortBy: 'volume' | 'tokens' | 'fees' (default: 'volume')
 * - limit: number (default: 100, max: 500)
 *
 * Response:
 * - users: Array of users
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

    const { users, total } = await getUsersLeaderboard({ sortBy, limit, page });

    // Transform to API response format
    const result = users.map((user) => ({
      id: user.id,
      wallet: user.wallet,
      name: user.name,
      avatar: user.avatar,
      tokens_created: user.tokensCreated,
      total_volume: Number(user.totalVolume),
      total_fees: Number(user.totalFees),
      created_at: user.createdAt.toISOString(),
    }));

    return NextResponse.json({ users: result, total, page, per_page: limit });
  } catch (error) {
    console.error('Users leaderboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users leaderboard' },
      { status: 500 }
    );
  }
}
