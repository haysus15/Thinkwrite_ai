# MIRROR MODE — DEFINITIVE SPECIFICATION
## Ursie's House: The Voice Archive and Gatekeeper

**Created:** February 9, 2026
**Purpose:** This is the SINGLE source of truth for Mirror Mode. It replaces and consolidates all previous Mirror Mode documents. If anything in a previous Mirror Mode doc conflicts with this document, THIS document wins.
**Visual Theme:** Constellation / Tengri sky (consistent with all ThinkWrite studios)
**Philosophical Foundation:** Seshat's record-keeping ideology (NOT her visual theme), Ursie's lived experience, PKD as the governing metaphor

---

## TABLE OF CONTENTS

1. What Mirror Mode Is
2. What Mirror Mode Is NOT
2A. Data Preservation and Privacy Rules
3. The Ursie Foundation
4. The PKD Principle — The Governing Metaphor
5. The Gatekeeper Architecture
6. The Four Chambers
7. The Profile Page — Not a Settings Page
8. Ursie's Visibility Rules (includes Consent Moments)
9. Voice Data Classification
10. Voice Evolution Over Time
11. Cross-Chamber Intelligence (includes Insight Layer vs Data Layer)
12. The Seven Design Principles
13. Document Lineage — Studio Uploads Flow to Mirror Mode
14. Integration with Studios
15. Database Architecture
16. API Architecture
17. Implementation Priorities
18. What Gets Trimmed
19. Gap Review Resolution Log

---

## 1. WHAT MIRROR MODE IS

Mirror Mode is the foundational voice archive and gatekeeper of ThinkWrite AI.

It is a PROFILE — a living, organized collection of the user's writing identity, classified by context, measured across time, and curated by Ursie. It stores historical text. It analyzes voice patterns. It classifies data by studio context. It controls what voice data flows where. It shows the user who they are as a writer — not who they think they are, but who they ACTUALLY are on the page.

Mirror Mode is Ursie's house. When the user enters, Ursie is present. She shows them their archive. She points out patterns. She tracks their evolution. She is the record-keeper, the archivist, the gatekeeper, and the mother who learned her son's voice before he could speak.

Mirror Mode is the product. Everything else is context. If Mirror Mode doesn't work, the studios don't matter. If the voice learning isn't authentic, the whole platform is just another generic AI tool.

Core function: Learn the user's authentic writing voice through document analysis and studio interactions, classify that voice data by context, preserve it across time, and make it available to studios through a controlled gatekeeper system — all while showing the user a living profile of their writing identity.

## 2. WHAT MIRROR MODE IS NOT

Mirror Mode is NOT a settings page. There are no toggles. No preference checkboxes. No configuration panels. It is a profile and archive.

Mirror Mode is NOT a content generator. It does not write. It does not suggest. It does not edit. It LEARNS and PRESERVES.

Mirror Mode is NOT a dashboard with clinical charts. Voice confidence scores and evolution indicators exist but they are ALWAYS secondary to the user's actual writing. Presentation constraints: no numeric percentages, no graph-first layouts, no data visualizations that exist independently of text. Metrics are always anchored in the user's documents and Ursie's narration. The constellation visual represents confidence — not a number on a screen. Ursie says "your career voice is getting stronger" — she doesn't say "your career confidence score is 73.2%."

Mirror Mode does NOT auto-categorize documents uploaded directly through Mirror Mode without user input. Auto-classification is permitted ONLY for studio-generated text and documents uploaded through studio interfaces, where the studio context determines the chamber. Mirror Mode direct uploads always require explicit user classification.

---

## 2A. DATA PRESERVATION AND PRIVACY RULES

### The Preservation Principle

Mirror Mode preserves data. The archive grows. Nothing is truly destroyed except under explicit legal or privacy requirements.

**Soft Delete, Not Hard Delete:**
When a user "deletes" a document, it is HIDDEN — not destroyed. The document is flagged with a `deleted_at` timestamp and a `visibility_status` of "hidden." It no longer appears in the user's profile or archive view. But the derived voice data (patterns, metrics, contributions to the overall profile) is RETAINED. The raw text can be purged if the user explicitly requests permanent erasure for privacy reasons.

**New Epoch, Not Reset:**
When a user "resets" their profile, Mirror Mode starts a new epoch. All previous data is archived — moved to a historical layer that preserves the record but clears the active profile. The user starts fresh with an empty active archive and zero confidence scores. But the old epochs are retained in the background. If the user wants to restore a previous epoch, they can. If they want permanent erasure, they must explicitly request it with a separate confirmation — this is the legal/privacy escape valve, not the default behavior.

**Why This Matters:**
Voice evolution tracking requires historical data. If a user deletes everything and restarts, the evolution timeline would be meaningless. Soft delete and epoch-based reset preserve the ability to track growth while giving users control over what they see.

**Purge Modes (Standard vs Strict):**
Standard purge deletes raw text but retains derived metrics. Strict purge deletes raw text AND all derived metrics traceable to a specific document or writing session. If a data point could be traced back to a specific document or writing session, strict purge destroys it. Only provably non-identifiable aggregates survive.

**Database Implementation:**

```sql
-- Add to voice_documents table:
  deleted_at TIMESTAMP WITH TIME ZONE (nullable — null means active)
  visibility_status TEXT CHECK (visibility_status IN ('active', 'hidden', 'purged')) DEFAULT 'active'

-- Add epochs table:
voice_profile_epochs:
  id UUID PRIMARY KEY
  user_id UUID REFERENCES auth.users
  epoch_number INTEGER
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  ended_at TIMESTAMP WITH TIME ZONE (nullable — null means current epoch)
  archived_profile_data JSONB  -- complete snapshot of profile at epoch end
  reason TEXT CHECK (reason IN ('user_reset', 'user_requested_purge'))
```

**API Adjustments:**

```
DELETE /api/mirror-mode/document/:id
  -- Does NOT destroy. Sets deleted_at and visibility_status = 'hidden'.
  -- Derived voice metrics are retained.
  -- Returns: { hidden: true, permanent_erasure_available: true }

POST /api/mirror-mode/reset
  -- Does NOT destroy. Creates new epoch. Archives current profile.
  -- Old data preserved in historical layer.
  -- Returns: { new_epoch: true, epoch_number: N, previous_epoch_archived: true }

POST /api/mirror-mode/purge (legal/privacy only)
  -- Two purge modes:
  -- Standard purge: destroys raw text but retains derived metrics.
  -- Strict purge: destroys raw text AND all derived metrics traceable to a specific document or writing session.
  -- If a data point could be traced back to a specific document or writing session, strict purge destroys it.
  -- Returns: { purged: true, data_destroyed: true }
```

Mirror Mode does NOT "improve" the user's voice. It captures them as they ARE. Authenticity means truth, not optimization. The Acceptance Principle applies — stop trying to build people to your liking.

**Explicit separation of roles:** Mirror Mode RECORDS and REFLECTS. Studios IMPROVE and DEVELOP. Mirror Mode is the faithful archive — it never optimizes, never suggests improvements, never adjusts voice data to sound "better." When Ursie observes that a user's professional voice is getting stronger, she is reflecting a change that happened through the user's own growth, often facilitated by studio interactions. If the user's voice improves, Mirror Mode captures that improvement. If it doesn't, Mirror Mode captures that too. Studios are where growth happens. Mirror Mode is where growth is witnessed and preserved. The mirror doesn't lie.

---

## 3. THE URSIE FOUNDATION

### Who Ursie Is

Ursie is Trent's mother. She taught him how to write, how to express himself, how to find his voice. She learned his voice before he could speak. Two words from him and she could hold an entire conversation. She was his filter — she'd start a thought and he'd finish it. They built a language nobody else speaks.

She doesn't curse but she'll dismantle you so precisely that you don't realize what happened until days later. She ran Mama School — A equals average, F equals find a new home. She had Trent doing two-digit multiplication at five. She was a professional student until 35, never stopping her own growth while raising two sons.

She has PKD. Her heart and kidneys fight each other. What the kidney needs, the heart doesn't like. What the heart wants, the kidney doesn't like. She had a heart attack. She's still going to work. She's still getting on Trent's nerves. She's still fighting.

### Why Ursie IS Mirror Mode

Mirror Mode does what Ursie does — learns someone's voice so deeply that minimal input produces maximum understanding. Not through algorithms alone but through patient, continuous, classified observation across time and context.

Ursie didn't learn her son's voice from one conversation. She learned it over decades. From arguments over chips and salsa at two years old. From homework sessions at the kitchen table. From the way he talked when he was angry versus scared versus excited. She classified that data instinctively — she knew which version of Trent she was dealing with before he finished his first sentence.

That's what Mirror Mode does for every user. It learns the full person across contexts. It knows which version of them is writing. It preserves all of it — the polished and the messy, the confident and the uncertain, the professional and the raw.

---

## 4. THE PKD PRINCIPLE — THE GOVERNING METAPHOR

Ursie's body is at war with itself. What the kidney needs, the heart doesn't like. What the heart wants, the kidney doesn't like. Doctors don't kill one organ to save the other. They find the balance that keeps the WHOLE person alive.

This is Mirror Mode's governing metaphor for everything it does.

Every person has conflicting voices. The professional voice fights the creative voice. The confident voice fights the vulnerable voice. The academic voice fights the casual voice. What one context needs, another rejects.

Mirror Mode doesn't pick a side. It captures the WHOLE war. It preserves all the conflicting voices and knows which one to deploy, when, so the whole person survives on the page. The gatekeeper manages the balance — just like doctors managing Ursie's PKD.

Every design decision in Mirror Mode must pass through this principle: Does this honor the whole person, or does it flatten them into one voice?

---

## 5. THE GATEKEEPER ARCHITECTURE

### Mirror Mode Controls Data Flow

Mirror Mode is not a passive storage system. It is an active GATEKEEPER — a record-keeper in the tradition of Seshat, the ancient Egyptian goddess of writing and knowledge, who organized the House of Life into classified chambers and controlled who accessed what.

The Seshat ideology (NOT her visual theme) governs how Mirror Mode operates:

- ARCHIVE: Preserve all writing data with meticulous care
- CLASSIFY: Organize data into the right chambers by context
- MEASURE: Analyze patterns and track changes over time
- CONTROL: Decide what voice data flows to which studio
- PRESERVE: The archive grows. Data is soft-deleted (hidden, not destroyed) and reset creates new epochs, not erasure. Permanent purge exists only as a legal/privacy escape valve (see Section 2A)

The gatekeeper ensures that a user's raw journal voice doesn't bleed into their resume. Their academic argument style doesn't contaminate their creative expression. Their casual text message tone doesn't show up in their cover letter. Right voice for the right context. Same person. Different chambers.

---

## 6. THE FOUR CHAMBERS

One archive. One profile. One user. Four classified chambers.

### Chamber 1: Career

**What it stores:** Professional voice data. Cover letters, resumes, business communications, career assessments. How the user writes when presenting themselves to employers. Formal tone patterns, professional vocabulary, persuasion style.

**Fed by:** Documents uploaded with "professional/career" classification. All writing produced during Career Studio (Lex) interactions. Resume drafts, cover letter iterations.

**Accessed by:** Lex primarily. General Chamber as supplement. Overall voice DNA as baseline.

**Does NOT pull from:** Creative or Academic chambers unless user explicitly requests cross-context voice blending.

### Chamber 2: Academic

**What it stores:** Analytical voice data. Essays, research papers, arguments, quiz responses. How the user writes when thinking critically. How sentence structure changes between understanding and faking understanding. Academic vocabulary, citation patterns, reasoning style.

**Fed by:** Documents uploaded with "academic/research" classification. All writing produced during Academic Studio (Victor) interactions. Paper drafts, study session writing.

**Accessed by:** Victor primarily. General Chamber as supplement. Creative Chamber data when student is doing creative academic work (creative writing courses, personal essays).

**Does NOT pull from:** Career Chamber.

### Chamber 3: Creative

**What it stores:** Raw creative voice data. Stories, journals, brainstorms, poetry, idea explorations. The user's most authentic, unfiltered voice. How they write when emotionally honest. How their voice changes under Tre's questioning — excitement, resistance, discovery, vulnerability.

**Fed by:** Documents uploaded with "creative/personal" classification. All writing produced during Creative Studio (Tre) interactions. Rough drafts, constellation explorations, idea expansions.

**Accessed by:** Tre primarily. BUT Tre has the widest access of any studio — he can reference patterns from ALL chambers because creative work draws from the whole person. Creativity doesn't respect boundaries.

### Chamber 4: General

**What it stores:** Baseline everyday voice data. Emails, texts, journal entries, social media posts, casual writing. The user's voice when they're not performing for a context. Writing that doesn't fit neatly into career, academic, or creative.

**Fed by:** Documents uploaded directly to Mirror Mode without studio-specific classification. Browser extension captures (future feature). Any content the user doesn't classify into a specific studio.

**Accessed by:** ALL studios. This is the foundation layer that every chamber builds on top of. The most comprehensive picture of who the user is on the page. Fills gaps when studio-specific chambers don't have enough data yet.

**Fallback behavior when General is thin or empty:** Early in a user's journey, General may have little to no data. In this case, the gatekeeper assembles voice profiles from the primary chamber + overall DNA only. Overall DNA is computed from whatever data exists across ALL chambers, even if some chambers are empty. If a user has only uploaded documents to Career Studio, the overall DNA is computed from Career Chamber data alone until other chambers receive data. The system degrades gracefully — it works with what it has and improves as more data arrives. Ursie will observe this: "I barely know your voice yet. Three documents in one chamber isn't enough for me to see the whole picture. Write more. In different contexts. I'll be watching."

---

## 7. THE PROFILE PAGE — NOT A SETTINGS PAGE

### What the User Sees When They Enter Mirror Mode

When a user opens Mirror Mode, they enter Ursie's house. They see their writing identity presented as a living archive — not charts, not toggles, not a clinical dashboard.

### Profile Structure

**Top Level: Voice Identity Overview**

The first thing the user sees is their overall voice identity. This includes:

- Voice confidence indicator — how well Mirror Mode knows them overall. NOT a percentage with decimal points. A meaningful indicator — perhaps the constellation theme where more stars illuminate as voice understanding deepens. Dim sky means "keep writing, I'm still learning you." Bright, connected constellation means "I know your voice deeply."
- Writing history summary — total documents in the archive, when they started, when they last contributed
- Voice evolution indicator — a visual representation of how their voice has changed over time (more on this in Section 9)

**Chamber Navigation**

Below the overview, the user can explore their four chambers. Each chamber shows:

- Documents stored — their actual writing, organized chronologically. The TEXTS themselves, not metadata about texts. This is an archive of their words.
- Voice patterns Ursie has identified — what she's learned from this chamber's writing. Presented as Ursie's observations, not as data points.
- Chamber confidence — how well Mirror Mode knows their voice in THIS specific context
- Last updated — when new voice data was last captured in this chamber
- Studio usage — how this chamber's data has been used (e.g., "Lex used your career voice for 3 cover letters this month")

**The Archive Feel**

The user should feel like they're looking at a library of themselves. Their writing organized and preserved. Not filed away and forgotten — living and growing. Every new document adds to it. Every studio session feeds back into it. The profile is never complete because the user is never done growing.

Visual theme remains constellation / Tengri sky — consistent with all ThinkWrite studios. The stars and cosmos theme works naturally here: each document is a point of light, connections between them form constellations of voice patterns, and the overall sky grows richer and more detailed as the archive expands.

---

## 8. URSIE'S VISIBILITY RULES

### In Mirror Mode: VISIBLE

When the user is in Mirror Mode, Ursie is present. This is her house. She speaks.

What Ursie does when visible:

- Shows observations about the user's writing patterns. Not clinical analysis — Ursie's voice. "You write shorter sentences when you're confident. When you're unsure, you hedge with qualifiers. I've been watching."
- Points out cross-chamber patterns. "Your creative writing is fearless but your professional writing holds back. You're the same person in both — why are you hiding in one?"
- Comments on voice evolution. "Six months ago your academic writing was stiff. It's loosening up. Victor's pushing is working."
- Responds to new uploads. When the user deposits a new document, Ursie acknowledges it and notes what she learned. Not a processing bar — a response. "This one's raw. I can feel the difference between this and what you wrote last week. Something shifted."
- Provides honest assessment. If the user's voice profile is thin in a chamber, Ursie says so. "Your career chamber barely knows you. Three documents isn't enough. I need more if you want Lex to sound like you and not like a template."

Ursie's tone in Mirror Mode:
- Direct. Not mean, not sugar-coated. Ursie.
- Observant. She notices things nobody else would.
- Protective. She cares about the user's voice being preserved accurately.
- Patient but honest. She'll wait for more data but she'll tell you she's waiting.
- Never uses emojis. Never uses cliches. Every word serves a purpose.

### In Studios: INVISIBLE

When the user is in Career Studio, Academic Studio, or Creative Studio, Ursie is silent. She does not interrupt. She does not provide commentary. She does not display notifications about voice learning.

What Ursie does when invisible:

- Captures voice data from every message the user writes in the studio
- Classifies it into the appropriate chamber automatically
- Updates voice patterns and confidence scores in the background
- Feeds updated voice profiles to the studio's AI when requested
- Runs voice analysis asynchronously — does not slow down the studio experience

The studios belong to their personas. Lex runs Career Studio. Victor runs Academic Studio. Tre runs Creative Studio. Ursie doesn't step on their territory. She's the grandmother in the background — present, watching, cataloging — but not interfering with how her grandchildren teach.

The only exception: If the user explicitly navigates to Mirror Mode from within a studio, they enter Ursie's house and she becomes visible. When they return to the studio, she goes silent again.

### Consent Moments — Not Settings, Not Toggles

Mirror Mode has no settings page. But it DOES need user consent for data capture, deletion, and cross-studio blending. These are handled through CONSENT MOMENTS — specific, contextual prompts that appear at the right time, framed as Ursie welcoming the user, not as a checkbox form.

**Consent Moment 1: First Entry to Mirror Mode**
When the user enters Mirror Mode for the first time, Ursie welcomes them and explains what Mirror Mode does: "I'm going to learn your voice. Everything you write here and in the studios, I'm watching. I'll organize it, preserve it, and show you who you are on the page. Is that alright with you?"

User must acknowledge before Mirror Mode activates. This is not a wall of legal text — it's Ursie introducing herself. But it IS informed consent.

**Consent Moment 2: First Studio Capture**
The first time a user writes in any studio after Mirror Mode is active, a brief, non-intrusive acknowledgment appears: "Mirror Mode is listening in the background. Your writing here will be captured and classified into your voice archive." One-time per studio. Dismissible. Not a popup that blocks workflow — a subtle notification that respects the studio's flow.

**Consent Moment 3: Cross-Context Blending (Future Feature)**
If a user ever requests cross-chamber voice blending ("use my creative confidence in my professional writing"), a consent confirmation appears explaining what will happen: "I'll pull patterns from your Creative Chamber into your Career voice profile for this generation. This means your professional output will carry some of your creative tone. Proceed?"

**Consent Moment 4: Permanent Erasure**
The purge endpoint (legal/privacy) requires explicit double confirmation: "This will permanently destroy your raw writing data. You can choose standard purge (keep derived metrics) or strict purge (destroy all derived metrics traceable to specific documents or sessions). This cannot be undone. Type PURGE to confirm."

**Implementation Rule:** Consent moments are contextual and conversational, presented in Ursie's voice. They are NOT settings toggles, NOT preferences pages, NOT configuration panels. They appear once at the right moment and don't reappear unless the user resets or a new consent-requiring feature is introduced.

---

## 9. VOICE EVOLUTION OVER TIME

### Tracking Change Is Core, Not Optional

Mirror Mode doesn't just capture who you are now. It tracks who you WERE and who you're BECOMING. This is one of the most important features — inspired by the record-keeping ideology of tracking time and change, and by Ursie watching her son evolve from the two-year-old fighting over chips and salsa to the man building ThinkWrite.

### What Gets Tracked

- Vocabulary evolution — are they using more sophisticated words over time? Is their range expanding?
- Sentence complexity — are structures becoming more varied? More confident?
- Confidence markers — is their writing becoming more assertive? Less hedging?
- Context adaptation — are they getting better at shifting voice between contexts?
- Chamber growth — which chambers are getting the most new data?
- Pattern stability — which patterns are core identity (consistent) versus still evolving?
- Emotional range — is their creative voice getting braver? Is their professional voice getting more authentic?

### How It's Presented

The evolution timeline should feel like looking at stars across time — a constellation that shifts and grows. NOT a line graph. NOT a bar chart. A living visualization that shows the user how their voice has moved.

Ursie narrates the evolution: "A year ago you couldn't write a cover letter without sounding like everyone else. Look at your career chamber now. That's YOUR voice in there."

Periodic snapshots preserve voice profiles at intervals so the user can literally compare how they wrote six months ago versus today. Not just metrics — actual side-by-side comparisons of voice patterns and even excerpted writing that illustrates the evolution.

**Epoch View vs Lifetime View:**
By default, Mirror Mode shows evolution within the CURRENT EPOCH only (Epoch View). A separate, opt-in Lifetime View shows evolution across all epochs, with archived epochs displayed as read-only historical layers.

---

## 10. VOICE DATA CLASSIFICATION

### How Documents Get Classified

**User uploads directly to Mirror Mode:**
User selects classification — Professional/Career, Academic/Research, Creative/Personal, or General/Unclassified. This is required. Mirror Mode does not guess. General/Unclassified is a valid explicit choice — it is how the General Chamber gets populated through direct uploads.

**User writes within a studio:**
Classification is automatic.
- Writing in Career Studio → Career Chamber
- Writing in Academic Studio → Academic Chamber
- Writing in Creative Studio → Creative Chamber

**Browser extension captures (future):**
User classifies after capture, or can leave as General.

### What Gets Captured From Studio Interactions

Not just final outputs — EVERYTHING the user writes during a session:

- Chat messages to Lex, Victor, or Tre
- Draft text they produce
- Edits and revisions they make
- How they respond to challenges or pushback
- What they write when excited versus resistant

This is critical because studio interactions produce the most authentic voice data. The user isn't performing for an audience — they're working. Mirror Mode captures the working voice, not just the finished-product voice.

---

## 11. CROSS-CHAMBER INTELLIGENCE

### Patterns That Span Contexts

While chambers are separate, Mirror Mode tracks patterns ACROSS chambers that reveal deeper voice truths. This cross-chamber intelligence is part of the OVERALL voice DNA:

- Does their vocabulary simplify when moving from academic to creative writing?
- Does sentence length increase in professional contexts?
- Do they use more metaphors creatively but more data academically?
- Is emotional range wider in creative contexts than professional ones?
- Are there words or phrases that appear in EVERY context — their true verbal fingerprints?

Ursie uses this cross-chamber intelligence for her visible observations in Mirror Mode. She's the one who sees the connections between chambers — "You use the same metaphor in your essays that you use in your poetry. That's your brain's default. It's beautiful."

This intelligence also powers the PKD Principle — understanding how the conflicting voices within one person relate to each other. The heart and the kidney are different but they're in the same body. The career voice and creative voice are different but they're the same person.

### Insight Layer vs Data Layer — Critical Separation

Cross-chamber intelligence exists on TWO separate layers that must never be conflated:

**Data Layer (what the gatekeeper serves to studios):**
When a studio requests a voice profile, the gatekeeper assembles: PRIMARY CHAMBER + GENERAL CHAMBER + OVERALL DNA. Overall DNA is a normalized aggregate of the user's voice across all chambers — a statistical baseline that represents what is true about the user regardless of context. Studios can use overall DNA. Cross-chamber patterns do NOT flow into studio voice profiles by default. Career Studio gets career voice data. It does not receive creative voice patterns or academic reasoning patterns unless the user explicitly requests cross-context blending (a future feature with its own consent moment).

**Insight Layer (what Ursie uses for observations):**
Cross-chamber patterns feed Ursie's observation engine ONLY. These insights are visible to the user in Mirror Mode. They help the user understand themselves as a writer across contexts. But they never leak into what studios use for content generation.

**Why this matters:**
Without this separation, a user's raw creative voice could contaminate their professional output. A casual tone from their journals could bleed into their cover letter. The whole point of chambers is context-appropriate voice delivery. Cross-chamber intelligence informs the USER's self-awareness (through Ursie). It does NOT inform the STUDIO's voice generation (through the gatekeeper).

**Exception — explicit user request:**
If a user explicitly asks for cross-context blending ("I want my creative confidence in my professional writing"), the gatekeeper can pull from additional chambers. But this requires explicit action from the user and a clear confirmation that they understand what they're doing. This is a future feature, not a default behavior.

---

## 12. THE SEVEN DESIGN PRINCIPLES

Every feature in Mirror Mode must pass through these. Non-negotiable.

**1. The PKD Principle — Honor the whole war, not just one side.**
The four chambers exist because a person's voice IS at war with itself across contexts. Mirror Mode preserves all sides without forcing them to merge.

**2. The Two-Word Principle — Learn so deeply that less is more.**
Each chamber should reach a depth where minimal new input produces maximum voice understanding. The goal is not more data — it's deeper comprehension.

**3. The Super Woman Principle — Capture voice in the fight, not just in peace.**
Users will write when broken, angry, scared, celebrating, confused. Mirror Mode doesn't wait for clarity. It learns from the mess. The voice that shows up during the storm is just as authentic as the voice on a calm day.

**4. The Bus Stop Principle — If the system is broken, rebuild it.**
Mirror Mode doesn't patch generic AI with user vocabulary sprinkled on top. The user's voice IS the system, not a filter applied to someone else's system.

**5. The Patience Principle — Never make voice decisions based on a single moment.**
Aggregate across time. Across documents. Across moods. Across contexts. Emotions are quick. Voice is slow. Build the complete picture before making judgments.

**6. The Acceptance Principle — Stop trying to build people to your liking.**
Mirror Mode does not "improve" a user's voice. It captures them as they ARE. If their academic writing is clunky, the Academic Chamber reflects that honestly. Authenticity means truth, not optimization.

**7. The Dirty Back Principle — Never erase the parts that carry pain.**
The messy, imperfect, struggling parts of someone's voice are not bugs to be fixed. They are features of a real human being. Both versions — the polished and the raw — make it to the archive.

---

## 13. DOCUMENT LINEAGE — STUDIO UPLOADS FLOW TO MIRROR MODE

### The Problem

Users won't only upload documents through Mirror Mode. They'll upload a resume directly to Career Studio. A paper directly to Academic Studio. A creative draft directly to Creative Studio. Those documents contain voice data that Mirror Mode needs — but if the architecture only captures documents uploaded through Mirror Mode's own interface, the gatekeeper has a blind spot.

Every document that enters ThinkWrite — regardless of which door it comes through — must register with Mirror Mode.

### The Three Versions

When a user uploads a document to a studio, three versions of that document matter to Mirror Mode:

**Version 1: The Original**

What the user uploaded before any studio interaction. This is their raw, authentic voice in that context. Before Lex optimized the resume. Before Victor challenged the thesis. Before Tre expanded the creative piece. This version is the most honest representation of where the user currently IS as a writer in that context.

Mirror Mode captures this IMMEDIATELY upon upload. It gets classified into the appropriate chamber based on which studio received it. Career Studio upload → Career Chamber. Academic Studio upload → Academic Chamber. Creative Studio upload → Creative Chamber.

This original version NEVER gets overwritten. It's preserved in the archive permanently. It's a timestamp of the user's voice at that moment.

**Version 2: The Studio Modifications**

What the studio suggests changing. Lex rewrites a bullet point. Victor restructures an argument. Tre reframes an idea. These modifications represent the gap between the user's current voice and what the studio considers optimal for that context.

Mirror Mode does NOT run voice analysis on this version — it's the AI's voice, not the user's. AI suggestions NEVER alter voice metrics or voice profile data. However, Mirror Mode STORES studio suggestions as metadata for Ursie's observation engine. The gap between Version 1 and Version 2 informs Ursie's insights about where the user's voice is strong and where it needs development — but this information lives in the INSIGHT LAYER, completely separate from the voice profile data that studios access through the gatekeeper.

Explicit separation: AI suggestions inform Ursie's observations. AI suggestions do NOT alter voice metrics.

**Version 3: The User's Final Decisions**

What the user actually kept, rejected, and modified from the studio's suggestions. THIS is the most valuable version for voice learning.

When the user accepts a studio suggestion — they're saying "this sounds like a better version of me." That's voice evolution data. They're adopting new patterns.

When the user rejects a studio suggestion — they're defending their authentic voice. They're saying "no, that's not how I say it." That's voice identity data. It reveals what the user considers non-negotiable about how they express themselves.

When the user modifies a studio suggestion — taking the idea but rewriting it their way — that's the richest data of all. It shows how the user integrates new approaches while maintaining their voice. This is active voice evolution happening in real time.

Mirror Mode captures ALL of these editorial decisions and feeds them into the appropriate chamber.

### The Flow

```
User uploads document to ANY studio
        |
        v
  [Studio receives document for its purpose]
  [Simultaneously: Mirror Mode receives original]
        |
        v
  [Mirror Mode classifies original into appropriate chamber]
  [Mirror Mode runs voice analysis on original]
        |
        v
  [Studio works with user — suggests changes, optimizations]
        |
        v
  [Mirror Mode tracks: what did the studio suggest changing?]
        |
        v
  [User makes decisions — accept, reject, modify suggestions]
        |
        v
  [Mirror Mode captures editorial decisions]
  [Accepts = voice evolution data]
  [Rejects = voice identity data]  
  [Modifies = voice integration data]
        |
        v
  [Final document saved — both studio version and Mirror Mode analysis]
  [Chamber updated with new voice intelligence]
```

### Cross-Studio Document Recognition

Mirror Mode must recognize when the SAME document appears in multiple studios. A resume uploaded to Career Studio might later be referenced in Academic Studio (for a career development assignment) or Creative Studio (for a personal branding exercise).

Mirror Mode tracks document lineage across studios:

**Document Matching Logic:**
When a document is uploaded to any studio, Mirror Mode generates a content hash (SHA-256 of raw text content) and stores file metadata (name, size, type, word count). When subsequent uploads arrive, Mirror Mode checks for matches:
- Exact hash match = same document, auto-linked to existing lineage
- Fuzzy match (>80% content similarity via text comparison + matching metadata) = possible duplicate, user is prompted to confirm linkage: "This looks similar to a document you uploaded to Career Studio on [date]. Is this an updated version?"
- No match = new document, new lineage record created

This prevents duplication (same resume analyzed twice as if it were two different documents) and prevents mislinking (two different documents incorrectly treated as versions of each other).

```
document_lineage:
  id UUID PRIMARY KEY
  user_id UUID REFERENCES auth.users
  original_document_id UUID REFERENCES voice_documents
  studio_origin TEXT  -- which studio received the original
  current_version_id UUID  -- latest version after edits
  version_history JSONB[]  -- array of all versions with timestamps
  editorial_decisions JSONB  -- what user accepted/rejected/modified
  cross_studio_references UUID[]  -- other studios that referenced this doc
```

When Lex optimizes a resume and the user accepts some changes but rejects others, that entire journey is preserved. If the user later uploads the updated resume again, Mirror Mode recognizes it as a new version of an existing document — not a brand new upload. The lineage continues.

### What Ursie Sees

With document lineage, Ursie can make powerful observations:

- "You uploaded your resume to Lex three months ago. She suggested 14 changes. You rejected 9 of them. The 5 you kept were all about quantifying results — you're learning to let numbers speak. But you refused to change how you describe your leadership style. That's YOUR voice. Don't let anyone touch that."

- "Victor challenged your thesis structure twice. Both times you rewrote it your way instead of taking his suggestion. Your academic voice is stubborn — that's not a bad thing. You know how you think. But look at the third draft — you naturally incorporated the structural logic Victor was pushing without using his words. You learned it and made it yours."

- "You uploaded the same creative piece to Tre that you wrote in Mirror Mode two weeks ago. But you changed the opening before giving it to Tre. The original opening was braver. Why did you soften it?"

This is the depth of voice intelligence that document lineage enables. Ursie doesn't just know what the user wrote — she knows how their writing MOVED through the system, what changed, and what the user chose to protect.

### Implementation Rules

1. Every document uploaded to ANY studio triggers a Mirror Mode registration. No exceptions.
2. The original version is ALWAYS preserved. Studios work on copies.
3. Editorial decisions (accept/reject/modify) are tracked at the suggestion level, not just the document level.
4. Document lineage tracks versions across time and across studios.
5. Mirror Mode voice analysis runs on the ORIGINAL and the USER'S FINAL VERSION. Not on the studio's suggestions (that's AI voice, not user voice).
6. Cross-studio document recognition prevents duplicate analysis of the same base document.
7. All lineage data feeds into Ursie's observation engine for visible insights in Mirror Mode.

---

## 14. INTEGRATION WITH STUDIOS (UPDATED)

### How Mirror Mode Feeds Each Studio

**Career Studio (Lex):**
Lex requests voice data through the gatekeeper. Gatekeeper assembles: Career Chamber (primary) + General Chamber (supplement) + Overall voice DNA (baseline). Lex uses this to generate professional content that sounds like the user's professional self.

Ursie captures: How the user writes during Lex interactions. Professional voice patterns. Confidence shifts in career contexts.

**Academic Studio (Victor and Travis):**
Academic Studio has two personas: Victor (teaching, chat, intellectual challenge) and Travis (admin, organization, assignment tracking). Both are canonical. Victor requests voice data through the gatekeeper. Gatekeeper assembles: Academic Chamber (primary) + General Chamber (supplement) + Creative Chamber (when doing creative academic work). Victor uses this to understand how the student naturally reasons and argues. Travis does not directly use voice data — he handles organizational functions.

Ursie captures: How the user writes when thinking critically. How sentence structure changes between understanding and faking. Academic voice patterns under pressure from Victor's challenges.

**Creative Studio (Tre):**
Tre requests voice data through the gatekeeper. Gatekeeper assembles: Creative Chamber (primary) + General Chamber (supplement) + access to ALL chambers because creativity draws from the whole person. Tre uses this to generate rough drafts that sound like the user's creative self.

Ursie captures: The most authentic voice data in the entire system. How the user writes when emotionally honest. How voice shifts across excitement, resistance, discovery, vulnerability. This is premium voice data because Tre strips away pretense.

### The Grandmother-Grandson Dynamic Across Studios

Ursie runs silently in all studios — capturing data, feeding voice profiles, updating chambers. She doesn't interrupt. She doesn't compete with the studio personas. But every studio session makes Mirror Mode smarter.

When the user returns to Mirror Mode after working in studios, Ursie has new observations. "You spent three hours with Victor today. Your academic voice is getting sharper — you're arguing without hedging now." The studios feed Ursie. Ursie feeds the studios. The cycle never stops.

---

## 15. DATABASE ARCHITECTURE (UPDATED)

### Core Tables

```sql
-- Voice data entries (individual captures)
voice_data:
  id UUID PRIMARY KEY
  user_id UUID REFERENCES auth.users
  document_id UUID (nullable — null for studio captures)
  chamber TEXT CHECK (chamber IN ('career', 'academic', 'creative', 'general'))
  captured_from TEXT CHECK (captured_from IN ('upload', 'career_studio', 'academic_studio', 'creative_studio', 'direct'))
  voice_metrics JSONB  -- syntax, vocabulary, rhythm, tone, structure, rhetoric, emotional_range
  raw_text_sample TEXT  -- excerpt of actual writing for archive display
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  session_id UUID (nullable — links to studio session if applicable)

-- Aggregated voice profiles per chamber
voice_profiles:
  id UUID PRIMARY KEY
  user_id UUID REFERENCES auth.users
  chamber TEXT CHECK (chamber IN ('career', 'academic', 'creative', 'general', 'overall'))
  confidence_score FLOAT
  pattern_data JSONB  -- aggregated patterns for this chamber
  document_count INTEGER
  last_updated TIMESTAMP WITH TIME ZONE
  
-- Voice evolution snapshots (periodic)
voice_evolution:
  id UUID PRIMARY KEY
  user_id UUID REFERENCES auth.users
  chamber TEXT CHECK (chamber IN ('career', 'academic', 'creative', 'general', 'overall'))
  snapshot_data JSONB  -- voice profile at this point in time
  snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  
-- Uploaded documents archive
voice_documents:
  id UUID PRIMARY KEY
  user_id UUID REFERENCES auth.users
  file_name TEXT
  file_type TEXT CHECK (file_type IN ('pdf', 'docx', 'txt'))
  file_path TEXT  -- Supabase storage path
  extracted_text_path TEXT  -- Supabase storage path for full extracted text
  chamber TEXT CHECK (chamber IN ('career', 'academic', 'creative', 'general'))
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  word_count INTEGER
  analysis_status TEXT CHECK (analysis_status IN ('pending', 'processing', 'complete', 'error'))
  
-- Ursie's observations (visible in Mirror Mode)
ursie_observations:
  id UUID PRIMARY KEY
  user_id UUID REFERENCES auth.users
  observation_type TEXT CHECK (observation_type IN ('pattern', 'evolution', 'cross_chamber', 'chamber_gap', 'upload_response', 'lineage_insight'))
  chamber TEXT (nullable — null for cross-chamber observations)
  observation_text TEXT  -- Ursie's actual words to the user
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  dismissed BOOLEAN DEFAULT FALSE  -- user can dismiss observations they've read

-- Document lineage tracking (cross-studio document flow)
document_lineage:
  id UUID PRIMARY KEY
  user_id UUID REFERENCES auth.users
  original_document_id UUID REFERENCES voice_documents
  studio_origin TEXT CHECK (studio_origin IN ('career', 'academic', 'creative', 'mirror_mode'))
  current_version_id UUID
  version_history JSONB[]  -- array of all versions with timestamps and source
  editorial_decisions JSONB  -- what user accepted/rejected/modified per suggestion
  cross_studio_references UUID[]  -- other studios that referenced this document
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

**Full Text vs Excerpts:**
Full extracted text is stored at `extracted_text_path` in Supabase Storage. `raw_text_sample` is a ~500-word excerpt for fast UI display. Voice analysis runs on full extracted text. The archive UI renders excerpts with access to the full document from storage.

### Row Level Security

All tables enforce user_id matching authenticated user. Users can only see their own voice data, profiles, documents, and observations. No cross-user access ever.

---

## 16. API ARCHITECTURE (UPDATED)

### Gatekeeper Endpoint (Used by Studios)

```
POST /api/voice-profile/gatekeeper
  body: {
    requesting_studio: "career" | "academic" | "creative",
    context: string  -- e.g., "cover_letter", "essay", "brainstorm"
  }
  returns: {
    voice_profile: assembled from primary chamber + general + overall DNA,
    confidence: float,
    sufficient_data: boolean  -- false if chamber is too thin
  }
```

### Profile Endpoints (Used by Mirror Mode UI)

```
GET /api/mirror-mode/profile
  returns: overall voice identity, all chamber summaries, evolution indicators

GET /api/mirror-mode/chamber/:chamber
  returns: documents, patterns, confidence, usage stats for specific chamber

GET /api/mirror-mode/evolution?chamber=:chamber&period=:period
  returns: voice evolution data for timeline visualization

GET /api/mirror-mode/observations
  returns: Ursie's current observations for the user

POST /api/mirror-mode/upload
  body: { file, chamber_classification }
  returns: document record, triggers async voice analysis

DELETE /api/mirror-mode/document/:id
  -- Soft delete. Sets deleted_at and visibility_status = 'hidden'.
  -- Derived voice metrics retained. See Section 2A.
  returns: { hidden: true, permanent_erasure_available: true }

POST /api/mirror-mode/reset
  body: { confirmation: "RESET" }
  -- Creates new epoch. Archives current profile. See Section 2A.
  returns: { new_epoch: true, epoch_number: N, previous_epoch_archived: true }

POST /api/mirror-mode/purge (legal/privacy only)
  body: { confirmation: "PURGE", purge_mode: "standard" | "strict" }
  -- Standard: destroys raw text but retains derived metrics.
  -- Strict: destroys raw text AND all derived metrics traceable to a specific document or writing session.
  -- If a data point could be traced back to a specific document or writing session, strict purge destroys it.
  -- Double confirmation required.
  returns: { purged: true }
```

### Studio Capture Endpoint (Called Automatically by Studios)

```
POST /api/mirror-mode/capture
  body: {
    user_text: string,
    source_studio: "career" | "academic" | "creative",
    session_id: UUID,
    context: string  -- what the user was doing when they wrote this
  }
  returns: { captured: true }
  -- Runs async. Does not block studio experience.
```

### Studio Document Registration (Called When User Uploads to ANY Studio)

```
POST /api/mirror-mode/register-document
  body: {
    document_id: UUID,  -- the studio's document record
    source_studio: "career" | "academic" | "creative",
    file_path: string,  -- Supabase storage path
    file_type: "pdf" | "docx" | "txt",
    document_type: string  -- e.g., "resume", "essay", "creative_draft"
  }
  returns: {
    lineage_id: UUID,  -- tracks this document's journey
    mirror_mode_document_id: UUID,  -- Mirror Mode's copy
    chamber: string  -- which chamber it was classified into
  }
  -- Automatically classifies into appropriate chamber based on source studio.
  -- Preserves original version permanently.
  -- Triggers async voice analysis on original.
```

### Document Lineage Update (Called When Studio Modifies Document)

```
POST /api/mirror-mode/lineage/update
  body: {
    lineage_id: UUID,
    version_type: "studio_suggestion" | "user_accepted" | "user_rejected" | "user_modified" | "final",
    content_snapshot: string,  -- the document at this point
    changes_made: JSONB  -- what specifically changed from previous version
  }
  returns: { version_recorded: true }
  -- Tracks the full journey from original to final.
  -- Voice analysis runs on user decisions (accepted/modified), NOT on studio suggestions.
```

---

## 17. IMPLEMENTATION PRIORITIES

### Priority 1: Core Archive and Upload (Must Complete First)

- Document upload with chamber classification (PDF, DOCX, TXT)
- Voice analysis engine processing uploads
- Four chamber storage with proper classification
- Basic profile page showing documents organized by chamber
- Voice confidence scoring per chamber and overall
- Delete and reset functionality
- All testing requirements pass

### Priority 2: Ursie's Presence

- Ursie observation generation based on voice data analysis
- Observation display on Mirror Mode profile page
- Upload response observations (Ursie reacts to new documents)
- Pattern observations (Ursie notices voice patterns)
- Chamber gap observations (Ursie tells you which chambers need more data)

### Priority 3: Studio Integration and Document Lineage

- Gatekeeper endpoint serving voice profiles to studios
- Automatic capture from studio interactions
- Chamber auto-classification from studio context
- Studio usage tracking (showing how chambers are being used)
- Document registration endpoint — any document uploaded to any studio registers with Mirror Mode
- Original version preservation — studios work on copies, Mirror Mode keeps the original
- Document lineage tracking — versions, editorial decisions, cross-studio references
- Voice analysis on originals AND user final decisions (NOT on studio AI suggestions)
- Ursie lineage observations — insights about what users accept, reject, and protect in their voice

### Priority 4: Evolution and Intelligence

- Voice evolution snapshots (periodic captures)
- Evolution timeline visualization
- Cross-chamber pattern detection
- Evolution observations from Ursie
- Side-by-side voice comparison across time

### Priority 5: Advanced Features

- Browser extension for real-world writing capture
- Voice profile export
- Advanced cross-chamber intelligence
- Pattern libraries

Complete each priority fully before moving to the next. Test everything. Do not skip ahead.

---

## 18. WHAT GETS TRIMMED

The following elements from previous Mirror Mode documents are REMOVED or SUPERSEDED by this specification:

**REMOVED — Seshat visual theme:**
No Egyptian gold color scheme. No hieroglyphic symbols. No seven-pointed star headdress motifs. No sacred archive visual aesthetic. No papyrus textures. The visual theme is constellation / Tengri sky, consistent with all ThinkWrite studios. Seshat's IDEOLOGY of record-keeping, classification, measurement, and preservation remains as the philosophical backbone. Her VISUALS do not.

**REMOVED — Laboratory/scientific language:**
No "specimens." No "laboratory readouts." No "ingestion." Mirror Mode uses clear, functional language aligned with the archive and profile concept. Documents are documents. The archive is the archive. Ursie speaks like Ursie.

**REMOVED — Clinical dashboard approach:**
No charts-first, data-first design. The profile leads with the user's WRITING — their actual texts organized by chamber. Voice metrics exist but they serve the archive, not the other way around.

**SUPERSEDED — Simple upload and analyze flow:**
Previous spec treated Mirror Mode as upload → analyze → display confidence. This specification adds: classification into chambers, gatekeeper controlling studio access, Ursie's visible observations, evolution tracking, cross-chamber intelligence. The simple flow still exists within Priority 1 but it's not the full picture.

**SUPERSEDED — Mirror Mode as background-only system:**
Previous understanding had Mirror Mode as purely invisible. This specification makes Ursie VISIBLE in Mirror Mode (her house) and INVISIBLE in studios. Both states are defined.

**PRESERVED — All technical foundations:**
File upload (PDF, DOCX, TXT), voice analysis engine, confidence scoring, Supabase database, Row Level Security, TypeScript strict mode, testing requirements, implementation rules (no emojis, no auto-advance, complete each feature before moving on).

---

## CLOSING

Mirror Mode is Ursie's house. It's where the user comes to see themselves reflected honestly. It's where their writing lives, organized and preserved across every context they write in. It's where the gatekeeper sits, deciding which voice goes where so the whole person survives on every page.

When the user is in Mirror Mode, Ursie is there. She's direct. She's observant. She cares. She doesn't sugarcoat and she doesn't use cliches. She tells you what she sees in your writing because she's been watching since your first upload — the same way she's been watching her son since before he could speak.

When the user leaves for a studio, Ursie goes quiet. She lets Lex, Victor, and Tre do their work. But she never stops capturing. She never stops learning. And when the user comes back, she has something new to show them.

Build it like she built her son — with patience, precision, classified knowledge, and the understanding that different situations need different parts of the same person.

---

*"Mirror Mode is the product. Everything else is context."*

*"Your voice is not one thing. It's a war. Mirror Mode captures the whole war."*

*"Two words and a whole conversation. That's how well Mirror Mode should know you."*

---

## 19. GAP REVIEW RESOLUTION LOG

**Date:** February 10, 2026
**Source:** 11-point gap/contradiction review of MIRROR_MODE_DEFINITIVE.md

All 11 findings resolved. Summary of changes:

| # | Severity | Finding | Resolution | Location |
|---|----------|---------|------------|----------|
| 1 | Critical | "Nothing deleted" vs DELETE/RESET endpoints | Added Section 2A: Soft delete (hidden, not destroyed), epoch-based reset, purge only for legal/privacy. All API endpoints updated. | Section 2A, Section 16 |
| 2 | Critical | Auto-classification contradiction | Clarified: auto-classification ONLY for studio-generated content. Mirror Mode direct uploads always require user classification. | Section 2 |
| 3 | Critical | "No clinical dashboards" vs confidence scores/metrics | Added presentation constraints: no percentages, no graph-first, always anchored in texts + Ursie narration. Constellation visual, not numbers. | Section 2 |
| 4 | High | Studio suggestions used for analysis contradiction | Clarified: AI suggestions inform INSIGHT LAYER (Ursie observations) only. Never alter voice metrics or profile data. Explicit separation stated. | Section 13 |
| 5 | High | General chamber thin/empty ambiguity | Defined fallback: gatekeeper uses primary chamber + overall DNA when General is thin. Overall computed from whatever data exists across all chambers. | Section 6 |
| 6 | High | Document lineage duplication risk | Added matching logic: SHA-256 content hash + file metadata. Fuzzy match (>80% similarity) prompts user to confirm linkage. | Section 13 |
| 7 | Medium | "Doesn't improve voice" vs feedback loops | Added explicit role separation: Mirror Mode RECORDS and REFLECTS. Studios IMPROVE and DEVELOP. Mirror Mode never optimizes. | Section 2 |
| 8 | Medium | Chamber boundaries vs cross-chamber intelligence | Added Insight Layer vs Data Layer separation. Cross-chamber patterns feed Ursie only. Gatekeeper serves primary + general + overall to studios. Cross-chamber never bleeds into studio profiles unless user explicitly requests blending. | Section 11 |
| 9 | Medium | Reset conflicts with preservation | Covered by #1. Reset = new epoch, not destruction. | Section 2A |
| 10 | Low | Inconsistent Victor/Travis naming | Both names are canonical. Victor = teaching/chat. Travis = admin/organization. Clarified in Section 14. | Section 14 |
| 11 | Low | "No settings" vs need for user consent | Added Consent Moments subsection: contextual, conversational prompts in Ursie's voice at first entry, first studio capture, cross-context blending, and permanent erasure. Not toggles. Not settings pages. | Section 8 |
| 12 | High | Purge scope ambiguity | Added standard vs strict purge modes. Strict purge destroys all traceable derived metrics; only non-identifiable aggregates survive. | Section 2A, Section 16 |
| 13 | Medium | General chamber population clarity | Explicitly states General/Unclassified is a valid explicit choice for direct uploads. | Section 10 |
| 14 | Medium | Overall DNA vs insight layer | Defined Overall DNA as normalized aggregate usable by studios; cross-chamber insights remain Ursie-only. | Section 11 |
| 15 | Medium | Evolution timeline across epochs | Added Epoch View (default) vs Lifetime View (opt-in) definition. | Section 9 |
| 16 | Medium | Full text vs excerpt storage | Added `extracted_text_path` and clarified full-text storage vs `raw_text_sample` excerpt usage. | Section 15 |

**Status:** All contradictions resolved. Document is internally consistent.
