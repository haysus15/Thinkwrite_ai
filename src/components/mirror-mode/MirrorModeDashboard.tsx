// src/components/mirror-mode/MirrorModeDashboard.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useVoiceStatus } from '@/hooks/useVoiceStatus';
import WritingTypeSelector from './WritingTypeSelector';
import { type WritingType } from '@/lib/mirror-mode/writingTypes';
import DocumentList, { MirrorDocument } from './DocumentList';
import ResetVoice from './ResetVoice';
import ModernVoiceGenerator from './ModernVoiceGenerator';
import LiveLearningFeed from './LiveLearningFeed';
import VoiceEvolutionTimeline from './VoiceEvolutionTimeline';
import DocumentDetailModal from './DocumentDetailModal';
import OnboardingTour from './OnboardingTour';
import dynamic from 'next/dynamic';
import styles from './MirrorModeDashboard.module.css';

const CosmicParticleBackground = dynamic(
  () => import('./CosmicParticleBackground'),
  { ssr: false }
);

type Props = {
  userId: string;
};

type UploadSuccessData = {
  fileName: string;
  confidenceGain: number;
  confidenceLevel: number;
  isFirstDocument: boolean;
};

export default function MirrorModeDashboard({ userId }: Props) {
  const { status, loading, error, refetch } = useVoiceStatus();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<UploadSuccessData | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [writingType, setWritingType] = useState<WritingType>('professional');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [showDocumentDetail, setShowDocumentDetail] = useState(false);

  const [selectedHub, setSelectedHub] = useState<'train' | 'generate' | 'samples' | null>(null);

  const [ursieMessages, setUrsieMessages] = useState<Array<{ id: string; sender: 'user' | 'ursie'; message: string; createdAt?: string }>>([]);
  const [ursieInput, setUrsieInput] = useState('');
  const [ursieThinking, setUrsieThinking] = useState(false);
  const [ursieSessionId, setUrsieSessionId] = useState<string | null>(null);
  const [ursieSavedCount, setUrsieSavedCount] = useState<number>(0);
  const [ursieIsSaved, setUrsieIsSaved] = useState<boolean>(false);
  const [ursieNotice, setUrsieNotice] = useState<string | null>(null);
  const [ursieMemoryPromptEnabled, setUrsieMemoryPromptEnabled] = useState(true);
  const [memoryCandidate, setMemoryCandidate] = useState('');
  const [memoryPromptPending, setMemoryPromptPending] = useState(false);
  const [memoryPromptNudge, setMemoryPromptNudge] = useState(false);
  const [manualMemoryInput, setManualMemoryInput] = useState('');
  const ursieChatRef = useRef<HTMLDivElement>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${formatFileSize(file.size)}). Maximum size is 10MB.`;
    }
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return 'Invalid file type. Only PDF, DOCX, and TXT files are allowed.';
    }
    return null;
  };

  const handleUpload = useCallback(async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);
    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('writingType', writingType);

    try {
      const res = await fetch('/api/mirror-mode/documents/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        if (data.learning?.learned) {
          setUploadSuccess({
            fileName: file.name,
            confidenceGain: data.learning.confidenceGain || 0,
            confidenceLevel: data.learning.confidenceLevel || 0,
            isFirstDocument: data.learning.isFirstDocument || false,
          });
        }
        refetch();
        setTimeout(() => setUploadSuccess(null), 5000);
      } else {
        setUploadError(data.error || 'Upload failed');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Network error');
    } finally {
      setUploading(false);
    }
  }, [userId, writingType, refetch]);

  const handleDeleteDocument = useCallback(async (documentId: string) => {
    try {
      const res = await fetch(`/api/mirror-mode/document/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setDeleteSuccess('Document deleted successfully');
      setTimeout(() => setDeleteSuccess(null), 3000);
      refetch();
    } catch (err: any) {
      console.error('Delete error:', err);
      throw err;
    }
  }, [refetch]);

  const handleResetVoice = useCallback(async () => {
    try {
      const res = await fetch('/api/mirror-mode/reset', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
      refetch();
    } catch (err: any) {
      console.error('Reset error:', err);
      throw err;
    }
  }, [refetch]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const getVarietyNudge = (documents: MirrorDocument[]): string | null => {
    if (documents.length < 3) return null;
    const typeCounts = documents.reduce((acc, d) => {
      const type = d.writing_type || 'other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const types = Object.keys(typeCounts);
    if (types.length >= 2) return null;
    const dominantType = types[0];
    const suggestions: Record<string, string> = {
      professional: 'Try adding a creative or personal sample for variety',
      academic: 'Try adding a professional email or casual post',
      creative: 'Try adding a professional or academic piece',
      personal: 'Try adding a professional or academic sample',
      technical: 'Try adding a personal or creative sample',
      other: 'Try adding different types of writing',
    };
    return suggestions[dominantType] || suggestions.other;
  };

  const handleDocumentClick = useCallback((documentId: string) => {
    setSelectedDocumentId(documentId);
    setShowDocumentDetail(true);
  }, []);

  const overview = status?.overview;
  const highlights = status?.voiceHighlights || [];
  const recommendations = status?.recommendations || [];
  const recentUploads = status?.documents?.recentUploads || [];
  const evolutionHistory = status?.evolutionHistory || [];
  const confidenceLevel = overview?.confidenceLevel || 0;
  const isReady = confidenceLevel >= 45;
  const isFirstTime = !overview?.hasProfile || (overview?.documentCount || 0) === 0;

  const documents: MirrorDocument[] = recentUploads.map((doc: any) => ({
    id: doc.id,
    filename: doc.fileName,
    writing_type: doc.writingType || 'general',
    word_count: doc.wordCount || 0,
    file_size: doc.fileSize || 0,
    uploaded_at: doc.uploadedAt || new Date().toISOString(),
    analyzed: doc.learned || false,
  }));

  const varietyNudge = getVarietyNudge(documents);
  const hasVoiceData = Boolean(status?.voiceDescription || recommendations.length > 0);
  const lastUserMessage = [...ursieMessages].reverse().find((m) => m.sender === 'user')?.message || '';

  useEffect(() => {
    let isActive = true;
    const loadUrsie = async () => {
      try {
        const res = await fetch('/api/mirror-mode/ursie/chat', { cache: 'no-store' });
        const data = await res.json();
        if (!isActive) return;
        if (data?.success) {
          setUrsieSessionId(data.sessionId || null);
          const loaded = (data.messages || []).map((m: any) => ({
            id: m.id,
            sender: m.sender,
            message: m.message,
            createdAt: m.created_at,
          }));
          if (loaded.length === 0) {
            setUrsieMessages([
              {
                id: `u-${Date.now()}-welcome`,
                sender: 'ursie',
                message: "State what you need. I’ll guide your voice work.",
              },
            ]);
          } else {
            setUrsieMessages(loaded);
          }
          setUrsieSavedCount(data.savedCount || 0);
          setUrsieIsSaved(!!data.isSaved);
          setUrsieMemoryPromptEnabled(data.memoryPromptEnabled !== false);
        }
      } catch (err) {
        if (isActive) setUrsieNotice('Failed to load Ursie chat.');
      }
    };
    loadUrsie();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!ursieMemoryPromptEnabled || !memoryPromptPending) return;
    setMemoryPromptNudge(false);
    const timer = window.setTimeout(() => {
      setMemoryPromptNudge(true);
    }, 120000);
    return () => window.clearTimeout(timer);
  }, [ursieMemoryPromptEnabled, memoryPromptPending]);

  useEffect(() => {
    if (!ursieNotice) return;
    const timer = window.setTimeout(() => setUrsieNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [ursieNotice]);

  useEffect(() => {
    if (!ursieChatRef.current) return;
    ursieChatRef.current.scrollTop = ursieChatRef.current.scrollHeight;
  }, [ursieMessages, ursieThinking]);

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <CosmicParticleBackground starCount={2000} nebulaIntensity={0.15} driftSpeed={0.15} />
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading your voice profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dashboard}>
        <CosmicParticleBackground starCount={2000} nebulaIntensity={0.15} driftSpeed={0.15} />
        <div className={styles.error}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" style={{ marginBottom: '1rem' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3>Connection Error</h3>
          <p>{error}</p>
          <button onClick={refetch} className={styles.btnRetry}>Retry</button>
        </div>
      </div>
    );
  }

  const sendUrsieMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || ursieThinking) return;
    const userMsg = { id: `u-${Date.now()}`, sender: 'user' as const, message: trimmed };
    setUrsieMessages((prev) => [...prev, userMsg]);
    setUrsieInput('');
    setUrsieThinking(true);
    setMemoryPromptPending(false);
    setMemoryPromptNudge(false);

    try {
      const res = await fetch('/api/mirror-mode/ursie/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, sessionId: ursieSessionId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Ursie is unavailable');
      }
      setUrsieSessionId(data.sessionId || ursieSessionId);
      setUrsieMessages((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}-r`,
          sender: 'ursie' as const,
          message: data.reply || 'I’m here with you. Ask me about your voice or what to train next.',
        },
      ]);
      setMemoryCandidate(data.memoryCandidate || '');
      setMemoryPromptPending(true);
    } catch (err: any) {
      setUrsieNotice(err?.message || 'Ursie had trouble responding.');
    } finally {
      setUrsieThinking(false);
    }
  };

  const handleSaveMemory = async (note: string) => {
    if (!note.trim()) return;
    try {
      const res = await fetch('/api/mirror-mode/ursie/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: ursieSessionId, note }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to save memory');
      setUrsieNotice('Memory saved.');
      setMemoryPromptPending(false);
      setMemoryCandidate('');
      setManualMemoryInput('');
    } catch (err: any) {
      setUrsieNotice(err?.message || 'Failed to save memory.');
    }
  };

  const handleDisableMemoryPrompts = async () => {
    try {
      await fetch('/api/mirror-mode/ursie/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoryPromptEnabled: false }),
      });
    } catch {
      // ignore
    }
    setUrsieMemoryPromptEnabled(false);
    setMemoryPromptPending(false);
    setMemoryCandidate('');
  };

  const handleSaveChat = async () => {
    if (!ursieSessionId) return;
    try {
      const res = await fetch('/api/mirror-mode/ursie/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: ursieSessionId, isSaved: true }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to save chat');
      setUrsieIsSaved(true);
      setUrsieSavedCount((c) => Math.min(c + 1, 10));
      setUrsieNotice('Chat saved.');
    } catch (err: any) {
      setUrsieNotice(err?.message || 'Unable to save chat.');
    }
  };

  const handleNewChat = async () => {
    try {
      const res = await fetch('/api/mirror-mode/ursie/session', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to start new chat');
      setUrsieSessionId(data.sessionId || null);
      setUrsieMessages([]);
      setUrsieIsSaved(false);
      setMemoryPromptPending(false);
      setMemoryPromptNudge(false);
      setUrsieNotice('New chat started.');
    } catch (err: any) {
      setUrsieNotice(err?.message || 'Unable to start new chat.');
    }
  };

  return (
    <div className={styles.dashboard}>
      <CosmicParticleBackground starCount={2000} nebulaIntensity={0.15} driftSpeed={0.15} />

      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div 
            className={styles.brandLogoContainer}
            onClick={() => router.push('/select-studio')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push('/select-studio'); }}
          >
            <Image 
              src="/thinkwrite-mirror-mode-logo.png" 
              alt="ThinkWrite AI - Mirror Mode" 
              width={800}
              height={1000}
              className={styles.brandLogo}
              priority
            />
          </div>
          
          <div className={styles.headerRight}>
            <p className={styles.subtitle}>Your voice is being learned by Ursie</p>
            <div className={`${styles.badge} ${isReady ? styles.badgeReady : styles.badgeLearning}`}>
              <span className={styles.pulse} />
              {isReady ? 'Voice Ready' : 'Learning'}
            </div>
          </div>
        </header>

        {/* Three-panel layout */}
        <div className={styles.layoutShell}>
          {/* Left Rail */}
          <div className={styles.leftRail}>
            {/* Progress Steps */}
            {documents.length < 3 && documents.length > 0 && (
              <div className={styles.progressCard}>
                <h3 className={styles.sectionTitle}>Getting Started</h3>
                <div className={styles.progressSteps}>
                  <div className={`${styles.progressStep} ${documents.length >= 1 ? styles.progressStepComplete : ''}`}>
                    <span className={`${styles.stepIndicator} ${documents.length >= 1 ? styles.stepIndicatorComplete : ''}`}>
                      {documents.length >= 1 ? '✓' : '1'}
                    </span>
                    <span className={`${styles.stepLabel} ${documents.length >= 1 ? styles.stepLabelComplete : ''}`}>
                      Upload first document
                    </span>
                  </div>
                  <div className={`${styles.progressStep} ${documents.length >= 2 ? styles.progressStepComplete : ''}`}>
                    <span className={`${styles.stepIndicator} ${documents.length >= 2 ? styles.stepIndicatorComplete : ''}`}>
                      {documents.length >= 2 ? '✓' : '2'}
                    </span>
                    <span className={`${styles.stepLabel} ${documents.length >= 2 ? styles.stepLabelComplete : ''}`}>
                      Add a second sample
                    </span>
                  </div>
                  <div className={`${styles.progressStep} ${documents.length >= 3 ? styles.progressStepComplete : ''}`}>
                    <span className={`${styles.stepIndicator} ${documents.length >= 3 ? styles.stepIndicatorComplete : ''}`}>
                      {documents.length >= 3 ? '✓' : '3'}
                    </span>
                    <span className={`${styles.stepLabel} ${documents.length >= 3 ? styles.stepLabelComplete : ''}`}>
                      Include variety
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className={styles.ursieCard}>
              <div className={styles.ursieHeader}>
                <div className={styles.ursieAvatar}>U</div>
                <div className={styles.ursieHeaderText}>
                  <div className={styles.ursieName}>Ursie</div>
                  <div className={styles.ursieSubtitle}>Voice Learning Guide</div>
                </div>
                <div className={styles.ursieHeaderActions}>
                  <button className={styles.ursieActionBtn} onClick={handleNewChat}>New</button>
                  <button className={styles.ursieActionBtn} onClick={handleSaveChat} disabled={ursieIsSaved}>
                    {ursieIsSaved ? 'Saved' : `Save (${ursieSavedCount}/10)`}
                  </button>
                </div>
              </div>

              <div className={styles.ursieChat} ref={ursieChatRef}>
                {ursieMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={msg.sender === 'user' ? styles.ursieMsgUser : styles.ursieMsgBot}
                  >
                    {msg.message}
                  </div>
                ))}
                {ursieThinking && (
                  <div className={styles.ursieMsgBot}>...</div>
                )}
              </div>

              {ursieNotice && <div className={styles.ursieNotice}>{ursieNotice}</div>}

              {ursieMemoryPromptEnabled && memoryPromptPending && (
                <div className={styles.ursieMemoryPrompt}>
                  <div className={styles.ursieMemoryText}>
                    Save this as a memory{memoryCandidate ? ':' : '?'}
                  </div>
                  {memoryCandidate && (
                    <div className={styles.ursieMemoryCandidate}>{memoryCandidate}</div>
                  )}
                  {memoryPromptNudge && (
                    <div className={styles.ursieMemoryNudge}>Still here if you want me to keep it.</div>
                  )}
                  <div className={styles.ursieMemoryActions}>
                    <button
                      className={styles.ursieMemoryBtn}
                      onClick={() => handleSaveMemory(memoryCandidate || lastUserMessage || 'User wants this remembered')}
                    >
                      Save
                    </button>
                    <button
                      className={styles.ursieMemoryBtnGhost}
                      onClick={() => {
                        setMemoryPromptPending(false);
                        setMemoryPromptNudge(false);
                        setMemoryCandidate('');
                      }}
                    >
                      Not now
                    </button>
                    <button className={styles.ursieMemoryDisable} onClick={handleDisableMemoryPrompts}>
                      Don’t ask again
                    </button>
                  </div>
                </div>
              )}

              {!ursieMemoryPromptEnabled && (
                <div className={styles.ursieMemoryManual}>
                  <div className={styles.ursieMemoryText}>Save a memory for Ursie</div>
                  <div className={styles.ursieMemoryInputRow}>
                    <input
                      value={manualMemoryInput}
                      onChange={(e) => setManualMemoryInput(e.target.value)}
                      placeholder="e.g., prefers concise, formal tone"
                      className={styles.ursieMemoryInput}
                    />
                    <button
                      className={styles.ursieMemoryBtn}
                      onClick={() => handleSaveMemory(manualMemoryInput)}
                      disabled={!manualMemoryInput.trim()}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.ursieQuickActions}>
                {[
                  'How do I train my voice?',
                  'Why is confidence low?',
                  'What should I upload next?',
                ].map((q) => (
                  <button
                    key={q}
                    className={styles.ursieQuickBtn}
                    onClick={() => sendUrsieMessage(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className={styles.ursieInputRow}>
                <input
                  value={ursieInput}
                  onChange={(e) => setUrsieInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sendUrsieMessage(ursieInput);
                  }}
                  placeholder="Ask Ursie..."
                  className={styles.ursieInput}
                />
                <button
                  className={styles.ursieSend}
                  onClick={() => sendUrsieMessage(ursieInput)}
                  disabled={!ursieInput.trim() || ursieThinking}
                >
                  →
                </button>
              </div>
            </div>
          </div>

          {/* Main Column */}
          <div className={styles.mainCol}>
            <section className={styles.heroSection}>
              <div className={styles.heroBadge}>Mirror Mode • Ursie</div>
              <div className={styles.heroTitle}>Your voice, held steady.</div>
              <div className={styles.heroSub}>
                Train, generate, or review samples. Ursie keeps your voice consistent across studios.
              </div>
            </section>

            <section className={styles.controlCenter}>
              <div className={styles.controlHeader}>
                <div>
                  <div className={styles.controlKicker}>Control Center</div>
                  <div className={styles.controlTitle}>Choose your path</div>
                </div>
                {hasVoiceData && (
                  <div className={styles.controlMeta}>
                    <div className={styles.controlMetaLabel}>How You Write</div>
                    {status?.voiceDescription && (
                      <div className={styles.controlMetaValue}>{status.voiceDescription}</div>
                    )}
                  </div>
                )}
              </div>

              {hasVoiceData && recommendations.length > 0 && (
                <div className={styles.controlSteps}>
                  {recommendations.map((rec, i) => (
                    <div key={i} className={styles.controlStep}>
                      <span className={styles.stepArrow}>→</span>
                      {rec}
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.hubRow}>
                {[
                  { key: 'train', title: 'Train Your Voice', desc: 'Upload samples' },
                  { key: 'generate', title: 'Generate In Your Voice', desc: 'Write in your style' },
                  { key: 'samples', title: 'Writing Samples', desc: 'Review documents' },
                ].map((hub) => (
                  <button
                    key={hub.key}
                    className={`${styles.hubButton} ${selectedHub === hub.key ? styles.hubButtonActive : ''}`}
                    onClick={() => setSelectedHub(hub.key as 'train' | 'generate' | 'samples')}
                  >
                    <div className={styles.hubButtonTitle}>{hub.title}</div>
                    <div className={styles.hubButtonDesc}>{hub.desc}</div>
                  </button>
                ))}
              </div>

              <div className={styles.controlBody}>
                {/* Upload Card */}
                {selectedHub === 'train' && (
                  <div 
                    className={`${styles.uploadCard} ${dragActive ? styles.uploadCardDragging : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <h3 className={styles.sectionTitle}>Train Your Voice</h3>
                    
                    <div className={styles.uploadArea}>
                      <div className={styles.uploadIcon}>
                        {uploading ? (
                          <div className={styles.spinnerSm} />
                        ) : (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                          </svg>
                        )}
                      </div>

                      <WritingTypeSelector
                        value={writingType}
                        onChange={setWritingType}
                        variant="dropdown"
                        disabled={uploading}
                      />

                      <p className={styles.uploadHint}>TXT, DOCX, or PDF • 50+ words</p>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.docx,.pdf"
                        onChange={handleFileSelect}
                        className={styles.fileInput}
                        disabled={uploading}
                      />

                      <button 
                        className={styles.btnUpload}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? 'Processing...' : 'Select Document'}
                      </button>
                    </div>

                    {uploadSuccess && (
                      <div className={styles.successBanner}>
                        <span className={styles.successIcon}>✓</span>
                        <div className={styles.successContent}>
                          <strong>{uploadSuccess.fileName}</strong> added to your voice profile
                          <span className={styles.successDetail}>
                            +{uploadSuccess.confidenceGain.toFixed(1)}% confidence → {uploadSuccess.confidenceLevel}%
                          </span>
                        </div>
                      </div>
                    )}
                    {uploadError && <div className={`${styles.toast} ${styles.toastError}`}>{uploadError}</div>}
                    {deleteSuccess && <div className={`${styles.toast} ${styles.toastSuccess}`}>{deleteSuccess}</div>}
                    {resetSuccess && <div className={`${styles.toast} ${styles.toastSuccess}`}>Voice profile has been reset</div>}
                    {varietyNudge && !uploadSuccess && (
                      <div className={styles.varietyNudge}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <span>{varietyNudge}</span>
                      </div>
                    )}
                  </div>
                )}

                {selectedHub === 'generate' && (
                  <section className={styles.sectionCard}>
                    <h2 className={styles.sectionHeading}>Generate In Your Voice</h2>
                    <div className={styles.generatorWrapper}>
                      <div className={styles.generatorInfo}>
                        <div className={styles.genConfidence}>
                          <span className={styles.genConfLabel}>Voice Confidence</span>
                          <span className={styles.genConfValue}>{confidenceLevel}%</span>
                        </div>
                        <p className={styles.genStatus}>
                          {isReady ? '✓ Your voice is ready to use' : 'Upload more documents to improve accuracy'}
                        </p>
                      </div>
                      <ModernVoiceGenerator confidenceLevel={confidenceLevel} isReady={confidenceLevel >= 25} />
                    </div>
                  </section>
                )}

                {selectedHub === 'samples' && (
                  <section className={styles.sectionCard}>
                    <h2 className={styles.sectionHeading}>Your Writing Samples</h2>
                    <div className={styles.docsWrapper}>
                      <DocumentList documents={documents} onDelete={handleDeleteDocument} isLoading={false} />
                    </div>
                  </section>
                )}
              </div>
            </section>
          </div>

          {/* Right Rail */}
          {selectedHub && (
          <div className={styles.rightRail}>
            {(evolutionHistory.length > 0 || documents.length > 0) && (
              <VoiceEvolutionTimeline
                currentConfidence={confidenceLevel}
                documentCount={overview?.documentCount || 0}
                totalWords={overview?.totalWordCount || 0}
                evolutionHistory={evolutionHistory}
                onDocumentClick={handleDocumentClick}
              />
            )}

            {highlights.length > 0 && (
              <div className={styles.card}>
                <h3 className={styles.sectionTitle}>Your Voice DNA</h3>
                <div className={styles.dnaGrid}>
                  {highlights.map((h, i) => (
                    <div key={i} className={styles.dnaBadge}>
                      <div className={styles.dnaLabel}>{h.label}</div>
                      <div className={styles.dnaValue}>{h.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <section className={styles.sectionCard}>
              <h2 className={styles.sectionHeading}>Live Learning Feed</h2>
              <div className={styles.feedWrapper}>
                <LiveLearningFeed />
              </div>
            </section>
          </div>
          )}
        </div>

        <div className={styles.resetSection}>
          <ResetVoice onReset={handleResetVoice} documentCount={documents.length} disabled={uploading} />
        </div>
      </div>

      <DocumentDetailModal
        documentId={selectedDocumentId || ''}
        isOpen={showDocumentDetail}
        onClose={() => { setShowDocumentDetail(false); setSelectedDocumentId(null); }}
      />

      <OnboardingTour isFirstTime={isFirstTime} onComplete={() => {}} onUploadClick={() => fileInputRef.current?.click()} />
    </div>
  );
}
