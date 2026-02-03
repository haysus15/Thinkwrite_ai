// src/components/mirror-mode/DocumentDetailModal.tsx
// Document Detail Modal - Shows per-document analysis and fingerprint
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getWritingTypeAbbrev, getWritingTypeLabel } from '@/lib/mirror-mode/writingTypes';

type VoiceFingerprint = {
  vocabulary: {
    uniqueWordCount: number;
    avgWordLength: number;
    complexWordRatio: number;
    contractionRatio: number;
    topWords: string[];
    rarityScore: number;
  };
  rhythm: {
    avgSentenceLength: number;
    sentenceVariation: number;
    shortSentenceRatio: number;
    longSentenceRatio: number;
    avgParagraphLength: number;
    paragraphVariation: number;
  };
  punctuation: {
    exclamationRate: number;
    questionRate: number;
    semicolonRate: number;
    dashRate: number;
    ellipsisRate: number;
    colonRate: number;
    commaRate: number;
  };
  voice: {
    hedgeDensity: number;
    qualifierDensity: number;
    assertiveDensity: number;
    personalPronounRate: number;
    formalityScore: number;
    activeVoiceRatio: number;
  };
  rhetoric: {
    questionOpenerRate: number;
    transitionWordRate: number;
    listUsageRate: number;
    exampleUsageRate: number;
    emphasisPatterns: string[];
  };
  meta: {
    sampleWordCount: number;
    sampleSentenceCount: number;
    extractedAt: string;
    version: string;
  };
};

type DocumentDetail = {
  success: boolean;
  document: {
    id: string;
    fileName: string;
    writingType: string;
    wordCount: number;
    fileSize: number;
    mimeType: string;
    status: string;
    learnedAt: string | null;
    createdAt: string;
  };
  fingerprint: VoiceFingerprint | null;
  impact: {
    timestamp: string;
    documentId: string;
    documentName: string;
    writingType: string;
    changesMade: string[];
    confidenceDelta: number;
    confidenceLevel: number;
    totalWordCount: number;
    totalDocuments: number;
  } | null;
  textPreview: {
    text: string;
    totalWords: number;
    hasMore: boolean;
  };
};

type Props = {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
};

const writingTypeColors: Record<string, string> = {
  professional: '#3b82f6',
  academic: '#8b5cf6',
  creative: '#ec4899',
  personal: '#10b981',
  technical: '#f59e0b',
  other: '#6b7280',
};

export default function DocumentDetailModal({ documentId, isOpen, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DocumentDetail | null>(null);
  const [showFullText, setShowFullText] = useState(false);
  const isLiveArtifact = documentId.startsWith('live-lex-chat-');

  const fetchDocumentDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const safeId = encodeURIComponent(id);
      const res = await fetch(`/api/mirror-mode/document/${safeId}/detail`);
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (parseError) {
        throw new Error(`Unexpected response (${res.status}): ${text || 'No body'}`);
      }

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Failed to fetch document details (${res.status})`);
      }

      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && documentId) {
      if (isLiveArtifact) {
        setLoading(false);
        setData(null);
        setError('This is a live chat artifact and has no document details.');
        return;
      }
      fetchDocumentDetail(documentId);
      setShowFullText(false);
    }
  }, [isOpen, documentId, fetchDocumentDetail, isLiveArtifact]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatChange = (change: string) => {
    return change.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const doc = data?.document;
  const fp = data?.fingerprint;
  const impact = data?.impact;
  const typeKey = doc?.writingType || 'other';
  const typeLabel = getWritingTypeLabel(typeKey);
  const typeAbbrev = getWritingTypeAbbrev(typeKey);
  const typeColor = writingTypeColors[typeKey] || writingTypeColors.other;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="close-btn" onClick={onClose} aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading document details...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <span className="error-icon">⚠</span>
            <h3>{isLiveArtifact ? 'No document details' : 'Error Loading Document'}</h3>
            <p>{error}</p>
            {!isLiveArtifact && (
              <button onClick={() => fetchDocumentDetail(documentId)} className="retry-btn">
                Try Again
              </button>
            )}
          </div>
        ) : data && doc ? (
          <div className="modal-content">
            {/* Header */}
            <div className="modal-header">
              <div className="header-abbrev" style={{ background: `${typeColor}20`, color: typeColor }}>{typeAbbrev}</div>
              <div className="header-info">
                <h2 className="document-name">{doc.fileName}</h2>
                <div className="header-meta">
                  <span
                    className="type-badge"
                    style={{ background: `${typeColor}20`, color: typeColor }}
                  >
                    {typeLabel}
                  </span>
                  <span className="upload-date">{formatDate(doc.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="metadata-grid">
              <div className="meta-item">
                <span className="meta-value">{doc.wordCount.toLocaleString()}</span>
                <span className="meta-label">Words</span>
              </div>
              <div className="meta-item">
                <span className="meta-value">{formatFileSize(doc.fileSize)}</span>
                <span className="meta-label">File Size</span>
              </div>
              <div className="meta-item">
                <span className={`meta-value status-${doc.status}`}>
                  {doc.status === 'learned' ? 'Learned' : 'Pending'}
                </span>
                <span className="meta-label">Status</span>
              </div>
            </div>

            {/* Fingerprint Analysis */}
            {fp && (
              <div className="section">
                <h3 className="section-title">Writing Analysis</h3>

                <div className="analysis-grid">
                  {/* Formality Meter */}
                  <div className="meter-item">
                    <div className="meter-header">
                      <span className="meter-label">Tone</span>
                      <span className="meter-value">
                        {fp.voice.formalityScore > 0.65 ? 'Formal' :
                          fp.voice.formalityScore < 0.35 ? 'Casual' : 'Balanced'}
                      </span>
                    </div>
                    <div className="meter-track">
                      <div
                        className="meter-fill"
                        style={{ width: `${fp.voice.formalityScore * 100}%` }}
                      />
                    </div>
                    <div className="meter-labels">
                      <span>Casual</span>
                      <span>Formal</span>
                    </div>
                  </div>

                  {/* Sentence Length Meter */}
                  <div className="meter-item">
                    <div className="meter-header">
                      <span className="meter-label">Sentences</span>
                      <span className="meter-value">
                        {fp.rhythm.avgSentenceLength > 20 ? 'Long' :
                          fp.rhythm.avgSentenceLength < 12 ? 'Short' : 'Medium'}
                      </span>
                    </div>
                    <div className="meter-track">
                      <div
                        className="meter-fill"
                        style={{ width: `${Math.min(100, (fp.rhythm.avgSentenceLength / 30) * 100)}%` }}
                      />
                    </div>
                    <div className="meter-labels">
                      <span>Short</span>
                      <span>Long</span>
                    </div>
                  </div>

                  {/* Vocabulary Complexity */}
                  <div className="meter-item">
                    <div className="meter-header">
                      <span className="meter-label">Vocabulary</span>
                      <span className="meter-value">
                        {fp.vocabulary.complexWordRatio > 0.15 ? 'Sophisticated' :
                          fp.vocabulary.complexWordRatio < 0.08 ? 'Simple' : 'Moderate'}
                      </span>
                    </div>
                    <div className="meter-track">
                      <div
                        className="meter-fill"
                        style={{ width: `${Math.min(100, fp.vocabulary.complexWordRatio * 400)}%` }}
                      />
                    </div>
                    <div className="meter-labels">
                      <span>Simple</span>
                      <span>Complex</span>
                    </div>
                  </div>

                  {/* Confidence/Assertiveness */}
                  <div className="meter-item">
                    <div className="meter-header">
                      <span className="meter-label">Style</span>
                      <span className="meter-value">
                        {fp.voice.assertiveDensity > 0.008 ? 'Confident' :
                          fp.voice.hedgeDensity > 0.015 ? 'Nuanced' : 'Neutral'}
                      </span>
                    </div>
                    <div className="meter-track">
                      <div
                        className="meter-fill"
                        style={{
                          width: `${Math.min(100, Math.max(
                            fp.voice.assertiveDensity * 5000,
                            50 - fp.voice.hedgeDensity * 2000
                          ))}%`
                        }}
                      />
                    </div>
                    <div className="meter-labels">
                      <span>Hedging</span>
                      <span>Assertive</span>
                    </div>
                  </div>
                </div>

                {/* Style Traits */}
                <div className="traits-section">
                  <h4 className="traits-title">Detected Traits</h4>
                  <div className="traits-list">
                    {fp.voice.personalPronounRate > 0.04 && (
                      <span className="trait-tag">Personal Voice</span>
                    )}
                    {fp.vocabulary.contractionRatio > 0.02 && (
                      <span className="trait-tag">Uses Contractions</span>
                    )}
                    {fp.punctuation.dashRate > 0.01 && (
                      <span className="trait-tag">Dash Emphasis</span>
                    )}
                    {fp.punctuation.questionRate > 0.08 && (
                      <span className="trait-tag">Rhetorical Questions</span>
                    )}
                    {fp.rhetoric.transitionWordRate > 0.15 && (
                      <span className="trait-tag">Logical Flow</span>
                    )}
                    {fp.voice.activeVoiceRatio > 0.7 && (
                      <span className="trait-tag">Active Voice</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Impact on Profile */}
            {impact && (
              <div className="section">
                <h3 className="section-title">Impact on Voice Profile</h3>

                <div className="impact-card">
                  <div className="impact-stats">
                    <div className="impact-stat">
                      <span className={`impact-value ${impact.confidenceDelta >= 0 ? 'positive' : 'negative'}`}>
                        {impact.confidenceDelta >= 0 ? '+' : ''}{impact.confidenceDelta.toFixed(1)}%
                      </span>
                      <span className="impact-label">Confidence Change</span>
                    </div>
                    <div className="impact-stat">
                      <span className="impact-value">{impact.confidenceLevel}%</span>
                      <span className="impact-label">Total Confidence</span>
                    </div>
                    <div className="impact-stat">
                      <span className="impact-value">#{impact.totalDocuments}</span>
                      <span className="impact-label">Document Number</span>
                    </div>
                  </div>

                  {impact.changesMade && impact.changesMade.length > 0 && (
                    <div className="changes-section">
                      <span className="changes-label">What Changed:</span>
                      <div className="changes-tags">
                        {impact.changesMade.map((change, i) => (
                          <span key={i} className="change-tag">
                            {formatChange(change)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Text Preview */}
            {data.textPreview && data.textPreview.text && (
              <div className="section">
                <div className="section-header">
                  <h3 className="section-title">Text Preview</h3>
                  <span className="word-count">{data.textPreview.totalWords} words</span>
                </div>

                <div className={`text-preview ${showFullText ? 'expanded' : ''}`}>
                  <p>{data.textPreview.text}</p>
                  {data.textPreview.hasMore && !showFullText && (
                    <div className="text-fade" />
                  )}
                </div>

                {data.textPreview.hasMore && (
                  <button
                    className="show-more-btn"
                    onClick={() => setShowFullText(!showFullText)}
                  >
                    {showFullText ? 'Show Less' : 'Show More'}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-container {
          position: relative;
          width: 100%;
          max-width: 700px;
          max-height: 90vh;
          background: #0a0a0f;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.25rem;
          overflow: hidden;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .close-btn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 10;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        /* Loading & Error States */
        .loading-state,
        .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          text-align: center;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(192, 192, 192, 0.2);
          border-top-color: #C0C0C0;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .error-state h3 {
          margin: 0 0 0.5rem;
          color: #fff;
        }

        .error-state p {
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 1.5rem;
        }

        .retry-btn {
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #C0C0C0, #A9A9A9);
          color: #000;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
        }

        /* Modal Content */
        .modal-content {
          padding: 2rem;
          overflow-y: auto;
          max-height: 90vh;
        }

        /* Header */
        .modal-header {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1.5rem;
          padding-right: 3rem;
        }

        .header-abbrev {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          flex-shrink: 0;
        }

        .header-info {
          flex: 1;
          min-width: 0;
        }

        .document-name {
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
          margin: 0 0 0.5rem;
          word-break: break-word;
        }

        .header-meta {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .type-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .upload-date {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Metadata Grid */
        .metadata-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          padding: 1.25rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .meta-item {
          text-align: center;
        }

        .meta-value {
          display: block;
          font-size: 1.25rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 0.25rem;
        }

        .meta-value.status-learned {
          color: #10b981;
        }

        .meta-value.status-pending,
        .meta-value.status-uploaded {
          color: #f59e0b;
        }

        .meta-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Sections */
        .section {
          margin-bottom: 1.5rem;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .section-title {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 1rem;
        }

        .word-count {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.4);
        }

        /* Analysis Grid */
        .analysis-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .meter-item {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 0.5rem;
        }

        .meter-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .meter-label {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.6);
        }

        .meter-value {
          font-size: 0.8rem;
          font-weight: 600;
          color: #fff;
        }

        .meter-track {
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .meter-fill {
          height: 100%;
          background: linear-gradient(90deg, #C0C0C0, #8b5cf6);
          border-radius: 3px;
          transition: width 0.5s ease;
        }

        .meter-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.6rem;
          color: rgba(255, 255, 255, 0.4);
        }

        /* Traits */
        .traits-section {
          padding-top: 0.5rem;
        }

        .traits-title {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 0.75rem;
        }

        .traits-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .trait-tag {
          padding: 0.375rem 0.75rem;
          background: rgba(139, 92, 246, 0.15);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 1rem;
          font-size: 0.75rem;
          color: #a78bfa;
        }

        /* Impact Card */
        .impact-card {
          padding: 1.25rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.75rem;
        }

        .impact-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .impact-stat {
          text-align: center;
        }

        .impact-value {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 0.25rem;
        }

        .impact-value.positive {
          color: #10b981;
        }

        .impact-value.negative {
          color: #ef4444;
        }

        .impact-label {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.5);
        }

        .changes-section {
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .changes-label {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.5);
          display: block;
          margin-bottom: 0.5rem;
        }

        .changes-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
        }

        .change-tag {
          padding: 0.25rem 0.625rem;
          background: rgba(192, 192, 192, 0.1);
          border-radius: 0.25rem;
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.7);
        }

        /* Text Preview */
        .text-preview {
          position: relative;
          padding: 1.25rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 0.5rem;
          max-height: 200px;
          overflow: hidden;
        }

        .text-preview.expanded {
          max-height: none;
        }

        .text-preview p {
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.7;
          color: rgba(255, 255, 255, 0.75);
          white-space: pre-wrap;
        }

        .text-fade {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: linear-gradient(transparent, rgba(10, 10, 15, 1));
          pointer-events: none;
        }

        .show-more-btn {
          margin-top: 0.75rem;
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.375rem;
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .show-more-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        /* Responsive */
        @media (max-width: 640px) {
          .modal-overlay {
            padding: 1rem;
          }

          .modal-content {
            padding: 1.5rem;
          }

          .metadata-grid {
            grid-template-columns: 1fr;
          }

          .analysis-grid {
            grid-template-columns: 1fr;
          }

          .impact-stats {
            grid-template-columns: 1fr;
          }

          .document-name {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
}
