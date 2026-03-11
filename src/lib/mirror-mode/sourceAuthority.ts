export const SOURCE_AUTHORITY = {
  USER_TYPED: "user_typed",
  USER_UPLOADED: "user_uploaded",
  USER_QUICKSTART: "user_quickstart",
  AI_GENERATED_ACCEPTED: "ai_generated_accepted",
  AI_GENERATED_REJECTED: "ai_generated_rejected",
  EXTENSION_CAPTURED: "extension_captured",
  UNKNOWN: "unknown",
} as const;

export type SourceAuthority =
  (typeof SOURCE_AUTHORITY)[keyof typeof SOURCE_AUTHORITY];

export const PROFILE_ELIGIBLE_SOURCES: SourceAuthority[] = [
  SOURCE_AUTHORITY.USER_TYPED,
  SOURCE_AUTHORITY.USER_UPLOADED,
  SOURCE_AUTHORITY.USER_QUICKSTART,
  SOURCE_AUTHORITY.EXTENSION_CAPTURED,
];

export const PROFILE_EXCLUDED_SOURCES: SourceAuthority[] = [
  SOURCE_AUTHORITY.AI_GENERATED_ACCEPTED,
  SOURCE_AUTHORITY.AI_GENERATED_REJECTED,
  SOURCE_AUTHORITY.UNKNOWN,
];

export function isProfileEligible(source: SourceAuthority): boolean {
  return PROFILE_ELIGIBLE_SOURCES.includes(source);
}

export function shouldExcludeFromProfile(source: SourceAuthority): boolean {
  return PROFILE_EXCLUDED_SOURCES.includes(source);
}
