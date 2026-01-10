// Server-side Authentication Utility
// src/lib/auth/getAuthUser.ts
import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export interface AuthResult {
  userId: string | null;
  email: string | null;
  error: string | null;
}

/**
 * Get authenticated user from server-side request
 * Uses cookie-based authentication via Supabase
 */
export async function getAuthUser(): Promise<AuthResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        userId: null,
        email: null,
        error: "Authentication required",
      };
    }

    return {
      userId: user.id,
      email: user.email || null,
      error: null,
    };
  } catch (error) {
    console.error("[Auth] Error getting user:", error);
    return {
      userId: null,
      email: null,
      error: "Authentication error",
    };
  }
}

/**
 * Get authenticated user and verify they match the requested userId
 * Prevents users from accessing other users' data
 */
export async function getAuthUserVerified(requestedUserId: string | null): Promise<AuthResult & { verified: boolean }> {
  const auth = await getAuthUser();

  if (auth.error || !auth.userId) {
    return { ...auth, verified: false };
  }

  // If no requested userId, the authenticated user is the target
  if (!requestedUserId) {
    return { ...auth, verified: true };
  }

  // Verify the authenticated user matches the requested user
  const verified = auth.userId === requestedUserId;

  if (!verified) {
    console.warn(`[Auth] User ${auth.userId} attempted to access data for ${requestedUserId}`);
  }

  return { ...auth, verified };
}

/**
 * Create admin Supabase client for operations that need service role
 * Should only be used after authentication is verified
 */
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase configuration");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

/**
 * Validate that a string is a valid UUID format
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
