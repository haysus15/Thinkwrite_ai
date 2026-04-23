const ALLOWED_PREFIXES = [
  "/select-studio",
  "/academic",
  "/career-studio",
  "/mirror-mode",
  "/creative-studio",
  "/dashboard",
];

const DEFAULT_REDIRECT = "/select-studio";

export function safeRedirect(destination: string | null | undefined): string {
  if (!destination || typeof destination !== "string") return DEFAULT_REDIRECT;
  if (!destination.startsWith("/")) return DEFAULT_REDIRECT;
  const allowed = ALLOWED_PREFIXES.some((prefix) =>
    destination.startsWith(prefix)
  );
  return allowed ? destination : DEFAULT_REDIRECT;
}
