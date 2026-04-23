import { NextRequest, NextResponse } from "next/server.js";
import {
  createExtensionSessionToken,
  verifyExtensionSessionToken,
} from "@/app/api/extension/auth/route";

export const runtime = "nodejs";

function readBearerToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

export async function POST(request: NextRequest) {
  try {
    const bearerToken = readBearerToken(request);
    const body = await request.json().catch(() => ({}));
    const token =
      bearerToken || (typeof body?.token === "string" ? body.token.trim() : "");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Extension session token is required" },
        { status: 401 }
      );
    }

    const verification = verifyExtensionSessionToken(token);
    if (!verification.valid || verification.expired || !verification.payload?.sub) {
      return NextResponse.json(
        { success: false, error: "Extension session is invalid or expired" },
        { status: 401 }
      );
    }

    const session = createExtensionSessionToken({
      userId: verification.payload.sub,
      email: verification.payload.email,
    });

    return NextResponse.json({
      success: true,
      session: {
        token: session.token,
        userId: session.payload.sub,
        email: session.payload.email,
        source: session.payload.source,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error("[Extension auth refresh]", error);
    return NextResponse.json(
      { success: false, error: "Failed to refresh extension session" },
      { status: 500 }
    );
  }
}
