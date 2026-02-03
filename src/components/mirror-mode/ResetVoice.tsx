// ResetVoice.tsx
// Allows users to reset their voice profile and start fresh
'use client';

import { useState } from 'react';

interface ResetVoiceProps {
  onReset: () => Promise<void>;
  documentCount: number;
  disabled?: boolean;
}

export default function ResetVoice({ onReset, documentCount, disabled = false }: ResetVoiceProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleReset = async () => {
    if (confirmText !== 'RESET') {
      return;
    }

    setIsResetting(true);
    try {
      await onReset();
      setShowConfirm(false);
      setConfirmText('');
    } catch (error) {
      console.error('Failed to reset voice profile:', error);
    } finally {
      setIsResetting(false);
    }
  };

  if (showConfirm) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !isResetting) {
            setShowConfirm(false);
            setConfirmText('');
          }
        }}
      >
        <div
          style={{
            background: '#1a1a24',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: 440,
            width: '100%',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <h2
            style={{
              margin: '0 0 0.75rem',
              color: '#f0f0f5',
              fontSize: '1.25rem',
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            Reset Your Voice Profile?
          </h2>

          <p
            style={{
              color: 'rgba(240, 240, 245, 0.7)',
              margin: '0 0 1.5rem',
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            This will permanently delete your voice profile and all {documentCount} uploaded
            document{documentCount !== 1 ? 's' : ''}. ThinkWrite will forget everything it has
            learned about your writing style.
          </p>

          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <p
              style={{
                color: 'rgba(240, 240, 245, 0.6)',
                margin: '0 0 0.75rem',
                fontSize: '0.875rem',
              }}
            >
              Type <strong style={{ color: '#ef4444' }}>RESET</strong> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type RESET to confirm"
              disabled={isResetting}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0.375rem',
                color: '#f0f0f5',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => {
                setShowConfirm(false);
                setConfirmText('');
              }}
              disabled={isResetting}
              style={{
                flex: 1,
                padding: '0.875rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0.5rem',
                color: '#f0f0f5',
                cursor: isResetting ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              disabled={confirmText !== 'RESET' || isResetting}
              style={{
                flex: 1,
                padding: '0.875rem',
                background:
                  confirmText === 'RESET'
                    ? 'rgba(239, 68, 68, 0.9)'
                    : 'rgba(239, 68, 68, 0.3)',
                border: 'none',
                borderRadius: '0.5rem',
                color: 'white',
                cursor:
                  confirmText !== 'RESET' || isResetting ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                opacity: confirmText === 'RESET' ? 1 : 0.5,
              }}
            >
              {isResetting ? 'Resetting...' : 'Reset Everything'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '1rem',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h4
            style={{
              margin: '0 0 0.25rem',
              color: '#f0f0f5',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Start Fresh
          </h4>
          <p
            style={{
              margin: 0,
              color: 'rgba(240, 240, 245, 0.5)',
              fontSize: '0.75rem',
            }}
          >
            Reset your voice profile and upload new samples
          </p>
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={disabled}
          style={{
            padding: '0.5rem 1rem',
            background: 'transparent',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.375rem',
            color: disabled ? 'rgba(240, 240, 245, 0.3)' : '#ef4444',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '0.75rem',
            fontWeight: 500,
            transition: 'all 0.2s ease',
            opacity: disabled ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          Reset Voice
        </button>
      </div>
    </div>
  );
}
