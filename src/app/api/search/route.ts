// src/app/api/search/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    // Google Custom Search API を叩く
    const apiKey = process.env.GOOGLE_API_KEY;
    const cx = process.env.GOOGLE_CSE_ID;

    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
      query
    )}&key=${apiKey}&cx=${cx}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error('Google API Error:', res.status);
      return NextResponse.json({ items: [] }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/search] Error:', err);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}
