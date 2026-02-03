// src/components/mirror-mode/LiveLearningFeed.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';

type LearningActivity = {
  id: string;
  source: string;
  source_label: string;
  word_count: number;
  title?: string;
  context?: string;
  created_at: string;
};

type LiveLearningSettings = {
  enabled: boolean;
  sources: {
    coverLetters: boolean;
    lexChat: boolean;
    resumeUploads: boolean;
    resumeBuilder: boolean;
    tailoredResumes: boolean;
  };
  notifyOnLearning: boolean;
};

const SOURCE_ABBREVS: Record<string, string> = {
  'cover-letter': 'CL',
  'lex-chat': 'LEX',
  'resume-upload': 'RES',
  'resume-builder': 'BLD',
  'tailored-resume': 'TAI',
  'manual-upload': 'UPL',
  'other': 'OTH',
};

const SOURCE_COLORS: Record<string, string> = {
  'cover-letter': '#8b5cf6',
  'lex-chat': '#06b6d4',
  'resume-upload': '#10b981',
  'resume-builder': '#f59e0b',
  'tailored-resume': '#ec4899',
  'manual-upload': '#6366f1',
  'other': '#64748b',
};

export default function LiveLearningFeed() {
  const [activity, setActivity] = useState<LearningActivity[]>([]);
  const [settings, setSettings] = useState<LiveLearningSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Fetch activity and settings
  const fetchData = useCallback(async () => {
    try {
      const [activityRes, settingsRes] = await Promise.all([
        fetch(`/api/mirror-mode/live-learn?limit=10`),
        fetch(`/api/mirror-mode/settings`),
      ]);

      const activityData = await activityRes.json();
      const settingsData = await settingsRes.json();

      if (activityData.success) {
        setActivity(activityData.activity || []);
      }
      if (settingsData.success) {
        setSettings(settingsData.settings);
      }
    } catch (e) {
      console.error('Failed to fetch live learning data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleToggleEnabled = async () => {
    if (!settings) return;
    setSavingSettings(true);

    const newSettings = { ...settings, enabled: !settings.enabled };

    try {
      const res = await fetch('/api/mirror-mode/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings }),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(newSettings);
      }
    } catch (e) {
      console.error('Failed to update settings:', e);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleSource = async (source: keyof LiveLearningSettings['sources']) => {
    if (!settings) return;
    setSavingSettings(true);

    const newSettings = {
      ...settings,
      sources: {
        ...settings.sources,
        [source]: !settings.sources[source],
      },
    };

    try {
      const res = await fetch('/api/mirror-mode/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings }),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(newSettings);
      }
    } catch (e) {
      console.error('Failed to update settings:', e);
    } finally {
      setSavingSettings(false);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="llf-container llf-loading">
        <div className="llf-loader"></div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="llf-container">
      {/* Header */}
      <div className="llf-header">
        <div className="llf-title-row">
          <div className="llf-title">
            <span className="llf-pulse"></span>
            Live Learning
          </div>
          <button
            className="llf-settings-btn"
            onClick={() => setShowSettings(!showSettings)}
          >
            {showSettings ? 'Hide' : 'Settings'}
          </button>
        </div>

        {/* Master Toggle */}
        <div className="llf-master-toggle">
          <span className="llf-toggle-label">
            {settings?.enabled ? 'Active' : 'Paused'}
          </span>
          <button
            className={`llf-toggle ${settings?.enabled ? 'llf-toggle-on' : ''}`}
            onClick={handleToggleEnabled}
            disabled={savingSettings}
          >
            <span className="llf-toggle-knob"></span>
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && settings && (
        <div className="llf-settings">
          <div className="llf-settings-title">Learning Sources</div>
          <div className="llf-sources">
            {[
              { key: 'coverLetters', label: 'Cover Letters', abbrev: 'CL' },
              { key: 'lexChat', label: 'Lex Conversations', abbrev: 'LEX' },
              { key: 'resumeUploads', label: 'Resume Uploads', abbrev: 'RES' },
              { key: 'resumeBuilder', label: 'Resume Builder', abbrev: 'BLD' },
              { key: 'tailoredResumes', label: 'Tailored Resumes', abbrev: 'TAI' },
            ].map((source) => (
              <label key={source.key} className="llf-source-item">
                <input
                  type="checkbox"
                  checked={settings.sources[source.key as keyof typeof settings.sources]}
                  onChange={() => handleToggleSource(source.key as keyof typeof settings.sources)}
                  disabled={savingSettings || !settings.enabled}
                />
                <span className="llf-source-abbrev">{source.abbrev}</span>
                <span className="llf-source-label">{source.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div className="llf-feed">
        {!settings?.enabled ? (
          <div className="llf-paused">
            <div className="llf-paused-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </div>
            <p>Live learning is paused</p>
            <p className="llf-paused-hint">Enable to automatically learn from your activity</p>
          </div>
        ) : activity.length === 0 ? (
          <div className="llf-empty">
            <p>No learning activity yet</p>
            <p className="llf-empty-hint">
              Your voice will be learned automatically as you use Career Studio, chat with Lex, and more.
            </p>
          </div>
        ) : (
          <ul className="llf-activity-list">
            {activity.map((item) => (
              <li key={item.id} className="llf-activity-item">
                <div
                  className="llf-activity-abbrev"
                  style={{
                    backgroundColor: `${SOURCE_COLORS[item.source] || '#64748b'}20`,
                    color: SOURCE_COLORS[item.source] || '#64748b',
                    borderColor: `${SOURCE_COLORS[item.source] || '#64748b'}40`
                  }}
                >
                  {SOURCE_ABBREVS[item.source] || 'OTH'}
                </div>
                <div className="llf-activity-content">
                  <div className="llf-activity-title">
                    {item.title || item.source_label || 'Learning Event'}
                  </div>
                  <div className="llf-activity-meta">
                    <span>{item.word_count} words</span>
                    <span className="llf-activity-dot">·</span>
                    <span>{formatTimeAgo(item.created_at)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .llf-container {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
    overflow: hidden;
  }

  .llf-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 150px;
  }

  .llf-loader {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: #06b6d4;
    border-radius: 50%;
    animation: llf-spin 0.8s linear infinite;
  }

  @keyframes llf-spin {
    to { transform: rotate(360deg); }
  }

  .llf-header {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .llf-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .llf-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #f0f0f5;
  }

  .llf-pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    animation: llf-pulse 2s ease-in-out infinite;
  }

  @keyframes llf-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  .llf-settings-btn {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.25rem;
    color: rgba(240, 240, 245, 0.6);
    cursor: pointer;
    transition: all 0.2s;
  }

  .llf-settings-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f0f0f5;
  }

  .llf-master-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .llf-toggle-label {
    font-size: 0.75rem;
    color: rgba(240, 240, 245, 0.6);
  }

  .llf-toggle {
    position: relative;
    width: 44px;
    height: 24px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .llf-toggle-on {
    background: #10b981;
  }

  .llf-toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .llf-toggle-on .llf-toggle-knob {
    transform: translateX(20px);
  }

  .llf-settings {
    padding: 1rem 1.25rem;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .llf-settings-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(240, 240, 245, 0.5);
    margin-bottom: 0.75rem;
  }

  .llf-sources {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .llf-source-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: rgba(240, 240, 245, 0.8);
    cursor: pointer;
  }

  .llf-source-item input {
    accent-color: #06b6d4;
  }

  .llf-source-abbrev {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    padding: 0.25rem 0.375rem;
    background: rgba(192, 192, 192, 0.15);
    border: 1px solid rgba(192, 192, 192, 0.25);
    border-radius: 0.25rem;
    color: #C0C0C0;
  }

  .llf-feed {
    padding: 1rem 1.25rem;
  }

  .llf-paused,
  .llf-empty {
    text-align: center;
    padding: 1.5rem 0;
    color: rgba(240, 240, 245, 0.6);
  }

  .llf-paused-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    margin: 0 auto 0.5rem;
    opacity: 0.5;
    color: rgba(240, 240, 245, 0.6);
  }

  .llf-paused p,
  .llf-empty p {
    margin: 0;
    font-size: 0.875rem;
  }

  .llf-paused-hint,
  .llf-empty-hint {
    font-size: 0.75rem !important;
    color: rgba(240, 240, 245, 0.4);
    margin-top: 0.25rem !important;
  }

  .llf-activity-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .llf-activity-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .llf-activity-abbrev {
    width: 36px;
    height: 36px;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    flex-shrink: 0;
    border: 1px solid;
  }

  .llf-activity-content {
    min-width: 0;
    flex: 1;
  }

  .llf-activity-title {
    font-size: 0.8rem;
    color: #f0f0f5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .llf-activity-meta {
    font-size: 0.7rem;
    color: rgba(240, 240, 245, 0.4);
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .llf-activity-dot {
    opacity: 0.5;
  }
`;
