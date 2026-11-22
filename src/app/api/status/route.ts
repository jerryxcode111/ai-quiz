import { NextResponse } from 'next/server';

export async function GET() {
  const hasServerKey = Boolean(
    (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0) ||
    (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0)
  );
  return NextResponse.json({
    hasServerKey,
    provider: process.env.GROQ_API_KEY ? 'groq' : 'gemini',
  });
}
