import type { SupabaseClient } from "@supabase/supabase-js";

export type VoiceReadinessState = {
  hasAnyData: boolean;
  chambersWithData: string[];
  chambersEmpty: string[];
  overallConfidence: number;
  lowestConfidenceChamber: string | null;
};

type VoiceChamberStateRow = {
  chamber: string | null;
  document_count: number | null;
  confidence_level: number | null;
};

const CLASSIFIABLE_CHAMBERS = ["career", "academic", "creative", "general"] as const;

function isClassifiableChamber(value: string | null | undefined): value is (typeof CLASSIFIABLE_CHAMBERS)[number] {
  return value === "career" || value === "academic" || value === "creative" || value === "general";
}

export async function getVoiceReadinessState(
  userId: string,
  supabase: SupabaseClient
): Promise<VoiceReadinessState> {
  try {
    const { data, error } = await supabase
      .from("voice_chambers")
      .select("chamber, document_count, confidence_level")
      .eq("user_id", userId);

    if (error) {
      console.error("[Mirror Playground] voice readiness lookup failed:", error.message);
      return {
        hasAnyData: false,
        chambersWithData: [],
        chambersEmpty: [...CLASSIFIABLE_CHAMBERS],
        overallConfidence: 0,
        lowestConfidenceChamber: null,
      };
    }

    const rows = (data || []) as VoiceChamberStateRow[];
    const overallRow = rows.find((row) => row.chamber === "overall") || null;
    const classifiableRows = rows.filter((row) => isClassifiableChamber(row.chamber));

    const chambersWithData = CLASSIFIABLE_CHAMBERS.filter((chamber) => {
      const row = classifiableRows.find((candidate) => candidate.chamber === chamber);
      return (row?.document_count || 0) > 0;
    });

    const chambersEmpty = CLASSIFIABLE_CHAMBERS.filter((chamber) => !chambersWithData.includes(chamber));

    const lowestConfidenceChamber =
      classifiableRows
        .filter((row) => isClassifiableChamber(row.chamber) && (row.document_count || 0) > 0)
        .sort((left, right) => (left.confidence_level || 0) - (right.confidence_level || 0))[0]
        ?.chamber || null;

    return {
      hasAnyData: chambersWithData.length > 0,
      chambersWithData,
      chambersEmpty,
      overallConfidence: overallRow?.confidence_level || 0,
      lowestConfidenceChamber,
    };
  } catch (error) {
    console.error("[Mirror Playground] voice readiness lookup crashed:", error);
    return {
      hasAnyData: false,
      chambersWithData: [],
      chambersEmpty: [...CLASSIFIABLE_CHAMBERS],
      overallConfidence: 0,
      lowestConfidenceChamber: null,
    };
  }
}
