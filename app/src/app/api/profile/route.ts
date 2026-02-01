import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { extractAuth, verifyWalletAuth } from '@/lib/auth';

// GET /api/profile?wallet=xxx - Get user profile
export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Missing wallet parameter' },
        { status: 400 }
      );
    }

    const profile = await db().userProfile.findUnique({
      where: { wallet },
    });

    return NextResponse.json({
      success: true,
      profile: profile || null,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

// POST /api/profile - Create or update profile
export async function POST(request: NextRequest) {
  try {
    // Extract auth headers
    const auth = extractAuth(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Missing authentication headers (X-Wallet, X-Signature)' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { username, avatar } = body;

    // Verify signature - signed data includes the profile update
    const signedData = { username: username || null, avatar: avatar || null };
    if (!verifyWalletAuth(auth.wallet, auth.signature, 'profile', signedData)) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const wallet = auth.wallet;

    // Validate username
    if (username) {
      if (username.length < 2 || username.length > 20) {
        return NextResponse.json(
          { success: false, error: 'Username must be 2-20 characters' },
          { status: 400 }
        );
      }
      // Only allow alphanumeric, underscore, dash
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return NextResponse.json(
          { success: false, error: 'Username can only contain letters, numbers, _ and -' },
          { status: 400 }
        );
      }
    }

    // Upsert profile
    const profile = await db().userProfile.upsert({
      where: { wallet },
      create: {
        wallet,
        username: username || null,
        avatar: avatar || null,
      },
      update: {
        username: username || null,
        avatar: avatar || null,
      },
    });

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
