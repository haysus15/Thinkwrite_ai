# Career Studio Architecture Summary
## For Consolidation Discussion with Claude

---

## Current Structure Overview

### Pages/Routes (7 separate pages)
| Route | Purpose |
|-------|---------|
| `/career-studio` | Landing page with THREE.js cosmic design |
| `/career-studio/dashboard` | Main hub with Orb metrics, Lex sidebar, quick actions |
| `/career-studio/resume-manager` | Upload & manage resume versions |
| `/career-studio/resume-builder` | Build resume from scratch with Lex |
| `/career-studio/tailor-resume` | Align resume to specific job postings |
| `/career-studio/cover-letter` | Generate cover letters with Lex |
| `/career-studio/assessment` | 4-phase career assessment (20 min conversation) |
| `/career-studio/applications` | Track job applications with ATS scores |
| `/career-studio/lex` | Router to 6 Lex context modes |

### Lex AI Modes (6 context-aware modes)
1. **GeneralLex** - General career coaching (dashboard default)
2. **CareerAssessmentLex** - Strict assessment-only mode
3. **ResumeTailoringLex** - Resume strategy discussions
4. **CoverLetterLex** - Cover letter strategy/writing
5. **JobAnalysisLex** - Job posting discussions
6. **MatchAnalysisLex** - Resume-job match analysis

Each mode has **strict boundaries** - Lex redirects users if they ask out-of-scope questions.

---

## Key Components

### Dashboard Components
- `CareerStudioDashboard.tsx` (1480+ lines) - Main hub with:
  - LexSidebar (always visible)
  - HeroSection with Orb metric visualization
  - ControlCenter (3 views: overview/opportunities/progress)
  - Quick action buttons to all tools

### Lex Components (`/src/components/lex/`)
- **Contexts**: 6 mode-specific Lex implementations
- **Shared**: LexMessage, LexInput, LexHeader, TypingIndicator
- **Hooks**: useLexContext, useLexConversation, useResumeContext, useJobContext

### Career-Specific Components
- `ResumeBuilderInterface.tsx`
- `ResumeManager.tsx`
- `TailorResumeInterface.tsx`
- `CoverLetterGenerator.tsx`
- `CareerAssessmentInterface.tsx` (multi-phase UI)
- `JobAnalysisInterface.tsx`

---

## API Routes

### Main Lex Endpoint
`POST /api/lex/chat` (1250+ lines)
- Session-based routing with 6 modes
- Memory context injection (documents, career context, history)
- **Mirror Mode integration**: Calls `learnFromTextDirect()` on user messages

### Career Assessment
```
POST /api/career-assessment → Save assessment
GET  /api/career-assessment → Get latest
POST /api/career-assessment/generate-plan → Convert conversation → CareerRoadmap
```

### Resume Management
```
GET/POST /api/resumes → List/upload resumes
POST /api/resumes/[id]/master → Set master resume
POST /api/resumes/[id]/lex-analysis → Trigger Lex analysis
```

### Job Analysis & Tailoring
```
POST /api/job-analysis → Parse job posting
POST /api/resume-job-match → Calculate match %
POST /api/tailored-resume → Generate tailored version
```

### Mirror Mode
```
GET  /api/mirror-mode/voice/profile → Get voice fingerprint
POST /api/mirror-mode/voice/learn → Train on document
POST /api/mirror-mode/live-learn → Learn from chat
POST /api/mirror-mode/voice/generate → Generate in learned voice
```

---

## Core Libraries

### ATS Scoring (`/src/lib/career-studio/atsScoring.ts`)
- 4-factor scoring: Keywords (40), Formatting (20), Content (25), Action Verbs (15)
- A-F grades, 60+ threshold to pass

### Voice Analysis (`/src/lib/mirror-mode/voiceAnalysis.ts`)
- Extracts **120+ metrics** from user writing:
  - Vocabulary (word complexity, contractions, rare words)
  - Rhythm (sentence/paragraph length variation)
  - Punctuation habits
  - Voice (formality, assertiveness, pronoun usage)
  - Rhetoric patterns

### Lex Personality (`/src/lib/lex/personalityEngine.ts`)
- 30-year-old HR professional persona
- 15+ years experience
- Direct, honest tone
- Clear expertise boundaries

---

## Current Workflow

### Assessment Flow
1. User starts assessment (4 phases)
2. Lex guides 20-minute career conversation
3. Conversation → Claude API → CareerRoadmap
4. Roadmap saved with action items, gap analysis, job targets

### Job Application Flow
1. User pastes job posting → Job Analysis
2. Job analyzed for ATS keywords, red flags, insights
3. User clicks "Tailor" → Resume tailoring interface
4. Changes tracked (accept/reject each suggestion)
5. User clicks "Cover Letter" → Letter generator
6. Letter uses Mirror Mode voice profile if available

---

## Mirror Mode Integration Points

### Current Integration
1. **Lex Chat**: Every user message calls `learnFromTextDirect()`
2. **Voice Status**: Dashboard shows confidence % in LexSidebar
3. **Cover Letters**: Can use learned voice for generation
4. **Document Upload**: Mirror Mode has separate document learning

### Potential Enhancement Points
- Resume Builder: Learn from user's resume writing style
- Assessment: Learn from how user describes their goals
- Applications: Learn from custom notes/follow-ups

---

## Consolidation Considerations

### What's Currently Separated
- 7+ distinct page routes
- 6 Lex mode implementations (each with boundaries)
- Separate state management per feature
- Context switching between tools loses conversation state

### What Should Stay Connected
- Lex as central AI (already routes to modes)
- Profile/Assessment as context provider
- Document storage (resumes, jobs, letters)
- Mirror Mode voice learning across all tools

### Possible Consolidation Approaches

**Option A: Single Page with Dynamic Workspace**
```
Career Studio (One Page)
├── Lex Sidebar (always visible, profile-aware)
├── Center: Dynamic Workspace (switches based on task)
│   └── Dashboard / Resume / Job Analysis / Tailor / Letter
└── Right: Quick Panel (documents, progress, profile)
```

**Option B: Dashboard + Modal Tools**
```
Dashboard (always loaded)
├── Lex Sidebar (persistent)
├── Main Content (metrics, opportunities)
└── Tools open as modals/panels (not new pages)
```

**Option C: Lex-First (Everything through conversation)**
```
Career Studio
├── Lex Interface (full screen)
├── Context panels appear based on conversation
└── "Show my resume" → Panel appears
└── "Analyze this job" → Analysis panel appears
```

---

## Database Tables (inferred from code)

- `career_assessments` - Assessment results + roadmaps
- `resumes` - User resume documents
- `job_analyses` - Analyzed job postings
- `tailored_resumes` - Tailored versions
- `cover_letters` - Generated letters
- `voice_profiles` - Mirror Mode fingerprints
- `mirror_documents` - Documents used for voice training
- `applications` - Job application tracking

---

## Questions for Consolidation

1. **Keep separate routes or single page with panels?**
2. **How should Lex mode switching work?** (automatic based on panel? explicit user choice?)
3. **Where should profile/assessment context live?** (sidebar? header? always in Lex prompt?)
4. **How deep should Mirror Mode integrate?** (all writing or just cover letters?)
5. **What happens to current URLs?** (redirects? keep for sharing?)

---

## Key Files to Review

### Pages
- `src/app/career-studio/dashboard/page.tsx`
- `src/app/career-studio/assessment/page.tsx`

### Components
- `src/components/career-studio/dashboard/CareerStudioDashboard.tsx`
- `src/components/lex/contexts/*.tsx` (all 6 modes)

### API
- `src/app/api/lex/chat/route.ts` (main Lex logic)
- `src/app/api/career-assessment/generate-plan/route.ts`

### Libraries
- `src/lib/mirror-mode/voiceAnalysis.ts`
- `src/lib/career-studio/atsScoring.ts`
