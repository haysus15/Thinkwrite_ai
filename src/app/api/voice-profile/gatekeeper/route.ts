import { NextResponse } from "next/server";
// VOICE DISCONNECTED — Mirror Mode ships standalone. Reconnect via API contract.
const UNAVAILABLE = {
  status: "unavailable",
  reason: "Mirror Mode is launching as a standalone product. Voice transform will reconnect via integration.",
} as const;
export async function POST() { return NextResponse.json(UNAVAILABLE, { status: 503 }); }
export async function GET() { return NextResponse.json(UNAVAILABLE, { status: 503 }); }
