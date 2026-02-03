// src/lib/auth/redirects.ts
export function getAuthRequiredUrl(redirectTo?: string) {
  const baseUrl = "/?auth=required";

  if (!redirectTo) {
    return baseUrl;
  }

  return `${baseUrl}&redirect=${encodeURIComponent(redirectTo)}`;
}
