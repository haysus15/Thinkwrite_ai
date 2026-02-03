# Mirror Mode Phase 2: Complete Implementation Guide

## Overview

You are implementing three features for Mirror Mode in ThinkWrite AI:
1. **Voice Evolution Timeline** - Collapsible stats with expandable graph + event feed
2. **Document Detail View** - Modal showing per-document analysis
3. **Get Started Onboarding** - Modal tour overlay for new users

The goal is a compact, single-page dashboard with split views where appropriate.

---

## Current Project Structure

```
src/
├── app/
│   ├── api/mirror-mode/
│   │   ├── documents/upload/route.ts    # Document upload + learning
│   │   ├── voice/status/route.ts        # Dashboard data
│   │   ├── voice/profile/route.ts       # Profile data
│   │   ├── voice/learn/route.ts         # Learning orchestrator
│   │   ├── voice/generate/route.ts      # Text generation
│   │   ├── document/[id]/route.ts       # Delete document
│   │   ├── reset/route.ts               # Reset profile
│   │   └── live-learn/route.ts          # Live learning feed
│   └── mirror-mode/
│       └── dashboard/page.tsx           # Dashboard page wrapper
├── components/mirror-mode/
│   ├── MirrorModeDashboard.tsx          # Main dashboard component
│   ├── WritingTypeSelector.tsx          # Upload type selector
│   ├── DocumentList.tsx                 # Document list with delete
│   └── ResetVoice.tsx                   # Reset confirmation
├── hooks/
│   └── useVoiceStatus.ts                # Voice status hook
└── lib/mirror-mode/
    ├── voiceAnalysis.ts                 # Fingerprint extraction
    ├── voiceAggregation.ts              # Learning/aggregation engine
    ├── extractText.ts                   # Text extraction
    ├── liveLearning.ts                  # Live learning utility
    └── voiceInjection.ts                # Voice injection for prompts
```

---

## Database Schema Changes

### 1. Add per-document fingerprint storage

```sql
-- Add fingerprint column to mirror_documents
ALTER TABLE mirror_documents 
ADD COLUMN IF NOT EXISTS document_fingerprint JSONB;
```

### 2. Evolution history is already in voice_profiles

The `evolution_history JSONB` column exists. We need to enrich the entries being stored.

**Current entry structure:**
```typescript
{
  timestamp: string,
  documentId: string,
  changesMade: string[],
  confidenceDelta: number
}
```

**New enriched entry structure:**
```typescript
{
  timestamp: string,
  documentId: string,
  documentName: string,        // NEW
  writingType: string,         // NEW
  changesMade: string[],
  confidenceDelta: number,
  confidenceLevel: number,     // NEW: absolute value after this doc
  totalWordCount: number,      // NEW: cumulative
  totalDocuments: number       // NEW: count at this point
}
```

---

## TASK 1: Update Data Layer

### 1.1 Update voiceAggregation.ts

Location: `src/lib/mirror-mode/voiceAggregation.ts`

Update the `VoiceEvolution` type:

```typescript
export type VoiceEvolution = {
  timestamp: string;
  documentId: string;
  documentName: string;
  writingType: string;
  changesMade: string[];
  confidenceDelta: number;
  confidenceLevel: number;     // Absolute confidence after this doc
  totalWordCount: number;      // Cumulative word count
  totalDocuments: number;      // Document count at this point
};
```

Update the `aggregateFingerprints` function signature to accept additional metadata:

```typescript
export function aggregateFingerprints(
  existingProfile: VoiceProfile | null,
  newFingerprint: VoiceFingerprint,
  documentId: string,
  documentMeta?: {
    fileName: string;
    writingType: string;
    wordCount: number;
  }
): VoiceProfile
```

Inside `aggregateFingerprints`, when creating the evolution entry:

```typescript
const evolutionEntry: VoiceEvolution = {
  timestamp: new Date().toISOString(),
  documentId,
  documentName: documentMeta?.fileName || 'Unknown',
  writingType: documentMeta?.writingType || 'other',
  changesMade: compareFingerprints(existingProfile?.aggregateFingerprint, newFingerprint),
  confidenceDelta: newConfidence - (existingProfile?.confidenceLevel || 0),
  confidenceLevel: newConfidence,
  totalWordCount: newTotalWordCount,
  totalDocuments: newDocumentCount,
};
```

### 1.2 Update upload route to store per-document fingerprint

Location: `src/app/api/mirror-mode/documents/upload/route.ts`

After extracting the fingerprint, store it in mirror_documents:

```typescript
// After: const newFingerprint = extractVoiceFingerprint(extractedText);

// Store per-document fingerprint
await supabase
  .from('mirror_documents')
  .update({ document_fingerprint: newFingerprint })
  .eq('id', documentId);

// Pass metadata to aggregateFingerprints
const updatedProfile = aggregateFingerprints(
  existingProfile,
  newFingerprint,
  documentId,
  {
    fileName: file.name,
    writingType,
    wordCount,
  }
);
```

### 1.3 Create API endpoint for document detail

Location: `src/app/api/mirror-mode/document/[id]/detail/route.ts`

```typescript
// GET /api/mirror-mode/document/[id]/detail
// Returns full document detail including fingerprint and text preview

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  const supabase = createRouteHandlerClient({ cookies });
  
  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch document with fingerprint
  const { data: document, error: docError } = await supabase
    .from('mirror_documents')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (docError || !document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Fetch extracted text
  const { data: content } = await supabase
    .from('mirror_document_content')
    .select('extracted_text')
    .eq('document_id', documentId)
    .single();

  // Fetch evolution entry for this document
  const { data: profile } = await supabase
    .from('voice_profiles')
    .select('evolution_history')
    .eq('user_id', user.id)
    .single();

  const evolutionEntry = (profile?.evolution_history || [])
    .find((e: any) => e.documentId === documentId);

  // Text preview (first 500 words)
  const fullText = content?.extracted_text || '';
  const words = fullText.split(/\s+/);
  const textPreview = words.slice(0, 500).join(' ');
  const hasMore = words.length > 500;

  return NextResponse.json({
    success: true,
    document: {
      id: document.id,
      fileName: document.file_name,
      writingType: document.writing_type,
      wordCount: document.word_count,
      fileSize: document.file_size,
      mimeType: document.mime_type,
      status: document.status,
      learnedAt: document.learned_at,
      createdAt: document.created_at,
    },
    fingerprint: document.document_fingerprint,
    impact: evolutionEntry || null,
    textPreview: {
      text: textPreview,
      totalWords: words.length,
      hasMore,
    },
  });
}
```

---

## TASK 2: Voice Evolution Timeline Component

Location: `src/components/mirror-mode/VoiceEvolutionTimeline.tsx`

### Requirements:
- **Collapsed state (default):** Quick stats bar showing:
  - Current confidence with small visual indicator
  - Documents count
  - "View Timeline" expand button
- **Expanded state:** 
  - Line graph (confidence over time)
  - X-axis: timestamps
  - Y-axis: confidence 0-100
  - Horizontal milestone lines at 25%, 45%, 65%, 85%
  - Event feed below graph showing document entries
  - Clicking an event/point opens Document Detail Modal

### Component structure:

```typescript
'use client';

import { useState } from 'react';

type VoiceEvolution = {
  timestamp: string;
  documentId: string;
  documentName: string;
  writingType: string;
  changesMade: string[];
  confidenceDelta: number;
  confidenceLevel: number;
  totalWordCount: number;
  totalDocuments: number;
};

type Props = {
  currentConfidence: number;
  documentCount: number;
  totalWords: number;
  evolutionHistory: VoiceEvolution[];
  onDocumentClick: (documentId: string) => void;
};

export default function VoiceEvolutionTimeline({
  currentConfidence,
  documentCount,
  totalWords,
  evolutionHistory,
  onDocumentClick,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Collapsed quick stats
  // Expanded: graph + event feed
  // Use inline styles matching existing dark theme
}
```

### Graph implementation:
- Use a simple SVG-based line graph (no external libraries)
- Or use Recharts if already in the project
- Plot confidenceLevel (Y) vs timestamp (X)
- Add clickable points

### Event feed:
- List of evolution entries
- Show: date, document name, writing type icon, confidence change (+X%)
- Show changesMade as tags (e.g., "formality shift", "vocabulary expanded")
- Clickable to open Document Detail Modal

### Styling:
- Match existing dark theme variables:
  ```css
  --mm-bg: #0a0a0f;
  --mm-surface: rgba(255, 255, 255, 0.03);
  --mm-border: rgba(255, 255, 255, 0.08);
  --mm-text: #f0f0f5;
  --mm-text-muted: rgba(240, 240, 245, 0.6);
  --mm-accent: #06b6d4;
  --mm-purple: #8b5cf6;
  ```

---

## TASK 3: Document Detail Modal

Location: `src/components/mirror-mode/DocumentDetailModal.tsx`

### Requirements:
- Full-screen modal overlay
- Close button (X) and click-outside-to-close
- Sections:
  1. **Header:** Document name, type badge, upload date
  2. **Metadata:** Word count, file size, status (learned/pending)
  3. **Fingerprint Analysis:** Visual breakdown of what was detected
     - Tone (formal/casual meter)
     - Sentence length (short/medium/long)
     - Vocabulary (simple/sophisticated)
     - Style traits (confident, personal, hedging, etc.)
  4. **Impact on Profile:** The evolution entry for this doc
     - Confidence change (+X%)
     - What shifted (tags)
  5. **Text Preview:** Collapsible section with first 500 words
     - "Show more" if truncated

### Component structure:

```typescript
'use client';

import { useState, useEffect } from 'react';

type Props = {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function DocumentDetailModal({ documentId, isOpen, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [showFullText, setShowFullText] = useState(false);

  useEffect(() => {
    if (isOpen && documentId) {
      fetchDocumentDetail(documentId);
    }
  }, [isOpen, documentId]);

  const fetchDocumentDetail = async (id: string) => {
    setLoading(true);
    const res = await fetch(`/api/mirror-mode/document/${id}/detail`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  if (!isOpen) return null;

  // Modal overlay with sections
}
```

### Fingerprint visualization:
For each fingerprint category, show visual meters/indicators:

```typescript
// Example: Formality meter
<div className="mm-meter">
  <span className="mm-meter-label">Tone</span>
  <div className="mm-meter-track">
    <div 
      className="mm-meter-fill" 
      style={{ width: `${fingerprint.voice.formalityScore * 100}%` }}
    />
  </div>
  <span className="mm-meter-value">
    {fingerprint.voice.formalityScore > 0.65 ? 'Formal' : 
     fingerprint.voice.formalityScore < 0.35 ? 'Casual' : 'Balanced'}
  </span>
</div>
```

---

## TASK 4: Get Started Modal Tour

Location: `src/components/mirror-mode/OnboardingTour.tsx`

### Requirements:
- Modal overlay that appears for first-time users (no documents yet)
- Multi-step tour (4-5 steps)
- Progress indicator (dots or "Step X of Y")
- "Skip" and "Next" buttons
- Persists dismissal in localStorage or user settings

### Steps:

**Step 1: Welcome**
- Title: "Welcome to Mirror Mode"
- Subtitle: "Meet Ursie, your voice learning companion"
- Icon/illustration: Ursie mascot or cosmic mirror visual
- Body: "Mirror Mode learns YOUR unique writing style from documents you upload. No more generic AI - ThinkWrite will sound like you."

**Step 2: How It Works**
- Title: "How Voice Learning Works"
- Visual: Simple 3-part diagram
  1. Upload documents → 2. Ursie analyzes patterns → 3. Your voice is captured
- Body: "Upload samples of your writing - emails, essays, reports, anything. The more variety, the better Ursie understands you."

**Step 3: What to Upload**
- Title: "What Should You Upload?"
- List with icons:
  - 💼 Professional: Work emails, reports, LinkedIn posts
  - 📚 Academic: Essays, research papers, assignments
  - ✨ Creative: Stories, blogs, personal writing
  - 💬 Casual: Messages, social posts, informal notes
- Body: "Mix different types for a complete voice profile. Aim for 3-5 documents with 50+ words each."

**Step 4: Confidence Levels**
- Title: "Building Your Voice"
- Visual: Confidence meter with milestones
  - 0-24%: Initializing
  - 25-44%: Learning
  - 45-64%: Developing
  - 65-84%: Confident
  - 85-100%: Mastered
- Body: "As you upload more documents, your confidence grows. At 65%+, your voice is ready for use across all ThinkWrite studios."

**Step 5: Get Started**
- Title: "Ready to Begin?"
- CTA button: "Upload Your First Document"
- Secondary: "I'll explore first" (dismisses tour)

### Component structure:

```typescript
'use client';

import { useState, useEffect } from 'react';

type Props = {
  isFirstTime: boolean;
  onComplete: () => void;
  onUploadClick: () => void;
};

export default function OnboardingTour({ isFirstTime, onComplete, onUploadClick }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has dismissed tour before
    const dismissed = localStorage.getItem('mm-tour-dismissed');
    if (isFirstTime && !dismissed) {
      setIsVisible(true);
    }
  }, [isFirstTime]);

  const handleDismiss = () => {
    localStorage.setItem('mm-tour-dismissed', 'true');
    setIsVisible(false);
    onComplete();
  };

  const steps = [/* step content */];

  if (!isVisible) return null;

  // Modal with step content, progress dots, navigation
}
```

---

## TASK 5: Progress Indicators & Success States

### 5.1 First-time user progress

Location: Add to `MirrorModeDashboard.tsx`

When user has < 3 documents, show progress steps:

```typescript
// Progress steps component
const ProgressSteps = ({ documentCount }: { documentCount: number }) => {
  const steps = [
    { label: 'Upload first document', complete: documentCount >= 1 },
    { label: 'Add a second sample', complete: documentCount >= 2 },
    { label: 'Include variety', complete: documentCount >= 3 },
  ];

  return (
    <div className="mm-progress-steps">
      {steps.map((step, i) => (
        <div key={i} className={`mm-step ${step.complete ? 'mm-complete' : ''}`}>
          <span className="mm-step-indicator">
            {step.complete ? '✓' : i + 1}
          </span>
          <span className="mm-step-label">{step.label}</span>
        </div>
      ))}
    </div>
  );
};
```

### 5.2 Upload success message

After successful upload, show inline success state (not modal):

```typescript
// In upload zone, after success
{uploadSuccess && (
  <div className="mm-success-banner">
    <span className="mm-success-icon">✓</span>
    <div className="mm-success-content">
      <strong>{uploadSuccess.fileName}</strong> added to your voice profile
      <span className="mm-success-detail">
        +{uploadSuccess.confidenceGain}% confidence
      </span>
    </div>
  </div>
)}
```

### 5.3 Variety nudge

When user has 3+ documents of same type, show suggestion:

```typescript
// Check document variety
const getVarietyNudge = (documents: any[]) => {
  const types = documents.map(d => d.writingType);
  const typeCounts = types.reduce((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const dominantType = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])[0];

  if (dominantType && dominantType[1] >= 3 && Object.keys(typeCounts).length < 2) {
    const suggestions: Record<string, string> = {
      professional: 'Try adding a creative or personal sample',
      academic: 'Try adding a professional email or casual post',
      creative: 'Try adding a professional or academic piece',
      personal: 'Try adding a professional or academic sample',
    };
    return suggestions[dominantType[0]] || 'Try adding different types of writing';
  }
  return null;
};
```

---

## TASK 6: Integrate Into Dashboard

Location: `src/components/mirror-mode/MirrorModeDashboard.tsx`

### Updates needed:

1. **Import new components:**
```typescript
import VoiceEvolutionTimeline from './VoiceEvolutionTimeline';
import DocumentDetailModal from './DocumentDetailModal';
import OnboardingTour from './OnboardingTour';
```

2. **Add state for modals:**
```typescript
const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
const [showDocumentDetail, setShowDocumentDetail] = useState(false);
```

3. **Add timeline section** (after confidence card or as part of it):
```typescript
<VoiceEvolutionTimeline
  currentConfidence={confidenceLevel}
  documentCount={overview?.documentCount || 0}
  totalWords={overview?.totalWordCount || 0}
  evolutionHistory={status?.recentEvolution || []}
  onDocumentClick={(id) => {
    setSelectedDocumentId(id);
    setShowDocumentDetail(true);
  }}
/>
```

4. **Add document detail modal:**
```typescript
<DocumentDetailModal
  documentId={selectedDocumentId || ''}
  isOpen={showDocumentDetail}
  onClose={() => {
    setShowDocumentDetail(false);
    setSelectedDocumentId(null);
  }}
/>
```

5. **Add onboarding tour:**
```typescript
<OnboardingTour
  isFirstTime={!overview?.hasProfile || overview.documentCount === 0}
  onComplete={() => {}}
  onUploadClick={() => fileInputRef.current?.click()}
/>
```

6. **Update API call to include full evolution history:**
The `/api/mirror-mode/voice/status` endpoint already returns `recentEvolution`. Update it to return full history when needed, or create a separate endpoint.

---

## TASK 7: Update Status API for Full Evolution

Location: `src/app/api/mirror-mode/voice/status/route.ts`

Add query parameter to return full evolution history:

```typescript
// Add to GET handler
const includeFullHistory = searchParams.get('fullHistory') === 'true';

// In response, replace recentEvolution logic:
const evolutionHistory = profile.evolution_history || [];
const evolutionData = includeFullHistory 
  ? evolutionHistory 
  : evolutionHistory.slice(-10).reverse();

// Return as:
evolutionHistory: evolutionData,
```

---

## File Checklist

New files to create:
- [ ] `src/components/mirror-mode/VoiceEvolutionTimeline.tsx`
- [ ] `src/components/mirror-mode/DocumentDetailModal.tsx`
- [ ] `src/components/mirror-mode/OnboardingTour.tsx`
- [ ] `src/app/api/mirror-mode/document/[id]/detail/route.ts`

Files to update:
- [ ] `src/lib/mirror-mode/voiceAggregation.ts` - Enrich VoiceEvolution type
- [ ] `src/app/api/mirror-mode/documents/upload/route.ts` - Store per-doc fingerprint
- [ ] `src/app/api/mirror-mode/voice/status/route.ts` - Full evolution option
- [ ] `src/components/mirror-mode/MirrorModeDashboard.tsx` - Integrate components

Database:
- [ ] Add `document_fingerprint JSONB` column to `mirror_documents`

---

## Styling Guidelines

Use existing CSS variables from MirrorModeDashboard:

```css
--mm-bg: #0a0a0f;
--mm-surface: rgba(255, 255, 255, 0.03);
--mm-surface-hover: rgba(255, 255, 255, 0.06);
--mm-border: rgba(255, 255, 255, 0.08);
--mm-text: #f0f0f5;
--mm-text-muted: rgba(240, 240, 245, 0.6);
--mm-accent: #06b6d4;
--mm-accent-glow: rgba(6, 182, 212, 0.3);
--mm-purple: #8b5cf6;
--mm-success: #10b981;
--mm-error: #ef4444;
```

Use inline styles with `<style jsx>` tags to match existing pattern.

---

## Testing Checklist

1. Upload a new document → verify fingerprint stored in mirror_documents
2. Check evolution_history has enriched data (documentName, confidenceLevel, etc.)
3. Timeline collapsed shows quick stats
4. Timeline expanded shows graph with correct data points
5. Click timeline event → Document Detail Modal opens
6. Document Detail shows fingerprint analysis, impact, text preview
7. First-time user sees Onboarding Tour
8. Tour can be dismissed and doesn't reappear
9. Progress steps show correctly for < 3 documents
10. Variety nudge appears when 3+ docs of same type
11. Success message shows after upload with confidence gain

---

## Notes

- Keep everything compact on one page with split views
- Modal overlays for detail views and onboarding
- Simple success messages (no confetti/animations that could cause issues)
- Match existing dark cosmic theme throughout
- Prioritize performance - don't load full text unless user expands preview
