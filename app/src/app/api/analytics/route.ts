/**
 * Simple analytics endpoint to track skill.md views
 * Stores in Vercel KV or logs for analysis
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Simple in-memory counter (resets on deploy, use KV for persistence)
let skillMdViews = 0;
let lastViewed: string | null = null;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  if (action === 'track') {
    skillMdViews++;
    lastViewed = new Date().toISOString();
    
    // Log for Vercel logs analysis
    console.log(`[ANALYTICS] skill.md viewed - Total: ${skillMdViews}`);
    
    return NextResponse.json({ 
      success: true, 
      totalViews: skillMdViews,
      lastViewed,
    });
  }
  
  // Return stats
  return NextResponse.json({
    skillMdViews,
    lastViewed,
    note: 'This counter resets on each deployment. For persistent tracking, enable Vercel Analytics.',
  });
}
