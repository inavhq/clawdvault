import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Get user profile by wallet address
 * GET /api/user/profile?wallet=xxx
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  
  if (!wallet) {
    return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 });
  }

  try {
    const profile = await db().user.findUnique({
      where: { wallet },
      select: {
        name: true,
        avatar: true,
        wallet: true,
      },
    });

    if (!profile) {
      return NextResponse.json({
        wallet,
        username: null,
        avatar: null,
      });
    }

    // Map 'name' to 'username' for frontend compatibility
    return NextResponse.json({
      wallet: profile.wallet,
      username: profile.name,
      avatar: profile.avatar,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
