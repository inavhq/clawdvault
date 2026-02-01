import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET - Fetch messages for a token
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mint = searchParams.get('mint');
  const limit = parseInt(searchParams.get('limit') || '50');
  const before = searchParams.get('before'); // For pagination

  if (!mint) {
    return NextResponse.json({ error: 'mint is required' }, { status: 400 });
  }

  try {
    const where: any = { tokenMint: mint };
    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    const messages = await db().chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Reverse so oldest first in the returned array
    return NextResponse.json({
      messages: messages.reverse().map((m) => ({
        id: m.id,
        sender: m.sender,
        sender_name: m.senderName,
        message: m.message,
        reply_to: m.replyTo,
        created_at: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST - Send a message
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mint, message, sender, sender_name, reply_to } = body;

    if (!mint || !message) {
      return NextResponse.json(
        { error: 'mint and message are required' },
        { status: 400 }
      );
    }

    // Basic validation
    if (message.length > 500) {
      return NextResponse.json(
        { error: 'Message too long (max 500 chars)' },
        { status: 400 }
      );
    }

    // Check if token exists
    const token = await db().token.findUnique({ where: { mint } });
    if (!token) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    const chatMessage = await db().chatMessage.create({
      data: {
        tokenMint: mint,
        sender: sender || 'anonymous',
        senderName: sender_name || 'Anon',
        message: message.trim(),
        replyTo: reply_to,
      },
    });

    return NextResponse.json({
      success: true,
      message: {
        id: chatMessage.id,
        sender: chatMessage.sender,
        sender_name: chatMessage.senderName,
        message: chatMessage.message,
        reply_to: chatMessage.replyTo,
        created_at: chatMessage.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
