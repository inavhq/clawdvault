import { NextResponse } from 'next/server';

// Cache the price server-side
let cachedPrice: number = 100;
let lastFetch: number = 0;
const CACHE_DURATION = 60 * 1000; // 60 seconds

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = Date.now();
  
  // Return cached price if still valid
  if (now - lastFetch < CACHE_DURATION && cachedPrice > 0) {
    return NextResponse.json({ 
      price: cachedPrice, 
      cached: true,
      age: Math.floor((now - lastFetch) / 1000)
    });
  }

  // Fetch fresh price
  try {
    const res = await fetch('https://price.jup.ag/v6/price?ids=SOL', {
      next: { revalidate: 60 }
    });
    const data = await res.json();
    
    if (data.data?.SOL?.price) {
      cachedPrice = data.data.SOL.price;
      lastFetch = now;
    }
  } catch (err) {
    console.error('Failed to fetch SOL price:', err);
    // Keep using cached price on error
  }

  return NextResponse.json({ 
    price: cachedPrice, 
    cached: false,
    age: 0
  });
}
