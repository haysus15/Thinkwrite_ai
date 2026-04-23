import { expect, test } from "playwright/test";
import { SOURCE_AUTHORITY } from "@/lib/mirror-core/sourceAuthority";
import { shouldExcludeFromProfile } from "@/lib/mirror-core/sourceAuthority";
import {
  ingestConversationMessageWithDeps,
  shouldIngest,
} from "@/lib/mirror-mode/playgroundIngestion";

test.describe("mirror playground ingestion", () => {
  test("message under 25 words rejected", () => {
    expect(
      shouldIngest("I need this email to sound calm and direct when I explain the missed deadline.")
    ).toBe(false);
  });

  test("message over 25 words but structurally empty rejected", () => {
    expect(
      shouldIngest(
        "yes I totally agree with everything you just said about that and it makes complete sense"
      )
    ).toBe(false);
    expect(
      shouldIngest(
        "yeah exactly right that makes complete sense to me and I think you are correct"
      )
    ).toBe(false);
    expect(
      shouldIngest(
        "ok sounds good I think that works perfectly for what I need and I appreciate the help"
      )
    ).toBe(false);
  });

  test("substantive message over 25 words accepted", () => {
    expect(
      shouldIngest(
        "I think the issue is more about how my manager interprets urgency than the actual deadline, because every time priorities shift the team assumes I can absorb the change without renegotiating scope."
      )
    ).toBe(true);
  });

  test("edge case: exactly 25 words, substantive accepted", () => {
    expect(
      shouldIngest(
        "I need this note to explain why the client changed scope this week, because our team absorbed extra revisions without changing the deadline or budget."
      )
    ).toBe(true);
  });

  test("edge case: exactly 24 words, substantive rejected", () => {
    expect(
      shouldIngest(
        "I need this note to explain why the client changed scope today, because our team absorbed extra revisions without changing the deadline or budget."
      )
    ).toBe(false);
  });

  test("padded affirmation over threshold rejected", () => {
    expect(
      shouldIngest(
        "yes I totally agree with everything you just said about that and it makes complete sense to me now"
      )
    ).toBe(false);
  });

  test("ingestConversationMessage calls ingestion pipeline when shouldIngest returns true", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const fakeSupabase = { marker: "supabase" };

    await ingestConversationMessageWithDeps(
      "user-1",
      "I need this email to explain why the deadline slipped, because my manager keeps treating shifting priorities as if they do not change the actual workload for the team.",
      "career",
      "session-1",
      {
        getSupabaseAdmin: () => fakeSupabase as never,
        ingestStudioWriting: async (params) => {
          calls.push(params as unknown as Record<string, unknown>);
          return {
            captured: true,
            archived: true,
            needsConsent: false,
            mirrorDocumentId: "doc-1",
            wordCount: 29,
          };
        },
      }
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.supabase).toBe(fakeSupabase);
    expect(calls[0]?.sourceStudio).toBe("career");
  });

  test("ingestConversationMessage skips ingestion pipeline when shouldIngest returns false", async () => {
    let called = false;

    await ingestConversationMessageWithDeps(
      "user-1",
      "ok sounds good I think that works perfectly for what I need and I appreciate the help",
      "general",
      "session-2",
      {
        getSupabaseAdmin: () => ({}) as never,
        ingestStudioWriting: async () => {
          called = true;
          return {
            captured: true,
            archived: true,
            needsConsent: false,
            mirrorDocumentId: "doc-1",
            wordCount: 0,
          };
        },
      }
    );

    expect(called).toBe(false);
  });

  test("source authority is playground_conversation on ingested messages", async () => {
    const calls: Array<Record<string, unknown>> = [];

    await ingestConversationMessageWithDeps(
      "user-1",
      "I need the draft to sound firmer with my professor, because the feedback keeps focusing on tone even when the argument and evidence are already clear.",
      "academic",
      "session-3",
      {
        getSupabaseAdmin: () => ({}) as never,
        ingestStudioWriting: async (params) => {
          calls.push(params as unknown as Record<string, unknown>);
          return {
            captured: true,
            archived: true,
            needsConsent: false,
            mirrorDocumentId: "doc-2",
            wordCount: 27,
          };
        },
      }
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sourceAuthority).toBe(SOURCE_AUTHORITY.PLAYGROUND_CONVERSATION);
    expect(calls[0]?.writingType).toBe("academic");
  });

  test("ingestConversationMessage called with playground_conversation source sets excluded_from_profile false", async () => {
    const calls: Array<Record<string, unknown>> = [];

    await ingestConversationMessageWithDeps(
      "user-1",
      "I need this draft to explain why the project slipped, because the client added approval steps after the team had already committed to the original delivery sequence and budget.",
      "general",
      "session-4",
      {
        getSupabaseAdmin: () => ({}) as never,
        ingestStudioWriting: async (params) => {
          calls.push(params as unknown as Record<string, unknown>);
          return {
            captured: true,
            archived: true,
            needsConsent: false,
            mirrorDocumentId: "doc-3",
            wordCount: 28,
          };
        },
      }
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sourceAuthority).toBe(SOURCE_AUTHORITY.PLAYGROUND_CONVERSATION);
    expect(shouldExcludeFromProfile(SOURCE_AUTHORITY.PLAYGROUND_CONVERSATION)).toBe(false);
  });
});
