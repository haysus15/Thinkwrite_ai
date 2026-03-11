import { expect, test } from "playwright/test";
import {
  getIngestionWeight,
  getRetentionLabel,
  getSourceLabel,
  MINIMUM_WORD_COUNT,
  shouldIngestForProfile,
} from "@/lib/mirror-mode/ingestionPolicy";
import {
  SOURCE_AUTHORITY,
  type SourceAuthority,
} from "@/lib/mirror-mode/sourceAuthority";

const ALL_SOURCES = Object.values(SOURCE_AUTHORITY) as SourceAuthority[];

test.describe("ingestionPolicy contracts", () => {
  test("eligible sources with sufficient word count are eligible", () => {
    expect(shouldIngestForProfile(100, SOURCE_AUTHORITY.USER_UPLOADED).eligible).toBe(true);
    expect(shouldIngestForProfile(100, SOURCE_AUTHORITY.USER_TYPED).eligible).toBe(true);
    expect(shouldIngestForProfile(100, SOURCE_AUTHORITY.USER_QUICKSTART).eligible).toBe(true);
    expect(shouldIngestForProfile(100, SOURCE_AUTHORITY.EXTENSION_CAPTURED).eligible).toBe(true);
  });

  test("excluded sources are never eligible regardless of word count", () => {
    expect(shouldIngestForProfile(1000, SOURCE_AUTHORITY.AI_GENERATED_ACCEPTED).eligible).toBe(false);
    expect(shouldIngestForProfile(1000, SOURCE_AUTHORITY.AI_GENERATED_REJECTED).eligible).toBe(false);
    expect(shouldIngestForProfile(1000, SOURCE_AUTHORITY.UNKNOWN).eligible).toBe(false);
  });

  test("minimum threshold enforcement for standard sources", () => {
    expect(shouldIngestForProfile(MINIMUM_WORD_COUNT - 1, SOURCE_AUTHORITY.USER_UPLOADED).eligible).toBe(false);
    expect(shouldIngestForProfile(MINIMUM_WORD_COUNT, SOURCE_AUTHORITY.USER_UPLOADED).eligible).toBe(true);
    expect(shouldIngestForProfile(MINIMUM_WORD_COUNT + 1, SOURCE_AUTHORITY.USER_UPLOADED).eligible).toBe(true);
  });

  test("decision always includes a reason string", () => {
    const eligible = shouldIngestForProfile(200, SOURCE_AUTHORITY.USER_TYPED);
    const ineligible = shouldIngestForProfile(1, SOURCE_AUTHORITY.UNKNOWN);
    expect(typeof eligible.reason).toBe("string");
    expect(eligible.reason.length).toBeGreaterThan(0);
    expect(typeof ineligible.reason).toBe("string");
    expect(ineligible.reason.length).toBeGreaterThan(0);
  });

  test("retention labels are deterministic", () => {
    expect(getRetentionLabel(SOURCE_AUTHORITY.EXTENSION_CAPTURED, true)).toContain("Pattern data");
    expect(getRetentionLabel(SOURCE_AUTHORITY.USER_TYPED, true)).toContain("Used for voice learning");
    expect(getRetentionLabel(SOURCE_AUTHORITY.USER_TYPED, false)).toContain("Stored");

    for (const source of ALL_SOURCES) {
      expect(getRetentionLabel(source, true).trim().length).toBeGreaterThan(0);
    }
  });

  test("source labels are deterministic", () => {
    expect(getSourceLabel(SOURCE_AUTHORITY.EXTENSION_CAPTURED, "example.com")).toContain("example.com");
    expect(getSourceLabel(SOURCE_AUTHORITY.EXTENSION_CAPTURED)).toBe("Browser extension");
    expect(getSourceLabel(SOURCE_AUTHORITY.UNKNOWN)).toBe("Unknown source");

    for (const source of ALL_SOURCES) {
      expect(getSourceLabel(source).trim().length).toBeGreaterThan(0);
    }
  });

  test("weights are correct for included and excluded sources", () => {
    expect(getIngestionWeight(SOURCE_AUTHORITY.AI_GENERATED_ACCEPTED)).toBe(0);
    expect(getIngestionWeight(SOURCE_AUTHORITY.AI_GENERATED_REJECTED)).toBe(0);
    expect(getIngestionWeight(SOURCE_AUTHORITY.UNKNOWN)).toBe(0);
    expect(getIngestionWeight(SOURCE_AUTHORITY.USER_UPLOADED)).toBe(1);
    expect(getIngestionWeight(SOURCE_AUTHORITY.USER_TYPED)).toBe(1);
    expect(getIngestionWeight(SOURCE_AUTHORITY.EXTENSION_CAPTURED)).toBeLessThan(1);
    expect(getIngestionWeight(SOURCE_AUTHORITY.USER_QUICKSTART)).toBeLessThan(
      getIngestionWeight(SOURCE_AUTHORITY.EXTENSION_CAPTURED)
    );
  });
});
