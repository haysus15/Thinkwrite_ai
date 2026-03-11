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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showStrictPurgeConfirm, setShowStrictPurgeConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [purgeStep, setPurgeStep] = useState<1 | 2>(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleReset = async () => {
    if (confirmText !== 'RESET') {
      return;
    }

    setIsResetting(true);
    setActionError(null);
    try {
      await onReset();
      setShowResetConfirm(false);
      setConfirmText('');
      setActionNotice('Profile reset complete. A new learning epoch has started.');
    } catch (error) {
      console.error('Failed to reset voice profile:', error);
      setActionError('Could not reset your profile. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleStrictPurge = async () => {
    if (purgeConfirmText !== 'PURGE') {
      return;
    }

    setIsPurging(true);
    setActionError(null);
    try {
      const res = await fetch('/api/mirror-mode/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purge_mode: 'strict',
          confirmation: 'PURGE',
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Strict purge failed');
      }

      setShowStrictPurgeConfirm(false);
      setPurgeStep(1);
      setPurgeConfirmText('');
      setActionNotice('Strict purge complete. Mirror Mode data has been permanently erased.');
    } catch (error) {
      console.error('Failed to strict purge mirror mode:', error);
      setActionError('Could not complete strict purge. Please try again.');
    } finally {
      setIsPurging(false);
    }
  };

  if (showResetConfirm) {
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
            setShowResetConfirm(false);
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
            This resets your profile and starts a fresh learning epoch. Your {documentCount} uploaded
            document{documentCount !== 1 ? 's' : ''} will be hidden from active use.
          </p>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '0.5rem',
              padding: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            <p style={{ margin: '0 0 0.5rem', color: '#f0f0f5', fontSize: '0.8rem', fontWeight: 600 }}>
              What this does:
            </p>
            <p style={{ margin: '0.2rem 0', color: 'rgba(240, 240, 245, 0.75)', fontSize: '0.8rem' }}>
              — Your documents are archived, not deleted
            </p>
            <p style={{ margin: '0.2rem 0', color: 'rgba(240, 240, 245, 0.75)', fontSize: '0.8rem' }}>
              — Your voice profile is cleared and starts fresh
            </p>
            <p style={{ margin: '0.2rem 0', color: 'rgba(240, 240, 245, 0.75)', fontSize: '0.8rem' }}>
              — A new learning epoch begins
            </p>
            <p style={{ margin: '0.2rem 0', color: 'rgba(240, 240, 245, 0.75)', fontSize: '0.8rem' }}>
              — To erase all data, use Strict Purge below
            </p>
          </div>

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
                setShowResetConfirm(false);
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
              {isResetting ? 'Resetting...' : 'Reset Profile'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showStrictPurgeConfirm) {
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
          if (e.target === e.currentTarget && !isPurging) {
            setShowStrictPurgeConfirm(false);
            setPurgeStep(1);
            setPurgeConfirmText('');
          }
        }}
      >
        <div
          style={{
            background: '#1a1a24',
            border: '1px solid rgba(239, 68, 68, 0.45)',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: 460,
            width: '100%',
          }}
        >
          <h2 style={{ margin: '0 0 0.75rem', color: '#f0f0f5', fontSize: '1.2rem', fontWeight: 600 }}>
            Strict Purge
          </h2>

          {purgeStep === 1 ? (
            <>
              <p style={{ color: 'rgba(240, 240, 245, 0.75)', margin: '0 0 1rem', lineHeight: 1.6 }}>
                Strict Purge permanently erases all Mirror Mode data. This cannot be undone.
              </p>
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '0.5rem',
                  padding: '0.875rem',
                  marginBottom: '1rem',
                }}
              >
                <p style={{ margin: '0.2rem 0', color: 'rgba(240, 240, 245, 0.9)', fontSize: '0.82rem' }}>
                  — Documents
                </p>
                <p style={{ margin: '0.2rem 0', color: 'rgba(240, 240, 245, 0.9)', fontSize: '0.82rem' }}>
                  — Fingerprints
                </p>
                <p style={{ margin: '0.2rem 0', color: 'rgba(240, 240, 245, 0.9)', fontSize: '0.82rem' }}>
                  — Voice profile
                </p>
                <p style={{ margin: '0.2rem 0', color: 'rgba(240, 240, 245, 0.9)', fontSize: '0.82rem' }}>
                  — Learning history
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setShowStrictPurgeConfirm(false)}
                  disabled={isPurging}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '0.5rem',
                    color: '#f0f0f5',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => setPurgeStep(2)}
                  disabled={isPurging}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: 'rgba(239, 68, 68, 0.85)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  Continue
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ color: 'rgba(240, 240, 245, 0.75)', margin: '0 0 0.75rem', lineHeight: 1.6 }}>
                Type <strong style={{ color: '#ef4444' }}>PURGE</strong> to permanently erase all Mirror Mode
                data.
              </p>
              <input
                type="text"
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value)}
                placeholder="Type PURGE to confirm"
                disabled={isPurging}
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
                  marginBottom: '1rem',
                }}
              />
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => {
                    setPurgeStep(1);
                    setPurgeConfirmText('');
                  }}
                  disabled={isPurging}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '0.5rem',
                    color: '#f0f0f5',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleStrictPurge}
                  disabled={purgeConfirmText !== 'PURGE' || isPurging}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: purgeConfirmText === 'PURGE' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(239, 68, 68, 0.35)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    cursor: purgeConfirmText === 'PURGE' && !isPurging ? 'pointer' : 'not-allowed',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  {isPurging ? 'Purging...' : 'Permanently Erase Data'}
                </button>
              </div>
            </>
          )}
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
            Reset Profile
          </h4>
          <p
            style={{
              margin: 0,
              color: 'rgba(240, 240, 245, 0.5)',
              fontSize: '0.75rem',
            }}
          >
            Hide your current documents and start a new learning epoch
          </p>
        </div>
        <button
          onClick={() => {
            setShowResetConfirm(true);
            setActionError(null);
            setActionNotice(null);
          }}
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

      <div
        style={{
          marginTop: '0.75rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '0.75rem',
        }}
      >
        <p style={{ margin: '0 0 0.35rem', color: '#f0f0f5', fontSize: '0.75rem', fontWeight: 600 }}>
          What this does:
        </p>
        <p style={{ margin: '0.2rem 0', color: 'rgba(240, 240, 245, 0.65)', fontSize: '0.75rem' }}>
          — Your documents are archived, not deleted
        </p>
        <p style={{ margin: '0.2rem 0', color: 'rgba(240, 240, 245, 0.65)', fontSize: '0.75rem' }}>
          — Your voice profile is cleared and starts fresh
        </p>
        <p style={{ margin: '0.2rem 0', color: 'rgba(240, 240, 245, 0.65)', fontSize: '0.75rem' }}>
          — A new learning epoch begins
        </p>
        <p style={{ margin: '0.2rem 0', color: 'rgba(240, 240, 245, 0.65)', fontSize: '0.75rem' }}>
          — To erase all data, use Strict Purge below
        </p>
      </div>

      <div
        style={{
          marginTop: '0.75rem',
          borderTop: '1px solid rgba(239, 68, 68, 0.22)',
          paddingTop: '0.75rem',
        }}
      >
        <h4 style={{ margin: '0 0 0.25rem', color: '#ffb4b4', fontSize: '0.82rem', fontWeight: 600 }}>
          Strict Purge — permanently erase all Mirror Mode data
        </h4>
        <p
          style={{
            margin: '0 0 0.65rem',
            color: 'rgba(240, 240, 245, 0.62)',
            fontSize: '0.75rem',
            lineHeight: 1.5,
          }}
        >
          This permanently deletes your documents, fingerprints, voice profile, and learning history.
          It cannot be undone.
        </p>
        <button
          onClick={() => {
            setShowStrictPurgeConfirm(true);
            setPurgeStep(1);
            setPurgeConfirmText('');
            setActionError(null);
            setActionNotice(null);
          }}
          disabled={disabled}
          style={{
            padding: '0.5rem 1rem',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.45)',
            borderRadius: '0.375rem',
            color: disabled ? 'rgba(255, 180, 180, 0.45)' : '#ffb4b4',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '0.75rem',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          Open Strict Purge
        </button>
      </div>

      {actionError && (
        <p style={{ margin: '0.75rem 0 0', color: '#ff9b9b', fontSize: '0.75rem' }}>{actionError}</p>
      )}
      {actionNotice && (
        <p style={{ margin: '0.75rem 0 0', color: '#98e2b8', fontSize: '0.75rem' }}>{actionNotice}</p>
      )}
    </div>
  );
}
