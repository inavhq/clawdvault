import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Add reaction
export async function POST(req: NextRequest) {
  try {
    const { messageId, emoji, wallet } = await req.json();

    if (!messageId || !emoji || !wallet) {
      return NextResponse.json(
        { success: false, error: 'messageId, emoji, and wallet are required' },
        { status: 400 }
      );
    }

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
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('messageId');
    const emoji = searchParams.get('emoji');
    const wallet = searchParams.get('wallet');

    if (!messageId || !emoji || !wallet) {
      return NextResponse.json(
        { success: false, error: 'messageId, emoji, and wallet are required' },
        { status: 400 }
      );
    }

    // Delete reaction
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
