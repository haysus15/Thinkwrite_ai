export function stripNumberPrefix(text: string): string {
  return text
    .replace(/^\d+\.\s*/, "")
    .replace(/^\d+\)\s*/, "")
    .replace(/^[IVX]+\.\s*/i, "")
    .replace(/^[a-zA-Z]\.\s*/, "")
    .trim();
}
