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
};

// Confidence milestones
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
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

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

  // Format date for display
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Format change tags for display
  const formatChange = (change: string) => {
    return change.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const isLiveArtifact = (documentId: string) => documentId.startsWith('live-lex-chat-');
  const getDisplayName = (name: string, writingType: string) => {
    if (name && name !== 'Unknown') return name;
    return `${getWritingTypeAbbrev(writingType)} Sample`;
  };

  return (
    <div className="timeline-container">
      {/* Collapsed Quick Stats Bar */}
      <div className="stats-bar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="stat-group">
          <div className="stat">
            <div className="stat-value">{currentConfidence}%</div>
            <div className="stat-label">Confidence</div>
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
          {/* Graph Section */}
          <div className="graph-section">
            <h4 className="graph-title">Voice Confidence Over Time</h4>

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
                        {m.value}%
                      </text>
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
                        <span className={`confidence-change ${event.confidenceDelta >= 0 ? 'positive' : 'negative'}`}>
                          {event.confidenceDelta >= 0 ? '+' : ''}{event.confidenceDelta.toFixed(1)}%
                        </span>
                        <span className="confidence-total">→ {event.confidenceLevel}%</span>
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
                              <span className="event-detail-label">Confidence Delta</span>
                              <span className="event-detail-value">
                                {event.confidenceDelta >= 0 ? '+' : ''}
                                {event.confidenceDelta.toFixed(1)}%
                              </span>
                            </div>
                            <div className="event-detail">
                              <span className="event-detail-label">Total Documents</span>
                              <span className="event-detail-value">
                                {event.totalDocuments}
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

        .confidence-total {
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.5);
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
