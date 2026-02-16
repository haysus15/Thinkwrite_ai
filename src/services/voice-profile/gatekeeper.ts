// src/services/voice-profile/gatekeeper.ts
// Shared gatekeeper logic for studios

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StudioType = "career" | "academic" | "creative";
export type Chamber = "career" | "academic" | "creative" | "general" | "overall";

const STUDIO_TO_CHAMBER: Record<StudioType, Chamber> = {
  career: "career",
  academic: "academic",
  creative: "creative",
};

export type GatekeeperResult = {
  primaryChamber: Chamber;
  primary: any | null;
  general: any | null;
  overall: any | null;
  sufficientData: boolean;
  counts: {
    primary: number;
    general: number;
    combined: number;
  };
  thresholds: {
    combinedMin: number;
  };
  warnings: string[];
};

export function evaluateGatekeeperWarnings(params: {
  primaryChamber: Chamber;
  primaryCount: number;
  generalCount: number;
  requestedChambers?: Chamber[];
  combinedMin?: number;
}) {
  const {
    primaryChamber,
    primaryCount,
    generalCount,
    requestedChambers = [],
    combinedMin = 3,
  } = params;
  const warnings: string[] = [];
  const combinedDocumentCount = primaryCount + generalCount;

  if (combinedDocumentCount < combinedMin) {
    warnings.push(
      `Voice data is thin in ${primaryChamber} + general (${combinedDocumentCount}/${combinedMin} documents).`
    );
  }

  const normalizedRequested = requestedChambers.filter(Boolean);
  const disallowed = normalizedRequested.filter(
    (chamber) => chamber !== primaryChamber && chamber !== "general" && chamber !== "overall"
  );

  if (disallowed.length > 0) {
    warnings.push(
      `Requested non-primary chambers without consent: ${disallowed.join(", ")}.`
    );
  }

  return { warnings, disallowed, combinedDocumentCount, combinedMin };
}

export async function getGatekeeperContext(
  userId: string,
  studioType: StudioType,
  requestedChambers: Chamber[] = []
): Promise<GatekeeperResult | null> {
  const supabase = await createSupabaseServerClient();
  const primaryChamber = STUDIO_TO_CHAMBER[studioType];

  const { data: rows, error } = await supabase
    .from("voice_profiles_chambers")
    .select("*")
    .eq("user_id", userId)
    .in("chamber", [primaryChamber, "general", "overall"]);

  if (error) return null;

  const byChamber: Partial<Record<Chamber, any>> = {};
  for (const row of rows || []) {
    byChamber[row.chamber as Chamber] = row;
  }

  const primary = byChamber[primaryChamber] || null;
  const general = byChamber.general || null;
  const overall = byChamber.overall || null;

  const primaryCount = primary?.document_count || 0;
  const generalCount = general?.document_count || 0;
  const { warnings, combinedDocumentCount, combinedMin } = evaluateGatekeeperWarnings({
    primaryChamber,
    primaryCount,
    generalCount,
    requestedChambers,
  });

  return {
    primaryChamber,
    primary,
    general,
    overall,
    sufficientData: combinedDocumentCount >= combinedMin,
    counts: {
      primary: primaryCount,
      general: generalCount,
      combined: combinedDocumentCount,
    },
    thresholds: {
      combinedMin,
    },
    warnings,
  };
}
