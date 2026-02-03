# Mirror Mode ↔ Career Studio Integration - Claude Code Implementation Guide

## Overview

This document provides the complete implementation for deep integration between Mirror Mode (the writing DNA engine) and Career Studio (Lex). The integration uses your existing `/api/mirror-mode/voice/profile` endpoint and `voice_profiles` table.

---

## What Exists (Confirmed)

### Database: `voice_profiles` table
```sql
- id: uuid (primary key)
- user_id: uuid (foreign key to auth.users)
- aggregate_fingerprint: jsonb (the VoiceFingerprint)
- confidence_level: integer (0-100)
- document_count: integer
- total_word_count: integer
- last_trained_at: timestamp
- evolution_history: jsonb array
```

### API: `/api/mirror-mode/voice/profile`
- Returns: `{ success, exists, profile, voiceDescription, voiceSummary, fingerprint }`
- VoiceFingerprint contains: `rhythm`, `voice`, `vocabulary`, `punctuation`, `rhetoric`

---

## Business Rules (Per Trent's Decisions)

1. **Users can always generate content** - Career Studio works without a voice profile
2. **Without voice profile**: Generic AI tone + warning that content won't sound like them
3. **At 60% confidence**: Generate with voice but encourage uploading more documents
4. **Feedback mechanism**: After generation, ask "Does this sound like you?" to improve

---

## Confidence Tiers

| Tier | Score Range | isReady | Behavior |
|------|-------------|---------|----------|
| none | 0 | false | Generic AI + "Set up Mirror Mode" prompt |
| developing | 1-39% | false | Generic AI + strong encouragement to upload |
| emerging | 40-64% | true | Use voice + "Let me know if this sounds like you" |
| established | 65-84% | true | Use voice confidently |
| strong | 85-100% | true | Full voice confidence |

---

## Files to Create

Create these files in your project:

### 1. VoiceProfileService.ts
**Location:** `src/services/voice-profile/VoiceProfileService.ts`

This is the core service that Career Studio (and future studios) will use. It provides:
- `getProfile(userId)` - Full voice profile
- `getReadiness(userId)` - Confidence assessment
- `getGenerationContext(userId, studioType)` - Everything needed for generation

**Key method for Career Studio:**
```typescript
const context = await VoiceProfileService.getGenerationContext(userId, 'career');
// Returns:
// {
//   hasVoiceProfile: boolean,
//   readiness: { tier, score, isReady, canGenerate, shouldWarn, shouldEncourage, message, lexMessage },
//   profile: full profile or null,
//   promptInjection: string to inject into Claude/OpenAI prompt
// }
```

### 2. useVoiceProfile.ts
**Location:** `src/hooks/useVoiceProfile.ts`

React hook for Career Studio components:
```typescript
const { isLoading, profile, readiness, hasProfile, getPromptInjection } = useVoiceProfile({
  studioType: 'career'
});

// Use readiness.lexMessage for what Lex should say
// Use getPromptInjection() for the prompt to send to Claude
```

### 3. VoiceStatusIndicator.tsx
**Location:** `src/components/voice-status/VoiceStatusIndicator.tsx`

Drop-in UI component:
```tsx
// Minimal - just an icon
<VoiceStatusIndicator variant="minimal" />

// Compact - icon + percentage
<VoiceStatusIndicator variant="compact" />

// Full - complete card with progress bar
<VoiceStatusIndicator variant="full" />
```

---

## Integration Steps for Career Studio

### Step 1: Add Voice Status to Career Studio Header

Find your Career Studio layout/header component and add:

```tsx
import { VoiceStatusIndicator } from "@/components/voice-status/VoiceStatusIndicator";

// In your header/toolbar:
<VoiceStatusIndicator variant="compact" />
```

### Step 2: Modify Generation Endpoints

For each Career Studio generation endpoint (resume, cover letter, LinkedIn, etc.), update to use VoiceProfileService:

```typescript
// Example: src/app/api/career-studio/resume/generate/route.ts

import { VoiceProfileService } from "@/services/voice-profile/VoiceProfileService";

export async function POST(req: NextRequest) {
  const { userId } = await getAuthUser();
  
  // Get voice context for generation
  const voiceContext = await VoiceProfileService.getGenerationContext(userId, 'career');
  
  // Build your prompt with voice injection
  const systemPrompt = `
You are Lex, an expert career advisor with HR expertise.

${voiceContext.promptInjection}

${voiceContext.readiness.shouldWarn ? `
IMPORTANT: ${voiceContext.readiness.lexMessage}
After generating, ask if this sounds like the user's voice.
` : ''}
`;

  // Call Claude/OpenAI with this system prompt
  const response = await generateWithClaude({
    systemPrompt,
    // ... rest of your generation logic
  });

  // Include voice metadata in response for frontend
  return NextResponse.json({
    success: true,
    content: response,
    voiceMetadata: {
      usedVoiceProfile: voiceContext.hasVoiceProfile && voiceContext.readiness.isReady,
      confidenceLevel: voiceContext.readiness.score,
      shouldAskFeedback: voiceContext.readiness.shouldWarn,
    }
  });
}
```

### Step 3: Add Feedback Collection (Optional but Recommended)

After generation, if `shouldAskFeedback` is true, show a feedback UI:

```tsx
// After showing generated content:
{voiceMetadata.shouldAskFeedback && (
  <div className="mt-4 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
    <p className="text-sm text-zinc-300 mb-2">
      Does this sound like you?
    </p>
    <div className="flex gap-2">
      <button onClick={() => submitFeedback('sounds_like_me')}>
        Yes, this is my voice
      </button>
      <button onClick={() => submitFeedback('needs_work')}>
        Not quite
      </button>
      <button onClick={() => submitFeedback('not_at_all')}>
        Doesn't sound like me
      </button>
    </div>
  </div>
)}
```

---

## Files to Search/Modify in Your Codebase

Run these commands to find files that need updating:

```bash
# Find all Career Studio generation endpoints
find . -path "*/api/*" -name "*.ts" | xargs grep -l -i "career\|resume\|cover.*letter\|linkedin" 2>/dev/null

# Find where voice profile is currently consumed
grep -r "mirror-mode/voice/profile" --include="*.ts" --include="*.tsx" -l .

# Find Career Studio components that should show voice status
find . -path "*career*" -name "*.tsx" | head -20
```

---

## Testing Checklist

After implementation, verify:

- [ ] Career Studio shows voice status indicator
- [ ] Generation works with NO voice profile (generic tone + warning)
- [ ] Generation works with LOW confidence (generic tone + encouragement)
- [ ] Generation works with MEDIUM confidence (uses voice + asks feedback)
- [ ] Generation works with HIGH confidence (uses voice confidently)
- [ ] Voice profile changes reflect in Career Studio without page refresh (or with refresh)
- [ ] Lex's messages match the `lexMessage` for each confidence tier

---

## Implementation Order

1. **Create the service files** (copy from provided code)
2. **Add VoiceStatusIndicator** to Career Studio header
3. **Update ONE generation endpoint** (e.g., resume summary) as a test
4. **Verify the flow works end-to-end**
5. **Update remaining generation endpoints**
6. **Add feedback collection (Phase 3)**

---

## Notes for Claude Code

When implementing, remember:
- Don't modify the existing `/api/mirror-mode/voice/profile` endpoint - it works fine
- The new `VoiceProfileService` wraps calls to that endpoint on the server side
- The `useVoiceProfile` hook calls that endpoint from the client
- Voice injection happens via `promptInjection` string - inject it into your Claude/OpenAI system prompts
- Studio-specific adjustments are handled automatically based on `studioType` parameter
