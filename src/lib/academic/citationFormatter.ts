export type CitationStyle = "MLA" | "APA" | "Chicago" | "plain";

export interface CitationSource {
  title: string;
  author: string | null;
  year: number | null;
  url: string | null;
  sourceType: string | null;
}

export function formatCitation(
  source: CitationSource,
  style: CitationStyle
): string {
  const author = source.author ?? "Author Unknown";
  const year = source.year ? String(source.year) : "n.d.";
  const title = source.title;
  const url = source.url ? ` ${source.url}.` : "";

  switch (style) {
    case "MLA":
      return `${author}. "${title}." ${year}.${url}`;
    case "APA":
      return `${author} (${year}). ${title}.${url}`;
    case "Chicago":
      return `${author}. "${title}." ${year}.${url}`;
    default:
      return `${author}. ${title}. ${year}.${url}`;
  }
}

export function getWorksCitedHeading(style: CitationStyle): string {
  switch (style) {
    case "MLA":
      return "Works Cited";
    case "APA":
      return "References";
    case "Chicago":
      return "Bibliography";
    default:
      return "References";
  }
}

export function detectCitationStyle(
  paperCitationStyle: string | null,
  requirementsCitationFormat: string | null
): CitationStyle {
  const raw = (paperCitationStyle ?? requirementsCitationFormat ?? "").toUpperCase();

  if (raw.includes("MLA")) return "MLA";
  if (raw.includes("APA")) return "APA";
  if (raw.includes("CHICAGO")) return "Chicago";

  return "plain";
}
