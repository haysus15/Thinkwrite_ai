import { ingestStudioWriting } from "@/lib/mirror-mode/studioIngestion";
import { SOURCE_AUTHORITY } from "@/lib/mirror-core/sourceAuthority";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Chamber, WritingType } from "@/lib/mirror-core/writingTypes";

const MINIMUM_PLAYGROUND_WORD_COUNT = 25;

const NON_SUBSTANTIVE_PATTERNS = [
  /^(yes|yeah)\b[\s\S]*\b(agree|correct|makes?\s+complete\s+sense)\b[\s\S]*$/i,
  /^(yeah|yes)\b[\s\S]*\bexactly\b[\s\S]*\b(complete\s+sense|correct)\b[\s\S]*$/i,
  /^(ok|okay)\b[\s\S]*\b(sounds?\s+good|works?\s+perfectly|appreciate\s+the\s+help)\b[\s\S]*$/i,
];

const CONTENT_VERBS = /\b(absorb(?:ed)?|build|change(?:d)?|clarify|draft|explain|handle|include|interpret(?:s|ed)?|manage|outline|prove|renegotiate|request|respond|revise|shift(?:s|ed)?|show|solve|support|write)\b/i;
const SUBORDINATE_MARKERS = /\b(because|about|how|why|when|where|which|that|than|while|if)\b/i;
const CONTENT_NOUNS = /\b(argument|audience|budget|class|client|content|deadline|draft|email|evidence|manager|paper|priorities|project|reader|relationship|scope|section|team|timeline|tone|urgency|world|writing)\b/i;
const SUBJECT_MARKERS = /\b(i|we|my|our|he|she|they|manager|team|client|professor|reader|project|deadline)\b/i;

type PlaygroundIngestionDeps = {
  getSupabaseAdmin: typeof getSupabaseAdmin;
  ingestStudioWriting: typeof ingestStudioWriting;
};

export type PlaygroundConversationIngestionResult = {
  captured: boolean;
  archived: boolean;
  needsConsent: boolean;
  mirrorDocumentId: string | null;
  wordCount: number;
};

function countWords(message: string): number {
  return String(message || "").trim().split(/\s+/).filter(Boolean).length;
}

function normalizeChamber(chamber: string): Chamber {
  return chamber === "career" || chamber === "academic" || chamber === "creative" || chamber === "general"
    ? chamber
    : "general";
}

function chamberToWritingType(chamber: Chamber): WritingType {
  return chamber === "career" ? "professional" : chamber;
}

function hasSubstantiveClause(message: string): boolean {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (NON_SUBSTANTIVE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  const clauses = normalized
    .split(/(?<=[.!?])\s+|\s+(?:and|but|so)\s+/i)
    .map((clause) => clause.trim())
    .filter(Boolean);

  return clauses.some((clause) => {
    const hasSubject = SUBJECT_MARKERS.test(clause);
    const hasVerb = CONTENT_VERBS.test(clause);
    const hasContent = SUBORDINATE_MARKERS.test(clause) || CONTENT_NOUNS.test(clause);
    return hasSubject && hasVerb && hasContent;
  });
}

export function shouldIngest(message: string): boolean {
  const normalized = String(message || "").trim();
  if (!normalized) return false;
  if (countWords(normalized) < MINIMUM_PLAYGROUND_WORD_COUNT) {
    return false;
  }
  return hasSubstantiveClause(normalized);
}

export async function ingestConversationMessageWithDeps(
  userId: string,
  message: string,
  chamber: string,
  sessionId: string,
  deps: PlaygroundIngestionDeps
): Promise<PlaygroundConversationIngestionResult> {
  // Caller guard: only pass human-authored user messages here.
  // Ursie responses and generated outputs must never be routed into this ingestion path.
  if (!shouldIngest(message)) {
    return {
      captured: false,
      archived: false,
      needsConsent: false,
      mirrorDocumentId: null,
      wordCount: 0,
    };
  }

  const resolvedChamber = normalizeChamber(chamber);
  const supabase = deps.getSupabaseAdmin();

  return await deps.ingestStudioWriting({
    supabase,
    userId,
    sourceStudio: resolvedChamber,
    sourceAuthority: SOURCE_AUTHORITY.PLAYGROUND_CONVERSATION,
    text: message,
    context: `mirror_playground_session:${sessionId}`,
    title: `Playground conversation ${sessionId}`,
    fileName: `playground-conversation-${sessionId}-${Date.now()}.txt`,
    writingType: chamberToWritingType(resolvedChamber),
    registerInArchive: true,
  });
}

export async function ingestConversationMessage(
  userId: string,
  message: string,
  chamber: string,
  sessionId: string
): Promise<PlaygroundConversationIngestionResult> {
  return ingestConversationMessageWithDeps(userId, message, chamber, sessionId, {
    getSupabaseAdmin,
    ingestStudioWriting,
  });
}
