import { localGet, localRemove, localSet } from "./runtime";

declare const __DEV__: boolean | undefined;

export const THINKWRITE_API_BASE =
  typeof __DEV__ !== "undefined" && __DEV__
    ? "http://localhost:3000"
    : "https://mirrormode.ai"; // update when domain is live

export const EXTENSION_SESSION_STORAGE_KEY = "mirrormode_ext_session";

export type StoredExtensionSession = {
  token: string;
  userId: string;
  email: string | null;
  source: "extension";
  expiresAt: string;
};

export interface AuthState {
  accessToken: string | null;
  userId: string | null;
  email: string | null;
  isAuthenticated: boolean;
  isExpired: boolean;
  needsReconnect: boolean;
  expiresAt: string | null;
  apiBase: string;
}

type ExtensionAuthResponse = {
  success: boolean;
  error?: string;
  session?: StoredExtensionSession;
};

function isStoredSession(value: unknown): value is StoredExtensionSession {
  return Boolean(value) && typeof value === "object" && typeof (value as StoredExtensionSession).token === "string";
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true;
  const timestamp = Date.parse(expiresAt);
  if (Number.isNaN(timestamp)) return true;
  return Date.now() >= timestamp;
}

async function getStoredSession(): Promise<Record<string, unknown>> {
  // Try direct chrome.storage.local first (more reliable in service worker context)
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise<Record<string, unknown>>((resolve) => {
      chrome.storage.local.get(EXTENSION_SESSION_STORAGE_KEY, (result) => {
        resolve(result || {});
      });
    });
  }
  // Fallback to localGet
  return localGet(EXTENSION_SESSION_STORAGE_KEY);
}

export async function readStoredSession(): Promise<StoredExtensionSession | null> {
  const stored = await getStoredSession();
  const session = stored[EXTENSION_SESSION_STORAGE_KEY];
  return isStoredSession(session) ? session : null;
}

export async function storeSession(session: StoredExtensionSession): Promise<void> {
  await localSet({ [EXTENSION_SESSION_STORAGE_KEY]: session });
}

export async function clearSession(): Promise<void> {
  await localRemove(EXTENSION_SESSION_STORAGE_KEY);
}

export async function getAuthState(): Promise<AuthState> {
  const session = await readStoredSession();
  const expired = isExpired(session?.expiresAt);

  return {
    accessToken: session?.token ?? null,
    userId: session?.userId ?? null,
    email: session?.email ?? null,
    isAuthenticated: Boolean(session?.token && session?.userId && !expired),
    isExpired: Boolean(session?.token && expired),
    needsReconnect: Boolean(session?.token && expired),
    expiresAt: session?.expiresAt ?? null,
    apiBase: THINKWRITE_API_BASE,
  };
}

async function postExtensionAuth<T>(
  path: string,
  init: RequestInit
): Promise<T> {
  const response = await fetch(`${THINKWRITE_API_BASE}${path}`, init);
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data?.error || "Extension authentication request failed");
  }
  return data;
}

export async function loginWithCredentials(
  email: string,
  password: string
): Promise<AuthState> {
  const data = await postExtensionAuth<ExtensionAuthResponse>("/api/extension/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!data.session) {
    throw new Error("Extension session was not returned");
  }

  await storeSession(data.session);
  return getAuthState();
}

export async function refreshSession(): Promise<AuthState | null> {
  const session = await readStoredSession();
  if (!session?.token) {
    return null;
  }

  try {
    const data = await postExtensionAuth<ExtensionAuthResponse>(
      "/api/extension/auth/refresh",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!data.session) {
      await clearSession();
      return null;
    }

    await storeSession(data.session);
    return getAuthState();
  } catch {
    await clearSession();
    return null;
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const auth = await getAuthState();
  if (auth.isAuthenticated && auth.accessToken) {
    return auth.accessToken;
  }

  if (!auth.isExpired) {
    return null;
  }

  const refreshed = await refreshSession();
  return refreshed?.isAuthenticated ? refreshed.accessToken : null;
}
