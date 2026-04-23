import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server.js";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const EXTENSION_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type ExtensionSessionPayload = {
  sub: string;
  email: string | null;
  source: "extension";
  iat: number;
  exp: number;
};

function getExtensionSigningSecret(): string {
  const secret =
    process.env.EXTENSION_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!secret) {
    throw new Error("Missing extension signing secret");
  }
  return secret;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value: string): string {
  return createHmac("sha256", getExtensionSigningSecret())
    .update(value)
    .digest("base64url");
}

export function createExtensionSessionToken(params: {
  userId: string;
  email?: string | null;
  now?: number;
}): { token: string; expiresAt: string; payload: ExtensionSessionPayload } {
  const now = params.now ?? Date.now();
  const payload: ExtensionSessionPayload = {
    sub: params.userId,
    email: params.email ?? null,
    source: "extension",
    iat: now,
    exp: now + EXTENSION_SESSION_TTL_MS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signValue(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.exp).toISOString(),
    payload,
  };
}

export function verifyExtensionSessionToken(
  token: string
): { valid: boolean; expired: boolean; payload: ExtensionSessionPayload | null } {
  try {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) {
      return { valid: false, expired: false, payload: null };
    }

    const expectedSignature = signValue(encodedPayload);
    const provided = new Uint8Array(Buffer.from(signature, "utf8"));
    const expected = new Uint8Array(Buffer.from(expectedSignature, "utf8"));
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      return { valid: false, expired: false, payload: null };
    }

    const payload = JSON.parse(
      base64UrlDecode(encodedPayload)
    ) as ExtensionSessionPayload;
    if (!payload || payload.source !== "extension" || !payload.sub) {
      return { valid: false, expired: false, payload: null };
    }

    const expired = Date.now() >= payload.exp;
    return { valid: !expired, expired, payload };
  } catch {
    return { valid: false, expired: false, payload: null };
  }
}

function getSupabaseBrowserAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase auth client is not configured");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || "").trim();
    const password = String(body?.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseBrowserAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user?.id) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const session = createExtensionSessionToken({
      userId: data.user.id,
      email: data.user.email ?? email,
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
    console.error("[Extension auth]", error);
    return NextResponse.json(
      { success: false, error: "Failed to create extension session" },
      { status: 500 }
    );
  }
}
