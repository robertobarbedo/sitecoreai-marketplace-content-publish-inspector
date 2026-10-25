import { NextResponse } from "next/server";

export async function GET() {
  const rateLimit = process.env.RATE_LIMIT_PER_SECOND 
    ? parseInt(process.env.RATE_LIMIT_PER_SECOND, 10) 
    : 30;
  
  return NextResponse.json({ 
    rateLimit: isNaN(rateLimit) || rateLimit <= 0 ? 30 : rateLimit 
  });
}
