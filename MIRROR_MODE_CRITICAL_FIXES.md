# MIRROR MODE - CRITICAL FIXES

**Purpose:** Fix all critical issues found in verification to bring Mirror Mode to specification compliance.

**Instructions for Claude Code:**
1. Fix issues in EXACT priority order listed below
2. Test each fix before moving to next
3. Mark each item ✅ when complete
4. Do NOT skip ahead
5. Report progress after each section

---

## PRIORITY ORDER

**Fix in this exact sequence:**

1. **REMOVE ALL EMOJIS** (Critical - North Star violation)
2. **IMPLEMENT THREE.JS COSMIC PARTICLES** (Critical - Core design philosophy)
3. **ADD FILE VALIDATION** (Critical - Security & UX)
4. **FIX STORAGE CLEANUP** (Critical - Cost & data integrity)
5. **UPDATE WRITING TYPES TO SPEC** (Critical - Data integrity)
6. **RENAME API ROUTES TO SPEC** (Important - Consistency)
7. **ADD TOAST NOTIFICATIONS** (Important - UX feedback)
8. **SHOW FILE SIZE IN DOCUMENT LIST** (Important - User info)
9. **FIX SPEC MISMATCHES** (Polish - Alignment)

---

## FIX 1: REMOVE ALL EMOJIS ⚠️ CRITICAL

**Why Critical:** North Star explicitly states "NO EMOJIS ANYWHERE" - this is non-negotiable.

**Files to Fix:**

### A. WritingTypeSelector.tsx
- [ ] Remove ALL emoji icons from writing type options
- [ ] Replace with SVG icons or text-only labels
- [ ] Verify no emojis in labels, placeholders, or tooltips

**Current (WRONG):**
```typescript
const writingTypes = [
  { value: 'professional', label: '💼 Professional', icon: '💼' },
  { value: 'academic', label: '🎓 Academic', icon: '🎓' },
  // etc...
];
```

**Required (CORRECT):**
```typescript
const writingTypes = [
  { value: 'professional', label: 'Professional/Business' },
  { value: 'academic', label: 'Academic Writing' },
  { value: 'creative', label: 'Creative Writing' },
  { value: 'personal', label: 'Personal/Casual' },
  { value: 'technical', label: 'Technical Documentation' }
];
// NO icons property, NO emojis anywhere
```

---

### B. DocumentList.tsx
- [ ] Remove ALL emojis from writing type badges
- [ ] Remove emojis from any status indicators
- [ ] Use text labels or simple colored dots

**Replace emoji indicators with:**
- Color-coded badges (text only)
- Or simple colored dots + text label
- NO emoji characters

---

### C. OnboardingTour.tsx
- [ ] Remove ALL emojis from tour steps
- [ ] Remove: 🪞, 🧠, 📁, 📈, 🚀 and any others
- [ ] Use text-only descriptions

**Current Steps (WRONG):**
```typescript
{
  title: "🪞 Welcome to Mirror Mode",
  description: "Mirror Mode learns your unique writing style..."
}
```

**Required Steps (CORRECT):**
```typescript
{
  title: "Welcome to Mirror Mode",
  description: "Mirror Mode learns your unique writing style..."
}
// NO emojis in title, description, or anywhere
```

---

### D. VoiceEvolutionTimeline.tsx
- [ ] Remove emojis from writing type indicators on timeline
- [ ] Use color-coded dots or text labels

---

### E. MirrorModeDashboard.tsx
- [ ] Remove 💡 from variety nudge
- [ ] Remove any other emoji usage

**Find and replace:**
```typescript
// WRONG
"💡 Upload different types of writing..."

// CORRECT
"Upload different types of writing..."
```

---

### F. DocumentDetailModal.tsx
- [ ] Remove emojis from type config icons
- [ ] Use text labels only

---

### G. voice/status/route.ts (API responses)
- [ ] Remove emojis from voice highlights
- [ ] Return text-only descriptions

---

### H. Any Other Components
- [ ] Search entire codebase for emoji unicode ranges
- [ ] Remove ALL instances

**Search regex:**
```bash
# Search for emoji unicode ranges
grep -r '[\u{1F300}-\u{1F9FF}]' src/
grep -r '[\u{2600}-\u{26FF}]' src/
grep -r '[\u{2700}-\u{27BF}]' src/

# Search for common emojis
grep -r '💼\|🎓\|✨\|🪞\|🧠\|📁\|📈\|🚀\|💡' src/
```

---

**Test Criteria:**
- [ ] Search entire codebase - ZERO emojis found
- [ ] Visual inspection of all pages - ZERO emojis visible
- [ ] Check API responses - ZERO emojis in JSON

**When Complete:**
Report: "All emojis removed. Verified zero emoji characters in codebase."

---

## FIX 2: IMPLEMENT THREE.JS COSMIC PARTICLES ⚠️ CRITICAL

**Why Critical:** North Star requires "realistic cosmic sky using Three.js" - CSS gradients don't meet quality standards.

**Current State:** Uses CSS gradients/radials only
**Required State:** Three.js particle system with depth, variation, and realism

---

### A. Install Dependencies

```bash
npm install three @types/three
```

---

### B. Create CosmicBackground Component

**File:** `src/components/mirror-mode/CosmicBackground.tsx`

```typescript
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function CosmicBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const starsRef = useRef<THREE.Points>();
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    camera.position.z = 500;
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create star particles with realistic variation
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 3000;

    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const colors = new Float32Array(starCount * 3);

    // Realistic star colors
    const starColorPalette = [
      new THREE.Color(0xe8f4ff), // Cool white (most common)
      new THREE.Color(0xfff4e6), // Warm white
      new THREE.Color(0xcce6ff), // Blue giant
      new THREE.Color(0xffe6e6)  // Red dwarf (rare)
    ];

    for (let i = 0; i < starCount; i++) {
      // Position with depth variation
      positions[i * 3] = (Math.random() - 0.5) * 2000;     // x
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2000; // y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2000; // z (depth)

      // Size variation (0.5 to 3.0)
      sizes[i] = Math.random() * 2.5 + 0.5;

      // Color variation (mostly cool white, some warm/blue)
      const colorIndex = Math.random() < 0.85 ? 0 : Math.floor(Math.random() * starColorPalette.length);
      const color = starColorPalette[colorIndex];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Star material with realistic properties
    const starMaterial = new THREE.PointsMaterial({
      size: 2,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    starsRef.current = stars;

    // Mouse interaction for parallax
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX - window.innerWidth / 2) * 0.0005;
      mouseY = (event.clientY - window.innerHeight / 2) * 0.0005;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      if (starsRef.current) {
        // Slow rotation
        starsRef.current.rotation.y += 0.0002;
        
        // Parallax effect
        starsRef.current.rotation.x += (mouseY - starsRef.current.rotation.x) * 0.05;
        starsRef.current.rotation.y += (mouseX - starsRef.current.rotation.y) * 0.05;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      starGeometry.dispose();
      starMaterial.dispose();
      rendererRef.current?.dispose();
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 -z-10"
      style={{ background: 'linear-gradient(to bottom, #0a0e1f 0%, #121829 50%, #1a2438 100%)' }}
    />
  );
}
```

---

### C. Replace CSS Background

**File:** `src/app/mirror-mode/page.tsx` (or wherever MirrorModeDashboard is used)

**Remove:**
- All CSS gradient backgrounds
- CSS star layers
- Radial gradients

**Add:**
```typescript
import { CosmicBackground } from '@/components/mirror-mode/CosmicBackground';

export default function MirrorModePage() {
  return (
    <>
      <CosmicBackground />
      <MirrorModeDashboard />
    </>
  );
}
```

---

### D. Remove CSS Star Styles

**Find and remove:**
- `.stars-layer` classes
- CSS keyframe animations for stars
- Any CSS-based particle systems

---

**Test Criteria:**
- [ ] Three.js canvas renders on page load
- [ ] Stars have varied brightness (dim to bright)
- [ ] Stars have varied sizes (small to large)
- [ ] Depth perception visible (near/far stars)
- [ ] Mouse parallax effect works
- [ ] Smooth 60fps animation
- [ ] No CSS gradient stars visible
- [ ] Realistic night sky colors (deep indigos, not bright purples)

**When Complete:**
Report: "Three.js cosmic particles implemented. Realistic sky with depth, variation, and mouse interaction verified."

---

## FIX 3: ADD FILE VALIDATION ⚠️ CRITICAL

**Why Critical:** Security risk (users can upload anything) and UX issue (no feedback before upload fails).

---

### A. Client-Side Validation

**File:** `src/components/mirror-mode/MirrorModeDashboard.tsx`

**Add validation function:**
```typescript
const validateFile = (file: File): { valid: boolean; error?: string } => {
  // Check file size (10MB = 10,485,760 bytes)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: 'File size exceeds 10MB limit.'
    };
  }

  // Check file type
  const validTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  const validExtensions = ['.pdf', '.docx', '.txt'];
  const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  
  if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: 'Only PDF, DOCX, and TXT files are supported.'
    };
  }

  return { valid: true };
};
```

**Update handleFileSelect:**
```typescript
const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  // Validate file
  const validation = validateFile(file);
  if (!validation.valid) {
    setError(validation.error);
    setSelectedFile(null);
    // Show toast notification (see Fix 7)
    toast.error(validation.error);
    return;
  }

  // Show file info
  setSelectedFile(file);
  setFileSize((file.size / (1024 * 1024)).toFixed(2)); // Convert to MB
  setError(null);
};
```

---

### B. Display File Information

**Add state:**
```typescript
const [fileSize, setFileSize] = useState<string>('');
```

**Update UI to show file info BEFORE upload:**
```typescript
{selectedFile && (
  <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
    <p className="text-sm text-gray-300">
      <span className="font-medium">{selectedFile.name}</span>
      <span className="ml-2 text-gray-400">({fileSize} MB)</span>
    </p>
  </div>
)}
```

---

### C. Server-Side Validation

**File:** `src/app/api/mirror-mode/upload/route.ts`

**Add validation at start of POST handler:**
```typescript
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit.' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (!validTypes.includes(file.type)) {
      const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      if (!['.pdf', '.docx', '.txt'].includes(extension)) {
        return NextResponse.json(
          { error: 'Only PDF, DOCX, and TXT files are supported.' },
          { status: 400 }
        );
      }
    }

    // Continue with existing upload logic...
  }
}
```

---

**Test Criteria:**
- [ ] Upload file > 10MB → Shows error: "File size exceeds 10MB limit."
- [ ] Upload .exe file → Shows error: "Only PDF, DOCX, and TXT files are supported."
- [ ] Upload .zip file → Shows error: "Only PDF, DOCX, and TXT files are supported."
- [ ] Upload valid file → Shows file name and size before upload
- [ ] File size displays in MB with 2 decimal places
- [ ] Server also validates (doesn't rely on client only)

**When Complete:**
Report: "File validation implemented. Client and server-side checks verified for size and type."

---

## FIX 4: FIX STORAGE CLEANUP ⚠️ CRITICAL

**Why Critical:** Orphaned files accumulate in storage, wasting money and violating data integrity.

**Current Issue:** Only DB records deleted, files remain in Supabase storage.

---

### A. Update Delete Document API

**File:** `src/app/api/mirror-mode/document/[id]/route.ts`

**Current (WRONG):**
```typescript
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  // Only deletes DB record
  const { error } = await supabase
    .from('mirror_documents')
    .delete()
    .eq('id', params.id);
}
```

**Required (CORRECT):**
```typescript
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get document to find storage path
    const { data: document, error: fetchError } = await supabase
      .from('mirror_documents')
      .select('file_path, user_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Verify ownership
    if (document.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete from storage bucket FIRST
    if (document.file_path) {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([document.file_path]);

      if (storageError) {
        console.error('Storage deletion failed:', storageError);
        // Continue anyway - don't block DB deletion
      }
    }

    // Delete DB record
    const { error: deleteError } = await supabase
      .from('mirror_documents')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      );
    }

    // Recalculate voice profile
    await recalculateVoiceProfile(user.id);

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
```

---

### B. Update Reset Profile API

**File:** `src/app/api/mirror-mode/reset/route.ts`

**Add storage cleanup:**
```typescript
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all user documents to find storage paths
    const { data: documents, error: fetchError } = await supabase
      .from('mirror_documents')
      .select('file_path')
      .eq('user_id', user.id);

    if (!fetchError && documents && documents.length > 0) {
      // Delete all files from storage
      const filePaths = documents
        .map(doc => doc.file_path)
        .filter(Boolean);

      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove(filePaths);

        if (storageError) {
          console.error('Storage cleanup failed:', storageError);
          // Continue anyway
        }
      }
    }

    // Delete all document records
    const { error: deleteError } = await supabase
      .from('mirror_documents')
      .delete()
      .eq('user_id', user.id);

    // Reset voice profile
    const { error: profileError } = await supabase
      .from('voice_profiles')
      .update({
        aggregate_fingerprint: null,
        confidence_level: 0,
        document_count: 0,
        evolution_history: [],
        last_updated: new Date().toISOString()
      })
      .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      message: 'Voice profile reset successfully'
    });

  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset profile' },
      { status: 500 }
    );
  }
}
```

---

**Test Criteria:**
- [ ] Delete document → File removed from Supabase storage bucket
- [ ] Delete document → DB record removed
- [ ] Reset profile → ALL files removed from storage
- [ ] Reset profile → ALL DB records removed
- [ ] Verify in Supabase dashboard: storage bucket cleaned

**When Complete:**
Report: "Storage cleanup implemented. Verified files deleted from storage bucket on delete and reset."

---

## FIX 5: UPDATE WRITING TYPES TO SPEC ⚠️ CRITICAL

**Why Critical:** Data integrity - need correct categories matching specification.

**Current:** Professional, Academic, Creative, Personal, Casual
**Spec:** Academic Writing, Professional/Business, Creative Writing, Personal/Casual, Technical Documentation

---

### A. Update Type Definitions

**File:** `src/types/mirror-mode.ts` (or wherever types are defined)

```typescript
export type WritingType = 
  | 'academic'
  | 'professional'
  | 'creative'
  | 'personal'
  | 'technical';

export const WRITING_TYPES = [
  { value: 'academic', label: 'Academic Writing' },
  { value: 'professional', label: 'Professional/Business' },
  { value: 'creative', label: 'Creative Writing' },
  { value: 'personal', label: 'Personal/Casual' },
  { value: 'technical', label: 'Technical Documentation' }
] as const;
```

---

### B. Update WritingTypeSelector Component

**File:** `src/components/mirror-mode/WritingTypeSelector.tsx`

```typescript
import { WRITING_TYPES } from '@/types/mirror-mode';

export function WritingTypeSelector({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as WritingType)}
      className="..."
      required
    >
      <option value="" disabled>Select writing type</option>
      {WRITING_TYPES.map(type => (
        <option key={type.value} value={type.value}>
          {type.label}
        </option>
      ))}
    </select>
  );
}
```

---

### C. Make Writing Type Required

**File:** `src/components/mirror-mode/MirrorModeDashboard.tsx`

**Remove default value:**
```typescript
// WRONG
const [writingType, setWritingType] = useState<WritingType>('professional');

// CORRECT
const [writingType, setWritingType] = useState<WritingType | ''>('');
```

**Add validation:**
```typescript
const handleUpload = async () => {
  if (!selectedFile) return;
  
  if (!writingType) {
    setError('Please select a writing type before uploading.');
    toast.error('Please select a writing type before uploading.');
    return;
  }

  // Continue with upload...
};
```

---

### D. Update Color Coding

**File:** `src/components/mirror-mode/DocumentList.tsx`

**Define color mapping:**
```typescript
const WRITING_TYPE_COLORS: Record<WritingType, string> = {
  academic: '#2563eb',      // Blue
  professional: '#f59e0b',  // Gold
  creative: '#9333ea',      // Purple
  personal: '#10b981',      // Green
  technical: '#6b7280'      // Gray
};

const WRITING_TYPE_LABELS: Record<WritingType, string> = {
  academic: 'Academic Writing',
  professional: 'Professional/Business',
  creative: 'Creative Writing',
  personal: 'Personal/Casual',
  technical: 'Technical Documentation'
};
```

**Use in badge:**
```typescript
<span 
  className="px-2 py-1 rounded text-xs font-medium"
  style={{ 
    backgroundColor: WRITING_TYPE_COLORS[doc.writing_type] + '20',
    color: WRITING_TYPE_COLORS[doc.writing_type]
  }}
>
  {WRITING_TYPE_LABELS[doc.writing_type]}
</span>
```

---

### E. Database Migration (if needed)

**If stored values need updating:**
```sql
-- Update existing records to new values
UPDATE mirror_documents 
SET writing_type = 'personal' 
WHERE writing_type = 'casual';

-- Add technical type if missing
-- (New documents will use it going forward)
```

---

**Test Criteria:**
- [ ] Writing type selector shows all 5 options with correct labels
- [ ] "Technical Documentation" option exists
- [ ] Labels display as: "Academic Writing", "Professional/Business", etc.
- [ ] Selection is REQUIRED - cannot upload without choosing
- [ ] Error shown if upload attempted without selection
- [ ] Color-coded badges show correct colors
- [ ] Database stores correct values

**When Complete:**
Report: "Writing types updated to spec. All 5 types with correct labels verified."

---

## FIX 6: RENAME API ROUTES TO SPEC

**Why Important:** Consistency and maintainability.

**Current Routes:** `/documents/upload`, `/document/[id]`, `/voice/profile`, etc.
**Spec Routes:** `/api/mirror-mode/*`

---

### A. Create New Route Structure

**Create these new files:**

1. `src/app/api/mirror-mode/upload/route.ts`
   - Move content from `/documents/upload/route.ts`

2. `src/app/api/mirror-mode/documents/route.ts`
   - GET handler for document list

3. `src/app/api/mirror-mode/documents/[id]/route.ts`
   - Move content from `/document/[id]/route.ts`

4. `src/app/api/mirror-mode/voice-profile/route.ts`
   - Move content from `/voice/profile/route.ts`

5. `src/app/api/mirror-mode/reset-profile/route.ts`
   - Move content from `/reset/route.ts`
   - Change from POST to DELETE method

---

### B. Update Frontend API Calls

**File:** `src/hooks/useMirrorMode.ts` (or wherever API calls are made)

**Find and replace:**
```typescript
// OLD
fetch('/api/documents/upload')
fetch('/api/document/' + id)
fetch('/api/voice/profile')
fetch('/api/reset')

// NEW
fetch('/api/mirror-mode/upload')
fetch('/api/mirror-mode/documents/' + id)
fetch('/api/mirror-mode/voice-profile')
fetch('/api/mirror-mode/reset-profile')
```

---

### C. Update Reset Profile to DELETE Method

**File:** `src/app/api/mirror-mode/reset-profile/route.ts`

**Change from POST to DELETE:**
```typescript
// Require confirmation in body
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    
    if (body.confirmation !== 'RESET') {
      return NextResponse.json(
        { error: 'Please type RESET to confirm.' },
        { status: 400 }
      );
    }

    // Continue with reset logic...
  }
}
```

**Update frontend reset call:**
```typescript
const response = await fetch('/api/mirror-mode/reset-profile', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ confirmation: 'RESET' })
});
```

---

### D. Delete Old Route Files

**After verifying new routes work, delete:**
- `src/app/api/documents/upload/route.ts`
- `src/app/api/document/[id]/route.ts`
- `src/app/api/voice/profile/route.ts`
- `src/app/api/reset/route.ts`

---

**Test Criteria:**
- [ ] All API calls use `/api/mirror-mode/*` paths
- [ ] Upload works with new route
- [ ] Document list fetches from new route
- [ ] Delete works with new route
- [ ] Voice profile fetches from new route
- [ ] Reset works with DELETE method and confirmation
- [ ] Old route files deleted

**When Complete:**
Report: "API routes renamed to spec. All endpoints under /api/mirror-mode/ verified."

---

## FIX 7: ADD TOAST NOTIFICATIONS

**Why Important:** User feedback for all actions.

---

### A. Install Toast Library

```bash
npm install react-hot-toast
```

---

### B. Add Toast Provider

**File:** `src/app/layout.tsx` or `src/app/mirror-mode/layout.tsx`

```typescript
import { Toaster } from 'react-hot-toast';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1a2438',
            color: '#e8f4ff',
            border: '1px solid rgba(232, 244, 255, 0.1)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#1a2438',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#1a2438',
            },
          },
        }}
      />
    </>
  );
}
```

---

### C. Add Toasts to All Actions

**File:** `src/components/mirror-mode/MirrorModeDashboard.tsx`

```typescript
import toast from 'react-hot-toast';

// Upload success
const handleUpload = async () => {
  try {
    // ... upload logic
    toast.success(`${selectedFile.name} uploaded successfully`);
  } catch (error) {
    toast.error('Upload failed. Please try again.');
  }
};

// Upload errors (from validation)
if (file.size > MAX_SIZE) {
  toast.error('File size exceeds 10MB limit.');
  return;
}

if (!validType) {
  toast.error('Only PDF, DOCX, and TXT files are supported.');
  return;
}

if (!writingType) {
  toast.error('Please select a writing type before uploading.');
  return;
}
```

---

**File:** `src/components/mirror-mode/DocumentList.tsx`

```typescript
import toast from 'react-hot-toast';

// Delete success
const handleDelete = async (id: string, filename: string) => {
  try {
    // ... delete logic
    toast.success(`${filename} has been deleted.`);
  } catch (error) {
    toast.error('Failed to delete document. Please try again.');
  }
};
```

---

**File:** `src/components/mirror-mode/ResetVoice.tsx`

```typescript
import toast from 'react-hot-toast';

// Reset success
const handleReset = async () => {
  try {
    // ... reset logic
    toast.success('Your voice profile has been reset.');
  } catch (error) {
    toast.error('Reset failed. Please try again.');
  }
};

// Reset validation
if (confirmation !== 'RESET') {
  toast.error('Please type RESET to confirm.');
  return;
}
```

---

**Toast Messages (Exact Text):**

**Successes:**
- Upload: `"[filename] uploaded successfully"`
- Delete: `"[filename] has been deleted."`
- Reset: `"Your voice profile has been reset."`

**Errors:**
- File too large: `"File size exceeds 10MB limit."`
- Invalid type: `"Only PDF, DOCX, and TXT files are supported."`
- No writing type: `"Please select a writing type before uploading."`
- Upload failed: `"Upload failed. Please try again."`
- Delete failed: `"Failed to delete document. Please try again."`
- Reset confirmation: `"Please type RESET to confirm."`
- Reset failed: `"Reset failed. Please try again."`
- Network error: `"Connection error. Please check your internet and try again."`
- Server error: `"Something went wrong. Please try again later."`

---

**Test Criteria:**
- [ ] Upload success shows toast with filename
- [ ] Upload errors show appropriate toast
- [ ] Delete success shows toast with filename
- [ ] Delete error shows toast
- [ ] Reset success shows toast
- [ ] Reset validation shows toast
- [ ] All toasts auto-dismiss after 4 seconds
- [ ] Toast styling matches cosmic theme
- [ ] NO EMOJIS in any toast messages

**When Complete:**
Report: "Toast notifications added. All user actions provide feedback."

---

## FIX 8: SHOW FILE SIZE IN DOCUMENT LIST

**Why Important:** Users need to see file sizes at a glance.

---

### A. Add File Size to Database Query

**File:** `src/app/api/mirror-mode/voice/status/route.ts` (or wherever documents are fetched)

```typescript
const { data: documents } = await supabase
  .from('mirror_documents')
  .select('id, file_name, writing_type, created_at, file_size, word_count')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });
```

---

### B. Store File Size on Upload

**File:** `src/app/api/mirror-mode/upload/route.ts`

```typescript
// When inserting document
const { data: document, error: insertError } = await supabase
  .from('mirror_documents')
  .insert({
    user_id: user.id,
    file_name: file.name,
    file_path: filePath,
    file_size: file.size, // Store file size in bytes
    writing_type: writingType,
    // ... other fields
  })
  .select()
  .single();
```

---

### C. Display File Size in Document List

**File:** `src/components/mirror-mode/DocumentList.tsx`

**Add helper function:**
```typescript
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
```

**Update document row:**
```typescript
<div className="flex items-center justify-between">
  <div className="flex-1">
    <p className="text-sm font-medium text-gray-200">{doc.file_name}</p>
    <div className="flex items-center gap-3 mt-1">
      <span 
        className="px-2 py-1 rounded text-xs"
        style={{ 
          backgroundColor: WRITING_TYPE_COLORS[doc.writing_type] + '20',
          color: WRITING_TYPE_COLORS[doc.writing_type]
        }}
      >
        {WRITING_TYPE_LABELS[doc.writing_type]}
      </span>
      <span className="text-xs text-gray-400">
        {formatDate(doc.created_at)}
      </span>
      <span className="text-xs text-gray-400">
        {formatFileSize(doc.file_size)}
      </span>
    </div>
  </div>
  
  {/* Delete button */}
</div>
```

---

**Display Format:**
- Less than 1 KB: "### B"
- 1 KB to 1 MB: "###.## KB"
- 1 MB and above: "###.## MB"

**Examples:**
- 523 bytes → "523 B"
- 15,234 bytes → "14.88 KB"
- 5,242,880 bytes → "5.00 MB"

---

**Test Criteria:**
- [ ] File size displays in document list
- [ ] Format is correct (B, KB, or MB)
- [ ] Two decimal places for KB/MB
- [ ] File size stored in database on upload
- [ ] File size visible before upload (from Fix 3)

**When Complete:**
Report: "File size display added. Showing in document list with correct formatting."

---

## FIX 9: FIX SPEC MISMATCHES (POLISH)

**Lower priority fixes for full spec compliance.**

---

### A. Reset Button Text

**File:** `src/components/mirror-mode/ResetVoice.tsx`

```typescript
// Change button text
<button>Reset Voice Profile</button>
// Not: "Reset Voice"
```

---

### B. Reset Confirmation (Case Sensitive)

**File:** `src/components/mirror-mode/ResetVoice.tsx`

```typescript
// Must be exactly "RESET" (uppercase)
const isValid = confirmation === 'RESET'; // Not .toLowerCase()
```

---

### C. Empty State Message

**File:** `src/components/mirror-mode/DocumentList.tsx`

```typescript
const emptyStateMessage = "No documents uploaded yet. Upload your first document to begin building your voice profile.";
```

---

### D. Confidence Message

**File:** `src/components/mirror-mode/MirrorModeDashboard.tsx`

```typescript
{confidence < 70 && documentCount > 0 && (
  <p className="text-sm text-yellow-400">
    Upload more documents to improve voice accuracy
  </p>
)}
```

---

### E. Success/Error Message Exact Text

**Verify all messages match spec exactly:**

**Delete confirmation modal:**
```typescript
`Are you sure you want to delete ${filename}? This will remove it from your voice profile analysis.`
```

**Reset warning modal:**
```typescript
"This will permanently delete all uploaded documents and reset your voice profile. This action cannot be undone. Are you sure?"
```

---

**Test Criteria:**
- [ ] All button text matches spec
- [ ] All modal messages match spec word-for-word
- [ ] All error messages match spec exactly
- [ ] All success messages match spec exactly
- [ ] Case sensitivity enforced where specified

**When Complete:**
Report: "All spec mismatches fixed. Text matches specification exactly."

---

## FINAL VERIFICATION

**After all fixes complete, run verification again:**

```bash
# Use original verification checklist
# Re-run all tests
```

**Expected Results:**
- Priority 1: 100% pass (was 58%)
- Priority 2: 95%+ pass (was 75%)
- North Star: 100% aligned (was 60%)

---

## COMPLETION CHECKLIST

Mark each section when complete:

- [ ] **FIX 1:** All emojis removed (CRITICAL)
- [ ] **FIX 2:** Three.js cosmic particles implemented (CRITICAL)
- [ ] **FIX 3:** File validation added (CRITICAL)
- [ ] **FIX 4:** Storage cleanup fixed (CRITICAL)
- [ ] **FIX 5:** Writing types updated to spec (CRITICAL)
- [ ] **FIX 6:** API routes renamed to spec
- [ ] **FIX 7:** Toast notifications added
- [ ] **FIX 8:** File size shown in document list
- [ ] **FIX 9:** Spec mismatches fixed

---

## REPORTING FORMAT

**After each fix, report:**

```
FIX [NUMBER] COMPLETE

What was fixed:
- [List changes made]

Tests performed:
- [List tests run]

Status: ✅ VERIFIED / ❌ ISSUES FOUND

Issues (if any):
- [List any problems]

Ready for next fix: YES / NO
```

---

**END OF CRITICAL FIXES DOCUMENT**
