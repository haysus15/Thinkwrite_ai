'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useVoiceStatus } from '@/hooks/useVoiceStatus';
import { type WritingType, mapWritingTypeToChamber } from '@/lib/mirror-mode/writingTypes';
import { useCaptureLog } from '@/hooks/useCaptureLog';
import {
  translateSystemError,
  type ChamberStatus,
} from '@/lib/mirror/voiceProfileStatus';
import ChamberCard from '@/components/mirror/ChamberCard/ChamberCard';
import ConfidenceRoadmap from '@/components/mirror/ConfidenceRoadmap/ConfidenceRoadmap';
import GuidedUploadPrompts from '@/components/mirror/GuidedUploadPrompts/GuidedUploadPrompts';
import QuickStartExercise from '@/components/mirror/QuickStartExercise/QuickStartExercise';
import MomentumIndicator from '@/components/mirror/MomentumIndicator/MomentumIndicator';
import FirstUseWalkthrough from '@/components/mirror/FirstUseWalkthrough/FirstUseWalkthrough';
import CaptureTransparencyPanel from '@/components/mirror/CaptureTransparencyPanel/CaptureTransparencyPanel';
import DocumentDetailModal from './DocumentDetailModal';
import styles from './MirrorModeDashboard.module.css';

const CosmicParticleBackground = dynamic(
  () => import('./CosmicParticleBackground'),
  { ssr: false }
);

type Props = {
  userId: string;
};

type ChamberKey = 'career' | 'academic' | 'creative' | 'general';
type TabKey = 'identity' | 'archive' | 'ursie' | 'upload';

type MirrorDocument = {
  id: string;
  filename: string;
  writing_type: string;
  word_count: number;
  file_size: number;
  uploaded_at: string;
  analyzed: boolean;
};

type UploadSuccessData = {
  chamber: ChamberKey;
  isFirstDocument: boolean;
};

type UrsieMessage = {
  id: string;
  sender: 'user' | 'ursie';
  message: string;
};

type ChamberSummary = {
  confidenceLabel: string;
  confidenceLevel: number;
  documentCount: number;
  lastTrainedAt: string | null;
  updatedAt: string | null;
};

type TimelineEvent = {
  id: string;
  type: 'milestone' | 'insight' | 'observation';
  date: string;
  rawTimestamp: string;
  text: string;
  documentName?: string;
  chamber?: ChamberKey;
  writingType?: string;
  findings?: string[];
};

const chamberOrder: Array<{
  key: ChamberKey;
  label: string;
  description: string;
  writingType: WritingType;
  colorVar: '--career' | '--academic' | '--creative' | '--general';
}> = [
  { key: 'career', label: 'Career', description: 'Professional voice', writingType: 'professional', colorVar: '--career' },
  { key: 'academic', label: 'Academic', description: 'Analytical voice', writingType: 'academic', colorVar: '--academic' },
  { key: 'creative', label: 'Creative', description: 'Imaginative voice', writingType: 'creative', colorVar: '--creative' },
  { key: 'general', label: 'General', description: 'Everyday voice', writingType: 'general', colorVar: '--general' },
];

const tabItems: Array<{ key: TabKey; label: string }> = [
  { key: 'identity', label: 'Identity' },
  { key: 'archive', label: 'Archive' },
  { key: 'ursie', label: 'Ursie' },
  { key: 'upload', label: 'Upload' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

function formatRelative(value?: string): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

export default function MirrorModeDashboard({ userId }: Props) {
  void userId;

  const { status, loading, error, refetch } = useVoiceStatus();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>('identity');
  const [openArchiveChamber, setOpenArchiveChamber] = useState<ChamberKey | null>('career');
  const [timelineOpen, setTimelineOpen] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<UploadSuccessData | null>(null);
  const [uploadObservations, setUploadObservations] = useState<string[]>([]);
  const [showMomentum, setShowMomentum] = useState(false);
  const [momentumStateLabel, setMomentumStateLabel] = useState('Learning');
  const [dragActive, setDragActive] = useState(false);
  const [selectedUploadChamber, setSelectedUploadChamber] = useState<ChamberKey>('general');
  const [hasSelectedChamber, setHasSelectedChamber] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [walkthroughDismissed, setWalkthroughDismissed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [showDocumentDetail, setShowDocumentDetail] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);

  const [floatingUrsieOpen, setFloatingUrsieOpen] = useState(false);

  const [ursieMessages, setUrsieMessages] = useState<UrsieMessage[]>([]);
  const [ursieInput, setUrsieInput] = useState('');
  const [ursieThinking, setUrsieThinking] = useState(false);
  const [ursieSessionId, setUrsieSessionId] = useState<string | null>(null);
  const [ursieSavedCount, setUrsieSavedCount] = useState<number>(0);
  const [ursieIsSaved, setUrsieIsSaved] = useState<boolean>(false);
  const [ursieNotice, setUrsieNotice] = useState<string | null>(null);
  const [ursieLoadError, setUrsieLoadError] = useState<string | null>(null);
  const [observationsLoadError, setObservationsLoadError] = useState<string | null>(null);
  const [epochsLoadError, setEpochsLoadError] = useState<string | null>(null);
  const [ursieObservations, setUrsieObservations] = useState<Array<{ id: string; text: string; type?: string; chamber?: string; createdAt?: string }>>([]);
  const [manualMemoryInput, setManualMemoryInput] = useState('');
  const {
    captureLog,
    loading: captureLogLoading,
    error: captureLogError,
    refetch: refetchCaptureLog,
  } = useCaptureLog(7);

  const [epochs, setEpochs] = useState<Array<{ id: string; epoch_number: number | null; started_at: string; ended_at: string | null }>>([]);

  const chatRefMain = useRef<HTMLDivElement>(null);
  const chatRefFloating = useRef<HTMLDivElement>(null);

  const overview = status?.overview;
  const highlights = status?.voiceHighlights || [];
  const chamberSummaries = status?.chamberSummaries || null;
  const chamberStatuses = status?.chamberStatuses || null;
  const mirrorPreferences = status?.preferences || null;
  const chamberWarnings = status?.chamberWarnings || [];
  const recentUploads = useMemo(
    () => status?.documents?.recentUploads ?? [],
    [status?.documents?.recentUploads]
  );
  const evolutionHistory = useMemo(
    () => status?.evolutionHistory ?? [],
    [status?.evolutionHistory]
  );
  const documents: MirrorDocument[] = useMemo(
    () => recentUploads.map((doc: any) => ({
      id: doc.id,
      filename: doc.fileName,
      writing_type: doc.writingType || 'general',
      word_count: doc.wordCount || 0,
      file_size: doc.fileSize || 0,
      uploaded_at: doc.uploadedAt || new Date().toISOString(),
      analyzed: doc.learned || false,
    })),
    [recentUploads]
  );

  const chamberDocs = useMemo(() => {
    const seed: Record<ChamberKey, MirrorDocument[]> = {
      career: [],
      academic: [],
      creative: [],
      general: [],
    };

    documents.forEach((doc) => {
      const chamber = mapWritingTypeToChamber(doc.writing_type) as ChamberKey;
      seed[chamber].push(doc);
    });

    (Object.keys(seed) as ChamberKey[]).forEach((chamber) => {
      seed[chamber].sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
    });

    return seed;
  }, [documents]);

  const chamberDocCounts = useMemo(() => {
    const counts: Record<ChamberKey, number> = {
      career: 0,
      academic: 0,
      creative: 0,
      general: 0,
    };

    chamberOrder.forEach((chamber) => {
      counts[chamber.key] = chamberDocs[chamber.key].length;
    });

    return counts;
  }, [chamberDocs]);

  const getFallbackChamberStatus = useCallback(
    (chamber: ChamberKey): ChamberStatus => ({
      state: 'empty',
      displayLabel: 'Not started',
      documentCount: chamberDocCounts[chamber] || 0,
      confidenceScore: 0,
      nextMilestone: 'Upload your first writing sample to begin.',
      progressToNext: 0,
    }),
    [chamberDocCounts]
  );

  const getStatusLabel = (state: ChamberStatus['state']) => {
    if (state === 'strong') return 'Strong';
    if (state === 'ready') return 'Ready';
    return 'Learning';
  };

  const profileSampleCount = overview?.documentCount || 0;
  const documentCount = status?.documents?.total || 0;
  const chamberSignalCounts = useMemo(() => {
    const counts: Record<ChamberKey, number> = {
      career: 0,
      academic: 0,
      creative: 0,
      general: 0,
    };

    chamberOrder.forEach((chamber) => {
      const summaryCount = (chamberSummaries?.[chamber.key as keyof typeof chamberSummaries] as ChamberSummary | null)?.documentCount || 0;
      counts[chamber.key] = Math.max(summaryCount - chamberDocCounts[chamber.key], 0);
    });

    return counts;
  }, [chamberDocCounts, chamberSummaries]);
  const learnedSignalCount = Math.max(profileSampleCount - documentCount, 0);
  const rawChamberCount = chamberOrder.filter((c) => (chamberDocCounts[c.key] + chamberSignalCounts[c.key]) > 0).length;
  const chamberCount = (documentCount + learnedSignalCount) > 0 && rawChamberCount === 0 ? 1 : rawChamberCount;
  const totalWordCount = overview?.totalWordCount || 0;

  const formatDate = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDateLong = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatWordsK = (value: number): string => {
    if (!value) return '0';
    if (value < 1000) return `${value}`;
    return `${(value / 1000).toFixed(1)}k`;
  };

  const describeChange = (change: string): string => {
    const map: Record<string, string> = {
      'initial-profile-created': 'First profile established',
      'minor-refinement': 'Minor voice refinement',
      'formality-shift': 'Formality shifted',
      'sentence-length-shift': 'Sentence length changed',
      'vocabulary-complexity-shift': 'Vocabulary complexity moved',
      'hedge-density-shift': 'Hedging pattern changed',
      'punctuation-rhythm-shift': 'Punctuation rhythm changed',
      'voice-variation-shift': 'Voice variation changed',
    };
    return map[change] || change.replace(/-/g, ' ');
  };

  const getChamberDisplayStatus = (chamber: ChamberKey): ChamberStatus => {
    return (chamberStatuses?.[chamber] as ChamberStatus | undefined) || getFallbackChamberStatus(chamber);
  };

  const getIdentityOneLiner = (): string => {
    const assessedSamples = Math.max(profileSampleCount, documentCount);
    if (assessedSamples === 0) return "I don't know your voice yet. Show me how you write.";
    if (assessedSamples < 3) return 'I am starting to hear your patterns. Give me a little more range.';
    if (chamberCount < 2) {
      const primary = chamberOrder.find((c) => (chamberDocCounts[c.key] + chamberSignalCounts[c.key]) > 0)?.label.toLowerCase() || 'current';
      return `Your ${primary} voice is forming. I still need your other sides.`;
    }
    if (assessedSamples < 6) return 'I can hear your rhythm. Now we sharpen consistency across chambers.';

    const ranked = chamberOrder
      .map((c) => ({
        key: c.key,
        label: c.label,
        count: chamberDocCounts[c.key] + chamberSignalCounts[c.key],
        confidence: ((chamberSummaries?.[c.key as keyof typeof chamberSummaries] as ChamberSummary | null)?.confidenceLevel || 0),
      }))
      .sort((a, b) => b.confidence - a.confidence || b.count - a.count);

    const strongest = ranked.find((r) => r.count > 0);
    const weakest = ranked.filter((r) => r.count > 0).slice(-1)[0];
    const empty = ranked.find((r) => r.count === 0);

    if (empty) return `I know your voice in parts. ${empty.label} is still waiting.`;
    if (strongest && weakest && strongest.key !== weakest.key) {
      return `I know your voice. ${strongest.label} is strongest. ${weakest.label} needs more depth.`;
    }
    return 'Your archive is coherent. I can track shifts between contexts.';
  };

  const getVarietyNudge = (): string => {
    const assessedSamples = Math.max(profileSampleCount, documentCount);
    if (assessedSamples === 0) return 'Start anywhere. Show me how you write.';
    if (assessedSamples < 3) return 'One more sample will make your profile steadier.';
    if (chamberCount < 2) {
      const only = chamberOrder.find((c) => (chamberDocCounts[c.key] + chamberSignalCounts[c.key]) > 0)?.label.toLowerCase() || 'current';
      return `You are concentrated in ${only}. Add a different chamber for balance.`;
    }
    if (chamberCount < 4) return 'Strong momentum. Add your missing chambers to round out your voice.';
    return 'Good range. Keep feeding each chamber so your voice stays sharp.';
  };

  const markRoadmapDismissed = useCallback(async (chamber: ChamberKey) => {
    try {
      await fetch('/api/mirror-mode/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roadmapDismissedChamber: chamber }),
      });
    } catch {
      // best effort
    }
  }, []);

  const completeFirstVisit = useCallback(async () => {
    try {
      await fetch('/api/mirror-mode/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mirrorModeFirstVisit: false }),
      });
    } catch {
      // best effort
    }
    setWalkthroughDismissed(true);
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      return `File too large (${mb}MB). Maximum size is 10MB.`;
    }

    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return 'Invalid file type. Only PDF, DOCX, and TXT files are allowed.';
    }

    return null;
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);

    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    const selected = chamberOrder.find((c) => c.key === selectedUploadChamber);
    const writingType = selected?.writingType || 'general';

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
      if (!data.success) throw new Error(data.error || 'Upload failed');

      setUploadSuccess({
        chamber: selectedUploadChamber,
        isFirstDocument: Boolean(data.learning?.isFirstDocument),
      });
      const observations = Array.isArray(data?.observations)
        ? data.observations
        : Array.isArray(data?.learning?.observations)
          ? data.learning.observations
          : [];
      setUploadObservations(observations);
      const stateLabel = data?.newState || data?.chamberStatus?.displayLabel || 'Learning';
      setMomentumStateLabel(typeof stateLabel === 'string' ? stateLabel : 'Learning');
      setShowMomentum(true);
      await completeFirstVisit();
      await markRoadmapDismissed(selectedUploadChamber);
      refetch();
      window.setTimeout(() => setUploadSuccess(null), 5000);
    } catch (err: any) {
      const raw = err?.message || 'UNKNOWN';
      setUploadError(translateSystemError(raw));
    } finally {
      setUploading(false);
    }
  }, [completeFirstVisit, markRoadmapDismissed, refetch, selectedUploadChamber, validateFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.currentTarget.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleQuickStartCompleted = useCallback(async (result: {
    observations: string[];
    chamberStatus?: { displayLabel: string };
  }) => {
    setUploadObservations(result.observations || []);
    setMomentumStateLabel(result?.chamberStatus?.displayLabel || 'Learning');
    setShowMomentum(true);
    await completeFirstVisit();
    await markRoadmapDismissed(selectedUploadChamber);
    refetch();
  }, [completeFirstVisit, markRoadmapDismissed, refetch, selectedUploadChamber]);

  const handleDeleteDocument = useCallback(async (documentId: string) => {
    setDeletingDocumentId(documentId);
    try {
      const res = await fetch(`/api/mirror-mode/document/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Hide failed');
      refetch();
    } catch (err: any) {
      setUploadError(translateSystemError(err?.message || 'UNKNOWN'));
    } finally {
      setDeletingDocumentId(null);
    }
  }, [refetch]);

  const handleResetVoice = useCallback(async () => {
    try {
      const res = await fetch('/api/mirror-mode/reset', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setUrsieNotice('Started a fresh epoch.');
      refetch();
    } catch (err: any) {
      setUrsieNotice(translateSystemError(err?.message || 'UNKNOWN'));
    }
  }, [refetch]);

  const handleChamberCardClick = (chamber: ChamberKey) => {
    setActiveTab('archive');
    setOpenArchiveChamber(chamber);
  };

  useEffect(() => {
    if (status?.preferences?.isFirstMirrorModeVisit === false) {
      setWalkthroughDismissed(true);
      setHasSelectedChamber(true);
    }
  }, [status?.preferences?.isFirstMirrorModeVisit]);

  useEffect(() => {
    const savedTab = window.sessionStorage.getItem('mirror-mode-active-tab') as TabKey | null;
    if (savedTab && tabItems.some((item) => item.key === savedTab)) {
      setActiveTab(savedTab);
    }
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem('mirror-mode-active-tab', activeTab);
    if (activeTab === 'ursie') {
      setFloatingUrsieOpen(false);
    }
  }, [activeTab]);

  const loadUrsie = useCallback(async () => {
    try {
      setUrsieLoadError(null);
      const res = await fetch('/api/mirror-mode/ursie/chat', { cache: 'no-store' });
      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.error || 'UNKNOWN');
      }

      setUrsieSessionId(data.sessionId || null);
      setUrsieSavedCount(data.savedCount || 0);
      setUrsieIsSaved(Boolean(data.isSaved));

      const loaded = (data.messages || []).map((m: any) => ({
        id: m.id,
        sender: m.sender,
        message: m.message,
      }));

      if (loaded.length === 0) {
        setUrsieMessages([
          {
            id: 'ursie-default',
            sender: 'ursie',
            message: "I'm here. Ask me about your voice, your chambers, or what to upload next.",
          },
        ]);
      } else {
        setUrsieMessages(loaded);
      }
    } catch (err: any) {
      setUrsieLoadError(translateSystemError(err?.message || 'UNKNOWN'));
    }
  }, []);

  const loadObservations = useCallback(async () => {
    try {
      setObservationsLoadError(null);
      const res = await fetch('/api/mirror-mode/observations?limit=20', { cache: 'no-store' });
      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.error || 'UNKNOWN');
      }

      setUrsieObservations((data.observations || []).map((o: any) => ({
        id: o.id,
        text: o.observation_text,
        type: o.observation_type,
        chamber: o.chamber,
        createdAt: o.generated_at,
      })));
    } catch (err: any) {
      setObservationsLoadError(translateSystemError(err?.message || 'UNKNOWN'));
    }
  }, []);

  const loadEpochs = useCallback(async () => {
    try {
      setEpochsLoadError(null);
      const res = await fetch('/api/mirror-mode/epochs', { cache: 'no-store' });
      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.error || 'UNKNOWN');
      }

      setEpochs((data.epochs || []).map((epoch: any) => ({
        id: epoch.id,
        epoch_number: epoch.epoch_number ?? null,
        started_at: epoch.started_at,
        ended_at: epoch.ended_at,
      })));
    } catch (err: any) {
      setEpochsLoadError(translateSystemError(err?.message || 'UNKNOWN'));
    }
  }, []);

  useEffect(() => {
    void loadUrsie();
    void loadObservations();
    void loadEpochs();
  }, [loadEpochs, loadObservations, loadUrsie]);

  useEffect(() => {
    if (chatRefMain.current) {
      chatRefMain.current.scrollTop = chatRefMain.current.scrollHeight;
    }
    if (chatRefFloating.current) {
      chatRefFloating.current.scrollTop = chatRefFloating.current.scrollHeight;
    }
  }, [ursieMessages, ursieThinking, floatingUrsieOpen]);

  useEffect(() => {
    if (!ursieNotice) return;
    const timer = window.setTimeout(() => setUrsieNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [ursieNotice]);

  const sendUrsieMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || ursieThinking) return;

    setUrsieMessages((prev) => [...prev, { id: `u-${Date.now()}`, sender: 'user', message: trimmed }]);
    setUrsieInput('');
    setUrsieThinking(true);

    try {
      const res = await fetch('/api/mirror-mode/ursie/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, sessionId: ursieSessionId }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Ursie is unavailable');

      setUrsieSessionId(data.sessionId || ursieSessionId);
      setUrsieMessages((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}-r`,
          sender: 'ursie',
          message: data.reply || 'I am here. Ask what to train next.',
        },
      ]);
    } catch (err: any) {
      setUrsieNotice(translateSystemError(err?.message || 'UNKNOWN'));
    } finally {
      setUrsieThinking(false);
    }
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
      setUrsieSavedCount((value) => Math.min(value + 1, 10));
      setUrsieNotice('Chat saved.');
    } catch (err: any) {
      setUrsieNotice(translateSystemError(err?.message || 'UNKNOWN'));
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
      setUrsieNotice('New chat started.');
    } catch (err: any) {
      setUrsieNotice(translateSystemError(err?.message || 'UNKNOWN'));
    }
  };

  const handleSaveMemory = async () => {
    const note = manualMemoryInput.trim();
    if (!note) return;

    try {
      const res = await fetch('/api/mirror-mode/ursie/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: ursieSessionId, note }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to save memory');

      setManualMemoryInput('');
      setUrsieNotice('Saved for Ursie.');
    } catch (err: any) {
      setUrsieNotice(translateSystemError(err?.message || 'UNKNOWN'));
    }
  };

  const evolutionEvents = useMemo<TimelineEvent[]>(() => {
    const observationsByChamber: Partial<Record<ChamberKey, string>> = {};
    ursieObservations.forEach((obs) => {
      const chamber = obs.chamber as ChamberKey | undefined;
      if (!chamber || observationsByChamber[chamber]) return;
      observationsByChamber[chamber] = obs.text;
    });

    const fromArchive: TimelineEvent[] = [...documents]
      .sort((a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime())
      .map((doc) => {
        const chamber = mapWritingTypeToChamber(doc.writing_type) as ChamberKey;
        const findings: string[] = [
          `${doc.word_count || 0} words recorded`,
          doc.analyzed ? 'Ursie learned from this entry' : 'Queued for learning',
        ];
        const chamberObservation = observationsByChamber[chamber];
        if (chamberObservation) findings.unshift(chamberObservation);

        return {
          id: `archive-${doc.id}`,
          type: 'milestone',
          date: formatDate(doc.uploaded_at),
          rawTimestamp: doc.uploaded_at,
          text: `${doc.filename || 'Document'} archived in ${chamber} chamber.`,
          documentName: doc.filename || 'Document',
          chamber,
          writingType: doc.writing_type || 'general',
          findings: findings.slice(0, 3),
        };
      });

    const fromLearning: TimelineEvent[] = [...evolutionHistory]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((entry: any) => {
        const chamber = mapWritingTypeToChamber(entry.writingType) as ChamberKey;
        const findings = (entry.changesMade || []).slice(0, 3).map(describeChange);
        const chamberObservation = observationsByChamber[chamber];
        if (chamberObservation) findings.unshift(chamberObservation);

        return {
          id: `ev-${entry.documentId}-${entry.timestamp}`,
          type: 'milestone',
          date: formatDate(entry.timestamp),
          rawTimestamp: entry.timestamp,
          text: `${entry.documentName || 'Writing sample'} recorded in ${chamber} chamber learning log.`,
          documentName: entry.documentName || 'Document',
          chamber,
          writingType: entry.writingType || 'general',
          findings: findings.slice(0, 3),
        };
      });

    const fromObservations: TimelineEvent[] = ursieObservations.slice(0, 8).map((obs, idx) => ({
      id: `obs-${obs.id}`,
      type: (idx % 2 === 0 ? 'insight' : 'observation') as 'insight' | 'observation',
      date: formatDate(obs.createdAt || new Date().toISOString()),
      rawTimestamp: obs.createdAt || new Date().toISOString(),
      text: obs.text,
      chamber: (obs.chamber as ChamberKey | undefined) || undefined,
      findings: [],
    }));

    const recentSignals = [...fromLearning, ...fromObservations]
      .sort((a, b) => new Date(a.rawTimestamp).getTime() - new Date(b.rawTimestamp).getTime())
      .slice(-80);

    const merged = [...fromArchive, ...recentSignals]
      .sort((a, b) => new Date(a.rawTimestamp).getTime() - new Date(b.rawTimestamp).getTime());
    return merged;
  }, [documents, evolutionHistory, ursieObservations]);

  const activeArchiveDocs = openArchiveChamber ? (chamberDocs[openArchiveChamber] || []) : [];
  const lastTimelineEvent = evolutionEvents[evolutionEvents.length - 1] || null;
  const activeChamberStatus =
    (chamberStatuses?.[selectedUploadChamber] as ChamberStatus | undefined) ||
    getFallbackChamberStatus(selectedUploadChamber);
  const roadmapDismissed = Boolean(
    mirrorPreferences?.roadmapDismissedByChamber?.[selectedUploadChamber]
  );
  const showRoadmap =
    activeChamberStatus.documentCount === 0 && !roadmapDismissed;
  const showQuickStart = activeChamberStatus.documentCount < 3;
  const showWalkthrough =
    !walkthroughDismissed &&
    Boolean(mirrorPreferences?.isFirstMirrorModeVisit);

  const archiveObservationByChamber = useMemo(() => {
    const map: Record<ChamberKey, string | null> = {
      career: null,
      academic: null,
      creative: null,
      general: null,
    };

    chamberOrder.forEach((chamber) => {
      const found = ursieObservations.find((obs) => obs.chamber === chamber.key);
      map[chamber.key] = found?.text || null;
    });

    return map;
  }, [ursieObservations]);

  const shouldShowFloatingUrsie = activeTab !== 'ursie';

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <CosmicParticleBackground starCount={2000} nebulaIntensity={0.15} driftSpeed={0.15} />
        <div className={styles.loadingCard}>
          <div className={styles.spinner} />
          <p>Loading Mirror Mode...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dashboard}>
        <CosmicParticleBackground starCount={2000} nebulaIntensity={0.15} driftSpeed={0.15} />
        <div className={styles.loadingCard}>
          <h3>Connection error</h3>
          <p>{error}</p>
          <button type="button" className={styles.retryButton} onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <CosmicParticleBackground starCount={2000} nebulaIntensity={0.15} driftSpeed={0.15} />

      <div className={styles.container}>
        <header className={styles.header}>
          <button type="button" className={styles.headerBrand} onClick={() => router.push('/select-studio')}>
            <Image
              src="/thinkwrite-mirror-mode-logo.png"
              alt="ThinkWrite Mirror Mode"
              width={560}
              height={84}
              className={styles.brandLogo}
              priority
            />
          </button>

          <div className={styles.headerPresence}>
            <span className={styles.presenceDot} />
            <span>Ursie is watching</span>
          </div>
        </header>

        <nav className={styles.tabBar}>
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`${styles.tabButton} ${activeTab === tab.key ? styles.tabButtonActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span>{tab.label}</span>
              {tab.key === 'archive' && (
                <span className={styles.tabBadge}>{documentCount}</span>
              )}
            </button>
          ))}
        </nav>

        {showWalkthrough && (
          <FirstUseWalkthrough
            visible={showWalkthrough}
            hasSelectedChamber={hasSelectedChamber}
            hasFirstUpload={activeChamberStatus.documentCount > 0}
            onSkip={completeFirstVisit}
            onRequestUploadFocus={() => setActiveTab('upload')}
          />
        )}

        <section className={styles.actionFirstSection}>
          <div className={styles.chamberTabs} id="chamber-tabs">
            {chamberOrder.map((chamber) => (
              <button
                key={chamber.key}
                type="button"
                className={`${styles.chamberTabBtn} ${selectedUploadChamber === chamber.key ? styles.chamberTabBtnActive : ''}`}
                onClick={() => {
                  setSelectedUploadChamber(chamber.key);
                  setHasSelectedChamber(true);
                }}
              >
                {chamber.label}
              </button>
            ))}
          </div>

          <ChamberCard
            chamberLabel={`${chamberOrder.find((c) => c.key === selectedUploadChamber)?.label || 'General'} chamber`}
            status={activeChamberStatus}
            onPrimaryAction={() => setActiveTab('upload')}
            primaryActionLabel={activeChamberStatus.state === 'strong' ? 'View profile' : 'Add sample'}
          />

          <div className={styles.nextActionBar}>
            <p>{activeChamberStatus.nextMilestone}</p>
            <button
              type="button"
              className={styles.nextActionBtn}
              onClick={() => setActiveTab('upload')}
            >
              {activeChamberStatus.state === 'strong' ? 'Open archive' : 'Add sample'}
            </button>
          </div>

          <details
            className={styles.advancedPanel}
            open={advancedOpen}
            onToggle={(event) =>
              setAdvancedOpen((event.target as HTMLDetailsElement).open)
            }
          >
            <summary>Advanced</summary>
            <div className={styles.advancedContent}>
              <p>
                Confidence: {activeChamberStatus.confidenceScore}
              </p>
              <p>
                Progress to next: {activeChamberStatus.progressToNext}%
              </p>
              <p>
                Raw chamber warnings: {chamberWarnings.length}
              </p>
            </div>
          </details>
        </section>

        <main className={styles.tabContentWrap}>
          {activeTab === 'identity' && (
            <section className={styles.tabContent}>
              <article className={styles.glassCard}>
                <div className={styles.identityHeroMock}>
                  <button type="button" className={styles.timelineCompact} onClick={() => setTimelineOpen(true)}>
                    <div className={styles.timelineCompactTop}>
                      <span className={styles.timelineCompactLabel}>Timeline</span>
                      <span className={styles.timelineCompactIcon}>↗</span>
                    </div>
                    <div className={styles.timelineCompactSep} />
                    <p className={styles.timelineCompactPreview}>
                      {lastTimelineEvent?.documentName
                        ? `${lastTimelineEvent.documentName}: ${lastTimelineEvent.text}`
                        : (lastTimelineEvent?.text || "Ursie timeline appears as your archive grows.")}
                    </p>
                    <div className={styles.timelineCompactFooter}>
                      <span>{evolutionEvents.length} entries</span>
                      <span>View all</span>
                    </div>
                  </button>

                  <div className={styles.identityMainMock}>
                    <p className={styles.assessmentLabel}>Ursie assessment</p>
                    <p className={styles.assessmentLine}>{getIdentityOneLiner()}</p>

                    <div className={styles.metaRowMock}>
                      <div>
                        <p className={styles.metaValueMock}>{documentCount}</p>
                        <p className={styles.metaKey}>Archive docs</p>
                      </div>
                      <div>
                        <p className={styles.metaValueMock}>{learnedSignalCount}</p>
                        <p className={styles.metaKey}>Learned signals</p>
                      </div>
                      <div>
                        <p className={styles.metaValueMock}>{formatWordsK(totalWordCount)}<span> words</span></p>
                        <p className={styles.metaKey}>Analyzed</p>
                      </div>
                    </div>

                    <CaptureTransparencyPanel
                      captureLog={captureLog}
                      loading={captureLogLoading}
                      error={captureLogError}
                      onRetry={refetchCaptureLog}
                    />
                  </div>
                </div>
                <div className={styles.identityDivider} />
                <div className={styles.identityChamberRowMock}>
                  {chamberOrder.map((chamber) => {
                    const count = chamberDocCounts[chamber.key];
                    const signalCount = chamberSignalCounts[chamber.key];
                    const displayStatus = getChamberDisplayStatus(chamber.key);

                    return (
                      <button
                        key={chamber.key}
                        type="button"
                        className={`${styles.chamberItemMock} ${count === 0 ? styles.chamberItemMockEmpty : ''}`}
                        onClick={() => handleChamberCardClick(chamber.key)}
                      >
                        <div className={styles.chamberItemTopMock}>
                          <span className={styles.chamberDotMock} style={{ backgroundColor: `var(${chamber.colorVar})` }} />
                          <span className={styles.chamberNameMock}>{chamber.label}</span>
                        </div>
                        <p className={styles.chamberSubMock}>{chamber.description}</p>
                        <div className={styles.chamberStatsMock}>
                          <span>
                            {count > 0 ? `${count} docs` : 'No documents'}
                            {signalCount > 0 ? ` + ${signalCount} signals` : ''}
                          </span>
                          <span style={{ color: count > 0 ? `var(${chamber.colorVar})` : undefined }}>{getStatusLabel(displayStatus.state)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </article>

              <article className={styles.subtleActionsRow}>
                <button type="button" className={styles.inlineLink} onClick={handleResetVoice}>Start fresh</button>
                <Link href="/mirror-mode" className={styles.inlineLink}>Privacy controls</Link>
              </article>
            </section>
          )}

          {activeTab === 'archive' && (
            <section className={styles.tabContent}>
              <article className={styles.glassCard}>
                <p className={styles.sectionTitle}>YOUR WRITING ARCHIVE</p>

                <div className={styles.archiveList}>
                  {chamberOrder.map((chamber) => {
                    const isOpen = openArchiveChamber === chamber.key;
                    const count = chamberDocCounts[chamber.key];
                    const signalCount = chamberSignalCounts[chamber.key];
                    const chamberObservation = archiveObservationByChamber[chamber.key];
                    const displayStatus = getChamberDisplayStatus(chamber.key);

                    return (
                      <section
                        key={chamber.key}
                        className={styles.archiveAccordion}
                        style={{ ['--chamber-color' as any]: `var(${chamber.colorVar})` }}
                      >
                        <button
                          type="button"
                          className={styles.archiveHeader}
                          onClick={() => setOpenArchiveChamber((prev) => (prev === chamber.key ? null : chamber.key))}
                        >
                          <div className={styles.archiveHeaderLeft}>
                            <span className={styles.archiveColorDot} />
                            <span className={styles.archiveName}>{chamber.label}</span>
                            <span className={styles.archiveCount}>
                              {count > 0 ? `${count} ${count === 1 ? 'doc' : 'docs'}` : 'empty'}
                              {signalCount > 0 ? ` • ${signalCount} signals` : ''}
                            </span>
                          </div>
                          <span className={`${styles.archiveChevron} ${isOpen ? styles.archiveChevronOpen : ''}`}>▾</span>
                        </button>

                        {isOpen && (
                          <div className={styles.archiveBody}>
                            {chamberObservation && (
                              <div className={styles.archiveObservation}>
                                <p>Ursie: {chamberObservation}</p>
                              </div>
                            )}

                            {highlights.length > 0 && (
                              <div className={styles.patternTagRow}>
                                {highlights.slice(0, 6).map((h, idx) => (
                                  <span key={`${h.label}-${idx}`} className={styles.patternTag}>{h.label}</span>
                                ))}
                              </div>
                            )}

                            {activeArchiveDocs.length > 0 ? (
                              <div className={styles.archiveDocList}>
                                {activeArchiveDocs.map((doc) => (
                                  <div key={doc.id} className={styles.archiveDocRow}>
                                    <button
                                      type="button"
                                      className={styles.archiveDocButton}
                                      onClick={() => {
                                        setSelectedDocumentId(doc.id);
                                        setShowDocumentDetail(true);
                                      }}
                                    >
                                      <span className={styles.archiveDocName}>{doc.filename}</span>
                                      <span className={styles.archiveDocMeta}>{chamber.label} • {doc.word_count} words • {formatDateLong(doc.uploaded_at)}</span>
                                    </button>

                                    <button
                                      type="button"
                                      className={styles.deleteDocButton}
                                      onClick={() => handleDeleteDocument(doc.id)}
                                      disabled={deletingDocumentId === doc.id}
                                    >
                                      {deletingDocumentId === doc.id ? 'Hiding...' : 'Hide'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className={styles.archiveEmptyState}>No documents in this chamber yet. Upload some {chamber.label.toLowerCase()} writing to get started.</p>
                            )}

                            {count > 0 && activeArchiveDocs.length === 0 && (
                              <p className={styles.archiveEmptyState}>This chamber has learned from studio activity, but direct uploads are not listed here yet.</p>
                            )}

                            <p className={styles.archiveStatusHint}>{getStatusLabel(displayStatus.state)}</p>
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              </article>
            </section>
          )}

          {activeTab === 'ursie' && (
            <section className={styles.tabContent}>
              <article className={`${styles.glassCard} ${styles.ursieTabCard}`}>
                <div className={styles.ursieGrid}>
                  <div className={styles.ursieChatPane}>
                    <header className={styles.ursiePaneHeader}>
                      <div className={styles.ursieTitleWrap}>
                        <span className={styles.ursieAvatar}>U</span>
                        <div>
                          <p className={styles.ursieName}>Ursie</p>
                          <p className={styles.ursieSubtitle}>Your voice, reflected honestly</p>
                        </div>
                      </div>

                      <div className={styles.ursieActionRow}>
                        <button type="button" className={styles.smallActionBtn} onClick={handleNewChat}>New</button>
                        <button type="button" className={styles.smallActionBtn} onClick={handleSaveChat} disabled={ursieIsSaved}>
                          {ursieIsSaved ? 'Saved' : `Save (${ursieSavedCount}/10)`}
                        </button>
                      </div>
                    </header>

                    <div className={styles.quickActionRow}>
                      {ursieLoadError && (
                        <div className={styles.uploadError}>
                          {ursieLoadError}
                          <button type="button" className={styles.smallActionBtn} onClick={() => void loadUrsie()}>
                            Retry
                          </button>
                        </div>
                      )}
                      {['How is my voice?', 'What should I upload?', 'What patterns do you see?'].map((q) => (
                        <button key={q} type="button" className={styles.quickActionBtn} onClick={() => sendUrsieMessage(q)}>{q}</button>
                      ))}
                    </div>

                    <div className={styles.chatScroll} ref={chatRefMain}>
                      {ursieMessages.map((msg) => (
                        <div key={msg.id} className={msg.sender === 'user' ? styles.messageUser : styles.messageUrsie}>
                          {msg.message}
                        </div>
                      ))}
                      {ursieThinking && <div className={styles.messageUrsie}>Thinking...</div>}
                    </div>

                    <div className={styles.chatInputRow}>
                      <input
                        value={ursieInput}
                        onChange={(e) => setUrsieInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') sendUrsieMessage(ursieInput);
                        }}
                        className={styles.chatInput}
                        placeholder="Ask Ursie..."
                      />
                      <button
                        type="button"
                        className={styles.sendButton}
                        onClick={() => sendUrsieMessage(ursieInput)}
                        disabled={!ursieInput.trim() || ursieThinking}
                      >
                        Send
                      </button>
                    </div>
                  </div>

                  <aside className={styles.ursieObsPane}>
                    <p className={styles.sectionTitle}>OBSERVATIONS</p>

                    <div className={styles.observationScroll}>
                      {observationsLoadError && (
                        <div className={styles.uploadError}>
                          {observationsLoadError}
                          <button type="button" className={styles.smallActionBtn} onClick={() => void loadObservations()}>
                            Retry
                          </button>
                        </div>
                      )}
                      {ursieObservations.length === 0 ? (
                        <p className={styles.observationEmpty}>I am watching. I will share what I notice as your archive grows.</p>
                      ) : (
                        ursieObservations.map((item) => (
                          <article key={item.id} className={styles.observationItem}>
                            <p>{item.text}</p>
                            <div className={styles.observationMeta}>
                              <span>{item.chamber || 'general'}</span>
                              <span>{formatRelative(item.createdAt)}</span>
                            </div>
                          </article>
                        ))
                      )}
                    </div>

                    <div className={styles.tellRow}>
                      <input
                        value={manualMemoryInput}
                        onChange={(e) => setManualMemoryInput(e.target.value)}
                        className={styles.tellInput}
                        placeholder="Tell Ursie"
                      />
                      <button
                        type="button"
                        className={styles.smallActionBtn}
                        onClick={handleSaveMemory}
                        disabled={!manualMemoryInput.trim()}
                      >
                        Save
                      </button>
                    </div>
                  </aside>
                </div>
              </article>
            </section>
          )}

          {activeTab === 'upload' && (
            <section className={styles.tabContent}>
              <article className={`${styles.glassCard} ${styles.uploadTabCard}`}>
                <div className={styles.uploadGrid}>
                  <div>
                    <p className={styles.sectionTitle}>DEPOSIT WRITING</p>

                    <div className={styles.uploadPillRow}>
                      {chamberOrder.map((chamber) => (
                        <button
                          key={chamber.key}
                          type="button"
                          className={`${styles.uploadPill} ${selectedUploadChamber === chamber.key ? styles.uploadPillActive : ''}`}
                          onClick={() => {
                            setSelectedUploadChamber(chamber.key);
                            setHasSelectedChamber(true);
                          }}
                          disabled={uploading}
                        >
                          {chamber.label}
                        </button>
                      ))}
                    </div>

                    {showRoadmap && (
                      <ConfidenceRoadmap
                        documentCount={activeChamberStatus.documentCount}
                      />
                    )}

                    <div className={styles.uploadAssistStack}>
                      <GuidedUploadPrompts
                        chamber={selectedUploadChamber}
                        documentCount={activeChamberStatus.documentCount}
                        status={activeChamberStatus}
                      />
                      <QuickStartExercise
                        chamber={selectedUploadChamber}
                        show={showQuickStart}
                        onCompleted={handleQuickStartCompleted}
                      />
                    </div>

                    <div
                      id="upload-dropzone"
                      className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ''}`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      <p className={styles.dropIcon}>↑</p>
                      <p className={styles.dropTitle}>Drop a document here or click to browse</p>
                      <p className={styles.dropMeta}>PDF, DOCX, or TXT — 80+ words</p>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.docx,.pdf"
                        onChange={handleFileSelect}
                        className={styles.hiddenFileInput}
                        disabled={uploading}
                      />

                      <button
                        type="button"
                        className={styles.selectButton}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? 'Processing...' : 'Select Document'}
                      </button>
                    </div>

                    {uploadSuccess && (
                      <div className={styles.uploadFeedback}>
                        {uploadSuccess.isFirstDocument
                          ? `Got it. First document in your ${uploadSuccess.chamber} chamber.`
                          : `Got it. Your ${uploadSuccess.chamber} chamber just grew.`}
                      </div>
                    )}

                    {uploadError && <div className={styles.uploadError}>{uploadError}</div>}
                  </div>

                  <aside className={styles.uploadSidebar}>
                    <p className={styles.sectionTitle}>CHAMBER STATUS</p>

                    <div className={styles.statusList}>
                      {chamberOrder.map((chamber) => {
                        const count = chamberDocCounts[chamber.key];
                        const signalCount = chamberSignalCounts[chamber.key];
                        const displayStatus = getChamberDisplayStatus(chamber.key);

                        return (
                          <div key={chamber.key} className={styles.statusRow}>
                            <div className={styles.statusLeft}>
                              <span className={styles.statusDot} style={{ backgroundColor: `var(${chamber.colorVar})` }} />
                              <span>{chamber.label}</span>
                            </div>
                            <span className={styles.statusText}>
                              {count > 0 ? `${count} docs` : 'Empty'}
                              {signalCount > 0 ? ` • ${signalCount} signals` : ''}
                              {count > 0 || signalCount > 0 ? ` • ${getStatusLabel(displayStatus.state)}` : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className={styles.varietyNudge}>
                      <p>Ursie: {getVarietyNudge()}</p>
                      {epochsLoadError && (
                        <span className={styles.uploadError}>
                          {epochsLoadError}{' '}
                          <button type="button" className={styles.smallActionBtn} onClick={() => void loadEpochs()}>
                            Retry
                          </button>
                        </span>
                      )}
                    </div>
                  </aside>
                </div>
              </article>
            </section>
          )}
        </main>

        {ursieNotice && <div className={styles.noticeToast}>{ursieNotice}</div>}
      </div>

      <MomentumIndicator
        chamberLabel={chamberOrder.find((c) => c.key === selectedUploadChamber)?.label || 'General'}
        stateLabel={momentumStateLabel}
        observations={uploadObservations}
        visible={showMomentum}
        onDismiss={() => setShowMomentum(false)}
      />

      {shouldShowFloatingUrsie && (
        <div className={styles.floatingWrap}>
          {floatingUrsieOpen && (
            <div className={styles.floatingPanel}>
              <header className={styles.floatingHeader}>
                <div className={styles.ursieTitleWrap}>
                  <span className={styles.ursieAvatar}>U</span>
                  <div>
                    <p className={styles.ursieName}>Ursie</p>
                    <p className={styles.ursieSubtitle}>Always nearby</p>
                  </div>
                </div>
                <button type="button" className={styles.floatingClose} onClick={() => setFloatingUrsieOpen(false)}>✕</button>
              </header>

              <div className={styles.quickActionRow}>
                {['How is my voice?', 'What should I upload?'].map((q) => (
                  <button key={q} type="button" className={styles.quickActionBtn} onClick={() => sendUrsieMessage(q)}>{q}</button>
                ))}
              </div>

              <div className={styles.floatingChatScroll} ref={chatRefFloating}>
                {ursieMessages.map((msg) => (
                  <div key={`floating-${msg.id}`} className={msg.sender === 'user' ? styles.messageUser : styles.messageUrsie}>
                    {msg.message}
                  </div>
                ))}
                {ursieThinking && <div className={styles.messageUrsie}>Thinking...</div>}
              </div>

              <div className={styles.chatInputRow}>
                <input
                  value={ursieInput}
                  onChange={(e) => setUrsieInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sendUrsieMessage(ursieInput);
                  }}
                  className={styles.chatInput}
                  placeholder="Ask Ursie..."
                />
                <button
                  type="button"
                  className={styles.sendButton}
                  onClick={() => sendUrsieMessage(ursieInput)}
                  disabled={!ursieInput.trim() || ursieThinking}
                >
                  Send
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            className={`${styles.floatingBubble} ${floatingUrsieOpen ? styles.floatingBubbleActive : ''}`}
            onClick={() => setFloatingUrsieOpen((value) => !value)}
            aria-label="Open Ursie"
          >
            <span className={styles.floatingPulse} />
            <span className={styles.floatingLabel}>U</span>
          </button>
        </div>
      )}

      <DocumentDetailModal
        documentId={selectedDocumentId || ''}
        isOpen={showDocumentDetail}
        onClose={() => {
          setShowDocumentDetail(false);
          setSelectedDocumentId(null);
        }}
      />

      {timelineOpen && (
        <div className={styles.timelineModalOverlay} onClick={() => setTimelineOpen(false)}>
          <div className={styles.timelineModal} onClick={(e) => e.stopPropagation()}>
            <header className={styles.timelineModalHeader}>
              <div>
                <p className={styles.timelineModalTitle}>Voice Timeline</p>
                <p className={styles.timelineModalSub}>Recorded by Ursie</p>
              </div>
              <button type="button" className={styles.timelineModalClose} onClick={() => setTimelineOpen(false)}>✕</button>
            </header>

            <div className={styles.timelineModalBody}>
              {evolutionEvents.length === 0 ? (
                <p className={styles.observationEmpty}>No timeline entries yet. Add documents and keep writing in studios.</p>
              ) : (
                evolutionEvents.map((event) => (
                  <div key={`modal-${event.id}`} className={styles.timelineModalEntry}>
                    <span
                      className={styles.timelineModalDot}
                      style={{
                        backgroundColor:
                          event.type === 'milestone'
                            ? 'var(--accent)'
                            : event.type === 'insight'
                              ? 'var(--creative)'
                              : 'var(--academic)',
                      }}
                    />
                    <div className={styles.timelineModalEntryBody}>
                      <div className={styles.timelineModalEntryHead}>
                        <span>{event.date}</span>
                        <span>{event.type}</span>
                      </div>
                      <p>{event.text}</p>
                      {(event.documentName || event.chamber) && (
                        <div className={styles.timelineMetaPills}>
                          {event.documentName && (
                            <span className={styles.timelineMetaPill}>{event.documentName}</span>
                          )}
                          {event.chamber && (
                            <span className={styles.timelineMetaPill}>
                              {chamberOrder.find((c) => c.key === event.chamber)?.label || event.chamber}
                            </span>
                          )}
                        </div>
                      )}
                      {!!event.findings?.length && (
                        <ul className={styles.timelineFindings}>
                          {event.findings.map((finding, idx) => (
                            <li key={`${event.id}-finding-${idx}`}>{finding}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
