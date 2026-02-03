// DocumentList.tsx
// Displays uploaded documents with delete capability for managing voice training samples
'use client';

import { useState } from 'react';
import { getWritingTypeAbbrev, getWritingTypeLabel } from '@/lib/mirror-mode/writingTypes';

export interface MirrorDocument {
  id: string;
  filename: string;
  writing_type: string;
  word_count: number;
  file_size: number;
  uploaded_at: string;
  analyzed: boolean;
}

interface DocumentListProps {
  documents: MirrorDocument[];
  onDelete: (documentId: string) => Promise<void>;
  isLoading?: boolean;
}

export default function DocumentList({ documents, onDelete, isLoading = false }: DocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDelete = async (docId: string) => {
    if (confirmDelete !== docId) {
      setConfirmDelete(docId);
      return;
    }

    setDeletingId(docId);
    try {
      await onDelete(docId);
    } catch (error) {
      console.error('Failed to delete document:', error);
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (isLoading) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'rgba(240, 240, 245, 0.5)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: '2px solid rgba(255,255,255,0.1)',
            borderTopColor: '#06b6d4',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem',
          }}
        />
        Loading documents...
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'rgba(240, 240, 245, 0.5)',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '0.75rem',
          border: '1px dashed rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{
              width: '48px',
              height: '48px',
              background: 'rgba(192, 192, 192, 0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(192, 192, 192, 0.6)" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
        <p style={{ margin: 0 }}>No documents yet</p>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem' }}>
          Upload your first writing sample to begin
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '1rem',
            color: '#f0f0f5',
            fontWeight: 500,
          }}
        >
          Your Writing Samples
        </h3>
        <span
          style={{
            fontSize: '0.75rem',
            color: 'rgba(240, 240, 245, 0.5)',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '0.25rem 0.75rem',
            borderRadius: '1rem',
          }}
        >
          {documents.length} {documents.length === 1 ? 'document' : 'documents'}
        </span>
      </div>

      {documents.map((doc) => (
        <div
          key={doc.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '0.75rem',
            transition: 'all 0.2s ease',
            opacity: deletingId === doc.id ? 0.5 : 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
            <div
              style={{
                width: 40,
                height: 40,
                background: 'rgba(192, 192, 192, 0.1)',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: '#C0C0C0',
                border: '1px solid rgba(192, 192, 192, 0.25)',
              }}
            >
              {getWritingTypeAbbrev(doc.writing_type)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  color: '#f0f0f5',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {doc.filename}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  fontSize: '0.75rem',
                  color: 'rgba(240, 240, 245, 0.5)',
                  marginTop: '0.25rem',
                }}
              >
                <span>{getWritingTypeLabel(doc.writing_type)}</span>
                <span>•</span>
                <span>{doc.word_count.toLocaleString()} words</span>
                {doc.file_size > 0 && (
                  <>
                    <span>•</span>
                    <span>{formatFileSize(doc.file_size)}</span>
                  </>
                )}
                <span>•</span>
                <span>{formatDate(doc.uploaded_at)}</span>
                {doc.analyzed && (
                  <>
                    <span>•</span>
                    <span style={{ color: '#10b981' }}>✓ Analyzed</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {confirmDelete === doc.id ? (
              <>
                <button
                  onClick={() => setConfirmDelete(null)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '0.375rem',
                    color: 'rgba(240, 240, 245, 0.7)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    borderRadius: '0.375rem',
                    color: '#ef4444',
                    cursor: deletingId === doc.id ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                  }}
                >
                  {deletingId === doc.id ? 'Deleting...' : 'Confirm'}
                </button>
              </>
            ) : (
              <button
                onClick={() => handleDelete(doc.id)}
                style={{
                  padding: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '0.375rem',
                  color: 'rgba(240, 240, 245, 0.4)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(240, 240, 245, 0.4)';
                  e.currentTarget.style.background = 'transparent';
                }}
                title="Delete document"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
