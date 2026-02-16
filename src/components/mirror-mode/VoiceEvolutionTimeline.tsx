// src/components/mirror-mode/VoiceEvolutionTimeline.tsx
// Voice Evolution Timeline - Collapsible stats with expandable graph + event feed
'use client';

import { useState, useMemo } from 'react';
import { getWritingTypeAbbrev, getWritingTypeLabel } from '@/lib/mirror-mode/writingTypes';

export type VoiceEvolution = {
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
  epochs?: Array<{
    id: string;
    epoch_number: number | null;
    started_at: string;
    ended_at: string | null;
    reason: string | null;
    archived_profile_data?: any;
  }>;
};

// Confidence milestones (labels only; no percentages displayed)
const milestones = [
  { value: 25, label: 'Learning' },
  { value: 45, label: 'Developing' },
  { value: 65, label: 'Confident' },
  { value: 85, label: 'Mastered' },
];

export default function VoiceEvolutionTimeline({
  currentConfidence,
  documentCount,
  totalWords,
  evolutionHistory,
  onDocumentClick,
  epochs = [],
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'epochs'>('timeline');
  const confidenceLabel =
    milestones.find((m) => currentConfidence < m.value)?.label ||
    milestones[milestones.length - 1].label;

  // Sort evolution history by timestamp
  const sortedHistory = useMemo(() => {
    return [...evolutionHistory].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [evolutionHistory]);

  // Calculate graph points
  const graphData = useMemo(() => {
    if (sortedHistory.length === 0) return [];

    return sortedHistory.map((entry, index) => ({
      ...entry,
      x: sortedHistory.length === 1 ? 50 : (index / (sortedHistory.length - 1)) * 100,
      y: 100 - entry.confidenceLevel, // Invert for SVG coords
    }));
  }, [sortedHistory]);

  const epochMarkers = useMemo(() => {
    if (!epochs || epochs.length === 0 || sortedHistory.length === 0) return [];
    const minTime = new Date(sortedHistory[0].timestamp).getTime();
    const maxTime = new Date(sortedHistory[sortedHistory.length - 1].timestamp).getTime();
    if (maxTime <= minTime) return [];
    return epochs
      .filter((e) => e.started_at)
      .map((epoch) => {
        const t = new Date(epoch.started_at).getTime();
        const x = ((t - minTime) / (maxTime - minTime)) * 100;
        return {
          id: epoch.id,
          epoch_number: epoch.epoch_number,
          x: Math.max(0, Math.min(100, x)),
        };
      })
      .filter((m) => m.x >= 0 && m.x <= 100);
  }, [epochs, sortedHistory]);

  // Format date for display
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const epochData = useMemo(() => {
    if (!epochs || epochs.length === 0) return [];
    return [...epochs]
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
      .map((epoch, index, list) => {
        const snapshot = epoch.archived_profile_data || {};
        const chambers = snapshot?.chambers || [];
        const previous = index > 0 ? list[index - 1] : null;
        const prevSnapshot = previous?.archived_profile_data || null;
        const prevChambers = prevSnapshot?.chambers || [];
        const deltaMap = ['career', 'academic', 'creative', 'general'].map((key) => {
          const curr = chambers.find((c: any) => c.chamber === key) || {};
          const prev = prevChambers.find((c: any) => c.chamber === key) || {};
          const currCount = curr.document_count || 0;
          const prevCount = prev.document_count || 0;
          return {
            chamber: key,
            delta: currCount - prevCount,
            current: currCount,
          };
        });
        return {
          ...epoch,
          deltaMap,
        };
      });
  }, [epochs]);

  // Format change tags for display
  const formatChange = (change: string) => {
    return change.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const isLiveArtifact = (documentId: string) => documentId.startsWith('live-') || documentId.startsWith('capture-');
  const getSourceLabel = (documentId: string) => (isLiveArtifact(documentId) ? 'Studio capture' : 'Upload');
  const getDisplayName = (name: string, writingType: string) => {
    if (name && name !== 'Unknown') return name;
    return `${getWritingTypeAbbrev(writingType)} Sample`;
  };
  const getChamberLabel = (writingType: string) => {
    if (writingType === 'professional') return 'Career';
    if (writingType === 'academic') return 'Academic';
    if (writingType === 'creative') return 'Creative';
    if (writingType === 'general') return 'General';
    return 'General';
  };

  return (
    <div className="timeline-container">
      {/* Collapsed Quick Stats Bar */}
      <div className="stats-bar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="stat-group">
          <div className="stat">
            <div className="stat-value">{confidenceLabel}</div>
            <div className="stat-label">Voice Strength</div>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <div className="stat-value">{documentCount}</div>
            <div className="stat-label">Documents</div>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <div className="stat-value">{(totalWords / 1000).toFixed(1)}k</div>
            <div className="stat-label">Words</div>
          </div>
        </div>

        <button className="expand-btn" aria-expanded={isExpanded}>
          <span>{isExpanded ? 'Hide Timeline' : 'View Timeline'}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={isExpanded ? 'rotated' : ''}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="expanded-content">
          <div className="view-toggle">
            <button
              className={viewMode === 'timeline' ? 'toggle active' : 'toggle'}
              type="button"
              onClick={() => setViewMode('timeline')}
            >
              Timeline
            </button>
            <button
              className={viewMode === 'epochs' ? 'toggle active' : 'toggle'}
              type="button"
              onClick={() => setViewMode('epochs')}
            >
              Epoch Deltas
            </button>
          </div>

          {viewMode === 'epochs' && (
            <div className="epoch-view">
              <h4 className="graph-title">Chamber Deltas by Epoch</h4>
              {epochData.length === 0 ? (
                <div className="empty-graph">No epoch snapshots yet.</div>
              ) : (
                <div className="epoch-grid">
                  {epochData.map((epoch) => (
                    <div key={epoch.id} className="epoch-card">
                      <div className="epoch-title">
                        {epoch.epoch_number ? `Epoch ${epoch.epoch_number}` : 'Epoch'}
                      </div>
                      <div className="epoch-date">{formatDate(epoch.started_at)}</div>
                      <div className="epoch-chambers">
                        {epoch.deltaMap.map((row) => (
                          <div key={row.chamber} className="epoch-row">
                            <span className="epoch-label">{row.chamber}</span>
                            <span className="epoch-delta">
                              {row.delta >= 0 ? `+${row.delta}` : row.delta}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === 'timeline' && (
          <>
          {/* Graph Section */}
          <div className="graph-section">
            <h4 className="graph-title">Voice Evolution Over Time</h4>

            {graphData.length > 0 ? (
              <div className="graph-wrapper">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="graph">
                  {/* Milestone lines */}
                  {milestones.map((m) => (
                    <g key={m.value}>
                      <line
                        x1="0"
                        y1={100 - m.value}
                        x2="100"
                        y2={100 - m.value}
                        className="milestone-line"
                      />
                      <text
                        x="2"
                        y={100 - m.value - 1}
                        className="milestone-label"
                      >
                        {m.label}
                      </text>
                    </g>
                  ))}

                  {/* Epoch markers */}
                  {epochMarkers.map((marker) => (
                    <g key={marker.id}>
                      <line
                        x1={marker.x}
                        y1="0"
                        x2={marker.x}
                        y2="100"
                        className="epoch-marker"
                      />
                      {marker.epoch_number && (
                        <text x={marker.x + 1} y="6" className="epoch-label">
                          E{marker.epoch_number}
                        </text>
                      )}
                      <title>{marker.epoch_number ? `Epoch ${marker.epoch_number}` : 'Epoch'}</title>
                    </g>
                  ))}

                  {/* Gradient fill under the line */}
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(192, 192, 192, 0.3)" />
                      <stop offset="100%" stopColor="rgba(192, 192, 192, 0)" />
                    </linearGradient>
                  </defs>

                  {/* Area fill */}
                  {graphData.length > 1 && (
                    <path
                      d={`
                        M ${graphData[0].x} ${graphData[0].y}
                        ${graphData.map(p => `L ${p.x} ${p.y}`).join(' ')}
                        L ${graphData[graphData.length - 1].x} 100
                        L ${graphData[0].x} 100
                        Z
                      `}
                      fill="url(#areaGradient)"
                    />
                  )}

                  {/* Line path */}
                  {graphData.length > 1 && (
                    <polyline
                      points={graphData.map(p => `${p.x},${p.y}`).join(' ')}
                      className="graph-line"
                      fill="none"
                    />
                  )}

                  {/* Data points */}
                  {graphData.map((point, index) => (
                    <circle
                      key={index}
                      cx={point.x}
                      cy={point.y}
                      r="2"
                      className="graph-point"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isLiveArtifact(point.documentId)) {
                          onDocumentClick(point.documentId);
                        }
                      }}
                    />
                  ))}
                </svg>

                {/* X-axis labels */}
                <div className="x-axis-labels">
                  {graphData.length > 0 && (
                    <>
                      <span>{formatDate(graphData[0].timestamp)}</span>
                      {graphData.length > 2 && (
                        <span>{formatDate(graphData[Math.floor(graphData.length / 2)].timestamp)}</span>
                      )}
                      {graphData.length > 1 && (
                        <span>{formatDate(graphData[graphData.length - 1].timestamp)}</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-graph">
                <p>No evolution data yet. Upload documents to see your progress.</p>
              </div>
            )}
          </div>

          {/* Event Feed */}
          <div className="event-feed">
            <h4 className="feed-title">Learning History</h4>

            {sortedHistory.length > 0 ? (
              <div className="events-list">
                {[...sortedHistory].reverse().map((event, index) => (
                  <div
                    key={`${event.documentId}-${index}`}
                    className="event-item"
                    onClick={() => {
                      const nextId =
                        expandedEventId === event.documentId ? null : event.documentId;
                      setExpandedEventId(nextId);
                    }}
                  >
                    <div className="event-abbrev">
                      {getWritingTypeAbbrev(event.writingType)}
                    </div>

                    <div className="event-content">
                      <div className="event-header">
                        <span className="event-name">
                          {getDisplayName(event.documentName, event.writingType)}
                        </span>
                        <span className="event-date">{formatDate(event.timestamp)}</span>
                      </div>

                      <div className="event-meta">
                        <span className="confidence-change neutral">Voice shift recorded</span>
                        <span className="confidence-total">{getSourceLabel(event.documentId)}</span>
                        <span className="confidence-total">{getWritingTypeLabel(event.writingType)}</span>
                        <span className="confidence-total">{getChamberLabel(event.writingType)} chamber</span>
                        {event.changesMade && event.changesMade.length > 0 && (
                          <span className="confidence-total">{event.changesMade.slice(0, 1).join(', ')}</span>
                        )}
                      </div>

                      {event.changesMade && event.changesMade.length > 0 && (
                        <div className="event-tags">
                          {event.changesMade.slice(0, 3).map((change, i) => (
                            <span key={i} className="change-tag">
                              {formatChange(change)}
                            </span>
                          ))}
                        </div>
                      )}

                      {expandedEventId === event.documentId && (
                        <div className="event-details">
                          <div className="event-details-title">Learning Snapshot</div>
                          <div className="event-details-grid">
                            <div className="event-detail">
                              <span className="event-detail-label">Source</span>
                              <span className="event-detail-value">
                                {getWritingTypeLabel(event.writingType)}
                              </span>
                            </div>
                            <div className="event-detail">
                              <span className="event-detail-label">Voice Shift</span>
                              <span className="event-detail-value">Recorded</span>
                            </div>
                            <div className="event-detail">
                              <span className="event-detail-label">Total Documents</span>
                              <span className="event-detail-value">
                                {event.totalDocuments}
                              </span>
                            </div>
                            <div className="event-detail">
                              <span className="event-detail-label">Chamber Delta</span>
                              <span className="event-detail-value">
                                {getChamberLabel(event.writingType)} +1 doc
                              </span>
                            </div>
                            <div className="event-detail">
                              <span className="event-detail-label">Total Words</span>
                              <span className="event-detail-value">
                                {event.totalWordCount.toLocaleString()}
                              </span>
                            </div>
                          </div>
                          {event.changesMade && event.changesMade.length > 0 && (
                            <div className="event-changes">
                              <div className="event-changes-label">Pattern changes</div>
                              <div className="change-tags">
                                {event.changesMade.map((change, i) => (
                                  <span key={i} className="change-tag">
                                    {formatChange(change)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {!isLiveArtifact(event.documentId) && (
                            <button
                              className="event-view-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDocumentClick(event.documentId);
                              }}
                            >
                              View document details
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className={`event-arrow ${expandedEventId === event.documentId ? 'expanded' : ''}`}>
                      ▾
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-feed">
                <p>No learning events yet.</p>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      )}

      <style jsx>{`
        .timeline-container {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1rem;
          overflow: hidden;
        }

        /* Stats Bar */
        .stats-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          cursor: pointer;
          transition: background 0.2s ease;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .stats-bar:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .stat-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .stat {
          text-align: center;
        }

        .stat-value {
          font-size: 1.25rem;
          font-weight: 700;
          color: #fff;
        }

        .stat-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 0.25rem;
        }

        .stat-divider {
          width: 1px;
          height: 24px;
          background: rgba(255, 255, 255, 0.1);
        }

        .expand-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: rgba(192, 192, 192, 0.1);
          border: 1px solid rgba(192, 192, 192, 0.2);
          border-radius: 0.5rem;
          color: #C0C0C0;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .expand-btn:hover {
          background: rgba(192, 192, 192, 0.15);
          border-color: rgba(192, 192, 192, 0.3);
        }

        .expand-btn svg {
          transition: transform 0.3s ease;
        }

        .expand-btn svg.rotated {
          transform: rotate(180deg);
        }

        /* Expanded Content */
        .expanded-content {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding: 1.5rem;
          animation: slideDown 0.3s ease;
        }

        .view-toggle {
          display: flex;
          gap: 0.4rem;
          margin-bottom: 1rem;
        }

        .toggle {
          border: 1px solid rgba(192, 192, 192, 0.2);
          background: transparent;
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 0.35rem 0.75rem;
          border-radius: 999px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .toggle.active {
          background: rgba(192, 192, 192, 0.2);
          color: #fff;
          border-color: rgba(192, 192, 192, 0.4);
        }

        .epoch-grid {
          display: grid;
          gap: 0.75rem;
        }

        .epoch-card {
          padding: 0.75rem;
          border-radius: 0.75rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .epoch-title {
          font-size: 0.8rem;
          font-weight: 600;
          color: #fff;
        }

        .epoch-date {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 0.4rem;
        }

        .epoch-chambers {
          display: grid;
          gap: 0.3rem;
        }

        .epoch-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.7);
        }

        .epoch-label {
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .epoch-delta {
          font-weight: 600;
          color: #c0c0c0;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Graph Section */
        .graph-section {
          margin-bottom: 2rem;
        }

        .graph-title,
        .feed-title {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 1rem;
        }

        .graph-wrapper {
          position: relative;
        }

        .graph {
          width: 100%;
          height: 200px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 0.5rem;
        }

        .graph :global(.milestone-line) {
          stroke: rgba(255, 255, 255, 0.1);
          stroke-width: 0.3;
          stroke-dasharray: 2, 2;
        }

        .graph :global(.milestone-label) {
          font-size: 3px;
          fill: rgba(255, 255, 255, 0.4);
        }

        .graph :global(.epoch-marker) {
          stroke: rgba(255, 255, 255, 0.15);
          stroke-width: 0.4;
          stroke-dasharray: 1, 2;
        }

        .graph :global(.epoch-label) {
          font-size: 3px;
          fill: rgba(255, 255, 255, 0.35);
        }

        .graph :global(.graph-line) {
          stroke: #C0C0C0;
          stroke-width: 0.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .graph :global(.graph-point) {
          fill: #C0C0C0;
          stroke: #fff;
          stroke-width: 0.5;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .graph :global(.graph-point:hover) {
          r: 3;
          fill: #fff;
        }

        .x-axis-labels {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0.5rem 0;
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.4);
        }

        .empty-graph {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 150px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 0.5rem;
          color: rgba(255, 255, 255, 0.4);
          font-size: 0.875rem;
        }

        /* Event Feed */
        .events-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          max-height: 300px;
          overflow-y: auto;
        }

        .events-list::-webkit-scrollbar {
          width: 6px;
        }

        .events-list::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }

        .events-list::-webkit-scrollbar-thumb {
          background: rgba(192, 192, 192, 0.3);
          border-radius: 3px;
        }

        .event-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.875rem 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .event-item:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(192, 192, 192, 0.2);
        }

        .event-abbrev {
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding: 0.5rem 0.625rem;
          background: rgba(192, 192, 192, 0.15);
          border: 1px solid rgba(192, 192, 192, 0.25);
          border-radius: 0.375rem;
          color: #C0C0C0;
          flex-shrink: 0;
        }

        .event-content {
          flex: 1;
          min-width: 0;
        }

        .event-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }

        .event-name {
          font-weight: 600;
          color: #fff;
          font-size: 0.9rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .event-date {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.4);
          flex-shrink: 0;
        }

        .event-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .confidence-change {
          font-weight: 700;
          font-size: 0.875rem;
        }

        .confidence-change.positive {
          color: #10b981;
        }

        .confidence-change.negative {
          color: #ef4444;
        }

        .confidence-change.neutral {
          color: rgba(255, 255, 255, 0.7);
        }

        .confidence-total {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.55);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .event-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
        }

        .change-tag {
          padding: 0.2rem 0.5rem;
          background: rgba(192, 192, 192, 0.1);
          border-radius: 0.25rem;
          font-size: 0.65rem;
          color: rgba(255, 255, 255, 0.6);
          text-transform: capitalize;
        }

        .event-arrow {
          color: rgba(255, 255, 255, 0.4);
          font-size: 0.9rem;
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }

        .event-arrow.expanded {
          transform: rotate(180deg);
        }

        .event-details {
          margin-top: 0.75rem;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.5rem;
        }

        .event-details-title {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.45);
          margin-bottom: 0.5rem;
        }

        .event-details-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .event-detail {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .event-detail-label {
          font-size: 0.65rem;
          color: rgba(255, 255, 255, 0.5);
        }

        .event-detail-value {
          font-size: 0.75rem;
          color: #f0f0f5;
          font-weight: 600;
        }

        .event-changes {
          margin-top: 0.5rem;
        }

        .event-changes-label {
          font-size: 0.65rem;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 0.4rem;
        }

        .event-view-btn {
          margin-top: 0.6rem;
          padding: 0.4rem 0.6rem;
          font-size: 0.7rem;
          color: #d6bcfa;
          background: rgba(147, 51, 234, 0.12);
          border: 1px solid rgba(147, 51, 234, 0.3);
          border-radius: 0.4rem;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease;
        }

        .event-view-btn:hover {
          background: rgba(147, 51, 234, 0.2);
          border-color: rgba(147, 51, 234, 0.45);
        }

        .empty-feed {
          padding: 2rem;
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          font-size: 0.875rem;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .stats-bar {
            flex-direction: column;
            gap: 1rem;
          }

          .stat-group {
            width: 100%;
            justify-content: center;
          }

          .expand-btn {
            width: 100%;
            justify-content: center;
          }

          .event-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
