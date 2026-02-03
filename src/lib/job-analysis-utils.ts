// Job Analysis Utility Functions
// Shared helpers and formatting functions for ThinkWrite Job Analysis

import type { SavedJobAnalysis, PhraseTranslation } from "../types/job-analysis";

/**
 * ✅ Safe accessor for fields that may not exist on the current SavedJobAnalysis type yet.
 * This avoids TypeScript build errors while you’re iterating on schema/engine output.
 */
function getCompanyIntelligence(
  analysis: SavedJobAnalysis
): { companyStage?: string; [key: string]: any } | null {
  const anyAnalysis = analysis as unknown as { company_intelligence?: any };
  const ci = anyAnalysis.company_intelligence;
  return ci && typeof ci === "object" ? ci : null;
}

// Format relative dates for job analyses
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 60) return "Just now";
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return date.toLocaleDateString();
}

// Get red flag count from analysis
export function getRedFlagCount(analysis: SavedJobAnalysis): number {
  // Your saved shape uses hidden_insights.phraseTranslations (per your UI formatter)
  const translations = analysis.hidden_insights?.phraseTranslations as PhraseTranslation[] | undefined;
  return Array.isArray(translations) ? translations.length : 0;
}

// Get concern level based on red flag count
export function getConcernLevel(redFlagCount: number): "low" | "medium" | "high" {
  if (redFlagCount <= 1) return "low";
  if (redFlagCount <= 3) return "medium";
  return "high";
}

// Get concern level color
export function getConcernLevelColor(level: "low" | "medium" | "high"): string {
  switch (level) {
    case "low":
      return "text-emerald-400";
    case "medium":
      return "text-yellow-400";
    case "high":
      return "text-orange-400";
  }
}

// Format company stage for display
export function formatCompanyStage(stage: string): string {
  const stageMap: { [key: string]: string } = {
    early_stage_startup: "Early Stage Startup",
    growth_stage_company: "Growth Stage",
    established_company: "Established",
    enterprise: "Enterprise",
    unknown: "Unknown Stage",
  };

  return stageMap[String(stage).toLowerCase()] || stage;
}

// Extract key insights summary
export function getKeyInsightsSummary(analysis: SavedJobAnalysis): string[] {
  const insights: string[] = [];

  // Red flags
  const redFlags = getRedFlagCount(analysis);
  if (redFlags > 0) {
    insights.push(`${redFlags} red flag phrase${redFlags !== 1 ? "s" : ""}`);
  }

  // Application email
  if (analysis.application_email) {
    insights.push("Direct email application");
  }

  // Company stage (✅ safe)
  const ci = getCompanyIntelligence(analysis);
  if (ci?.companyStage) {
    insights.push(formatCompanyStage(ci.companyStage));
  }

  // Industry
  if (analysis.industry_intelligence?.sector) {
    insights.push(String(analysis.industry_intelligence.sector));
  }

  return insights.slice(0, 3); // Limit to 3 key insights
}

// Validate URL format
export function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return string.startsWith("http://") || string.startsWith("https://");
  } catch {
    return false;
  }
}

// Extract domain from URL
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return "";
  }
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

// Format analysis status for display
export function formatAnalysisStatus(
  analysis: SavedJobAnalysis
): {
  text: string;
  color: string;
  icon: string;
} {
  if (analysis.has_applied) {
    return { text: "Applied", color: "text-emerald-400", icon: "✅" };
  }

  if (analysis.application_email) {
    return { text: "Ready to Apply", color: "text-blue-400", icon: "📧" };
  }

  const redFlags = getRedFlagCount(analysis);
  const concernLevel = getConcernLevel(redFlags);

  switch (concernLevel) {
    case "low":
      return { text: "Good Opportunity", color: "text-emerald-400", icon: "✨" };
    case "medium":
      return { text: "Review Carefully", color: "text-yellow-400", icon: "⚠️" };
    case "high":
      return { text: "Proceed Cautiously", color: "text-orange-400", icon: "🚨" };
  }
}

// Generate quick preview text
export function generateQuickPreview(analysis: SavedJobAnalysis): string {
  const redFlags = getRedFlagCount(analysis);

  if (redFlags === 0) return "Clean posting with no major red flags detected.";

  if (redFlags === 1) {
    const phrase = (analysis.hidden_insights?.phraseTranslations as PhraseTranslation[] | undefined)?.[0];
    return phrase ? `Watch for: "${phrase.original}"` : "1 concern detected.";
  }

  return `${redFlags} concerns detected - review before applying.`;
}

// Sort analyses by different criteria
export function sortAnalyses(
  analyses: SavedJobAnalysis[],
  sortBy: "date" | "company" | "concern_level"
): SavedJobAnalysis[] {
  return [...analyses].sort((a, b) => {
    switch (sortBy) {
      case "date": {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      }
      case "company":
        return String(a.company_name || "").localeCompare(String(b.company_name || ""));
      case "concern_level": {
        const aFlags = getRedFlagCount(a);
        const bFlags = getRedFlagCount(b);
        return bFlags - aFlags; // High concern first
      }
      default:
        return 0;
    }
  });
}

// Filter analyses by various criteria
export function filterAnalyses(
  analyses: SavedJobAnalysis[],
  filters: {
    hasEmail?: boolean;
    applied?: boolean;
    concernLevel?: "low" | "medium" | "high";
    searchTerm?: string;
  }
): SavedJobAnalysis[] {
  return analyses.filter((analysis) => {
    // Email filter
    if (filters.hasEmail !== undefined) {
      const hasEmail = !!analysis.application_email;
      if (hasEmail !== filters.hasEmail) return false;
    }

    // Applied filter
    if (filters.applied !== undefined) {
      if (!!analysis.has_applied !== filters.applied) return false;
    }

    // Concern level filter
    if (filters.concernLevel) {
      const redFlags = getRedFlagCount(analysis);
      const level = getConcernLevel(redFlags);
      if (level !== filters.concernLevel) return false;
    }

    // Search term filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      const searchableText = [
        analysis.job_title || "",
        analysis.company_name || "",
        analysis.location || "",
        (analysis as any).job_description || "", // tolerate missing in type
      ]
        .join(" ")
        .toLowerCase();

      if (!searchableText.includes(searchLower)) return false;
    }

    return true;
  });
}

// Calculate analysis statistics
export function calculateAnalyticsStats(analyses: SavedJobAnalysis[]) {
  const total = analyses.length;
  const applied = analyses.filter((a) => a.has_applied).length;
  const withEmail = analyses.filter((a) => a.application_email).length;
  const lowConcern = analyses.filter((a) => getConcernLevel(getRedFlagCount(a)) === "low").length;
  const mediumConcern = analyses.filter((a) => getConcernLevel(getRedFlagCount(a)) === "medium").length;
  const highConcern = analyses.filter((a) => getConcernLevel(getRedFlagCount(a)) === "high").length;

  // Most common red flag phrases
  const allPhrases = analyses.flatMap((a) => {
    const pts = a.hidden_insights?.phraseTranslations as PhraseTranslation[] | undefined;
    return Array.isArray(pts) ? pts.map((t) => t.original) : [];
  });

  const phraseFrequency = allPhrases.reduce((acc, phrase) => {
    acc[phrase] = (acc[phrase] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topRedFlags = Object.entries(phraseFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([phrase, count]) => ({ phrase, count }));

  return {
    total,
    applied,
    withEmail,
    appliedRate: total > 0 ? Math.round((applied / total) * 100) : 0,
    emailAvailableRate: total > 0 ? Math.round((withEmail / total) * 100) : 0,
    concernLevels: {
      low: lowConcern,
      medium: mediumConcern,
      high: highConcern,
    },
    topRedFlags,
  };
}
