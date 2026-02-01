import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { extractAuth, verifyWalletAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Add reaction
export async function POST(req: NextRequest) {
  try {
    // Extract auth headers
    const auth = extractAuth(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Missing authentication headers (X-Wallet, X-Signature)' },
        { status: 401 }
      );
    }

    const { messageId, emoji } = await req.json();

    if (!messageId || !emoji) {
      return NextResponse.json(
        { success: false, error: 'messageId and emoji are required' },
        { status: 400 }
      );
    }

    // Verify signature
    const signedData = { messageId, emoji };
    if (!verifyWalletAuth(auth.wallet, auth.signature, 'react', signedData)) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const wallet = auth.wallet;

    // Check message exists
    const message = await db().chatMessage.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    // Add reaction (upsert to handle duplicates gracefully)
    const reaction = await db().chatReaction.upsert({
      where: {
        messageId_emoji_wallet: {
          messageId,
          emoji,
          wallet
        }
      },
      create: {
        messageId,
        emoji,
        wallet
      },
      update: {} // No update needed, just ensure it exists
    });

    return NextResponse.json({ success: true, reaction });
  } catch (error) {
    console.error('Error adding reaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add reaction' },
      { status: 500 }
    );
  }
}

// Remove reaction
export async function DELETE(req: NextRequest) {
  try {
    // Extract auth headers
    const auth = extractAuth(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Missing authentication headers (X-Wallet, X-Signature)' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('messageId');
    const emoji = searchParams.get('emoji');

    if (!messageId || !emoji) {
      return NextResponse.json(
        { success: false, error: 'messageId and emoji are required' },
        { status: 400 }
      );
    }

    // Verify signature
    const signedData = { messageId, emoji };
    if (!verifyWalletAuth(auth.wallet, auth.signature, 'unreact', signedData)) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const wallet = auth.wallet;

    // Delete reaction - only the authenticated user's reaction
    await db().chatReaction.deleteMany({
      where: {
        messageId,
        emoji,
        wallet
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing reaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove reaction' },
      { status: 500 }
    );
  }
}
