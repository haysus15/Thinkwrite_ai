export const THINKWRITE_DOMAIN = "thinkwrite.ai";
declare const __DEV__: boolean;

export const THINKWRITE_API_BASE =
  typeof __DEV__ !== "undefined" && __DEV__
    ? "http://localhost:3000"
    : "https://thinkwrite.ai";

export interface AuthState {
  accessToken: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  apiBase: string;
  cookieName: string | null;
  cookieDomain: string | null;
}

function parseAuthCookie(rawValue: string): {
  accessToken: string | null;
  userId: string | null;
} {
  try {
    const stripped = rawValue.startsWith("base64-")
      ? rawValue.slice("base64-".length)
      : rawValue;

    let jsonString: string;
    try {
      jsonString = atob(stripped);
    } catch {
      try {
        jsonString = decodeURIComponent(stripped);
      } catch {
        jsonString = stripped;
      }
    }

    const parsed = JSON.parse(jsonString) as
      | { access_token?: string; user?: { id?: string } }
      | Array<{ access_token?: string; user?: { id?: string } } | string>;

    const data = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!data || typeof data === "string") {
      return { accessToken: null, userId: null };
    }

    return {
      accessToken: data.access_token || null,
      userId: data.user?.id || null,
    };
  } catch {
    return { accessToken: null, userId: null };
  }
}

export async function getAuthState(): Promise<AuthState> {
  return await new Promise((resolve) => {
    chrome.cookies.getAll({}, (cookies) => {
      const baseCookie = cookies.find(
        (cookie) =>
          /^sb-.+-auth-token$/.test(cookie.name) &&
          !cookie.name.includes("code-verifier")
      );

      if (!baseCookie) {
        resolve({
          accessToken: null,
          userId: null,
          isAuthenticated: false,
          apiBase: THINKWRITE_API_BASE,
          cookieName: null,
          cookieDomain: null,
        });
        return;
      }

      const baseName = baseCookie.name;
      const chunks = cookies
        .filter((cookie) => cookie.name.startsWith(`${baseName}.`))
        .sort((a, b) => a.name.localeCompare(b.name));

      const rawValue =
        chunks.length > 0
          ? chunks.map((cookie) => cookie.value).join("")
          : baseCookie.value;

      const result = parseAuthCookie(rawValue);
      resolve({
        accessToken: result.accessToken,
        userId: result.userId,
        isAuthenticated: Boolean(result.accessToken && result.userId),
        apiBase: THINKWRITE_API_BASE,
        cookieName: baseCookie.name,
        cookieDomain: baseCookie.domain || null,
      });
    });
  });
}
