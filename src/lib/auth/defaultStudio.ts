export type DefaultStudioValue = "academic" | "career" | "mirror" | null;

export function normalizeDefaultStudio(value: string | null | undefined): DefaultStudioValue {
  if (value === "academic" || value === "career" || value === "mirror") {
    return value;
  }
  return null;
}

export function defaultStudioToPath(value: string | null | undefined): string {
  const normalized = normalizeDefaultStudio(value);
  if (normalized === "academic") return "/academic/welcome";
  if (normalized === "career") return "/career-studio";
  if (normalized === "mirror") return "/mirror-mode";
  return "/select-studio";
}
