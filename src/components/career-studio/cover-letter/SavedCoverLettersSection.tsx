// Saved Cover Letters Section - Integrates into CoverLetterGenerator
// Add this component to your CoverLetterGenerator.tsx

import { useState, useEffect } from 'react';
import { FileText, Download, Trash2, Eye, Calendar, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { ApplyMirrorModeButton } from "@/components/voice-transform";

interface SavedCoverLetter {
  id: string;
  company_name: string;
  job_title: string;
  content: string;
  voice_match_score: number;
  job_alignment_score: number;
  overall_quality_score: number;
  conversation_based: boolean;
  created_at: string;
}

interface SavedCoverLettersProps {
  onSelect?: (letter: SavedCoverLetter) => void;
}

export function SavedCoverLetters({ onSelect }: SavedCoverLettersProps) {
  const [letters, setLetters] = useState<SavedCoverLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadLetters();
  }, []);

  const loadLetters = async () => {
    try {
      const response = await fetch("/api/cover-letter/generate");
      const data = await response.json();
      
      if (data.success) {
        setLetters(data.coverLetters || []);
      }
    } catch (error) {
      console.error('Failed to load letters:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadLetter = (letter: SavedCoverLetter) => {
    const blob = new Blob([letter.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${letter.company_name}_${letter.job_title}_CoverLetter.txt`.replace(/\s+/g, '_');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyLetter = async (letter: SavedCoverLetter) => {
    try {
      await navigator.clipboard.writeText(letter.content);
      alert(' Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const deleteLetter = async (letterId: string) => {
    if (!confirm('Delete this cover letter?')) return;

    try {
      await fetch(`/api/cover-letter/generate?id=${letterId}`, {
        method: 'DELETE'
      });
      setLetters(prev => prev.filter(l => l.id !== letterId));
      if (selectedId === letterId) setSelectedId(null);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleUpdateCoverLetter = async (letterId: string, content: string) => {
    try {
      const response = await fetch(`/api/cover-letter/${letterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to update cover letter");
      }

      setLetters((prev) =>
        prev.map((letter) =>
          letter.id === letterId ? { ...letter, content } : letter
        )
      );
    } catch (error) {
      console.error("Failed to update cover letter:", error);
      alert("Failed to update cover letter");
    }
  };

  if (loading) {
    return (
      <div className="mb-8 p-6 bg-white/5 border border-white/10 rounded-xl">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-[#9333EA]" />
          <span className="text-white/60">Loading your cover letters...</span>
        </div>
      </div>
    );
  }

  if (letters.length === 0) {
    return null; // Don't show section if no letters exist yet
  }

  const displayLetters = expanded ? letters : letters.slice(0, 3);

  return (
    <div className="mb-8">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-t-xl cursor-pointer hover:bg-white/10 transition"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-[#9333EA]" />
          <div>
            <h3 className="font-semibold">Your Saved Cover Letters</h3>
            <p className="text-sm text-white/60">{letters.length} letter{letters.length !== 1 ? 's' : ''} saved</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-white/40" />
        ) : (
          <ChevronDown className="w-5 h-5 text-white/40" />
        )}
      </div>

      {/* Letters List */}
      {expanded && (
        <div className="border-x border-b border-white/10 rounded-b-xl bg-white/5">
          <div className="divide-y divide-white/10">
            {displayLetters.map((letter) => (
              <div
                key={letter.id}
                className={`p-4 transition ${
                  selectedId === letter.id ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Letter Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{letter.company_name}</h4>
                      <span className="flex items-center gap-1 text-sm text-green-400">
                        <TrendingUp className="w-3.5 h-3.5" />
                        {letter.overall_quality_score}%
                      </span>
                    </div>
                    
                    <p className="text-sm text-white/60 mb-2 truncate">{letter.job_title}</p>
                    
                    <div className="flex items-center gap-3 text-xs text-white/40">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(letter.created_at).toLocaleDateString()}
                      </div>
                      {letter.conversation_based && (
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                          Lex Strategy
                        </span>
                      )}
                    </div>

                    {/* Expanded Content */}
                    {selectedId === letter.id && (
                      <div className="mt-3 p-3 bg-black/30 rounded-lg border border-white/10">
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-400">
                              {letter.voice_match_score}%
                            </div>
                            <div className="text-xs text-white/60">Voice</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-purple-400">
                              {letter.job_alignment_score}%
                            </div>
                            <div className="text-xs text-white/60">Alignment</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-green-400">
                              {letter.overall_quality_score}%
                            </div>
                            <div className="text-xs text-white/60">Overall</div>
                          </div>
                        </div>
                        
                        <div className="max-h-40 overflow-y-auto text-xs text-white/80 whitespace-pre-wrap mb-3">
                          {letter.content}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setSelectedId(selectedId === letter.id ? null : letter.id)}
                        className="p-2 hover:bg-white/10 rounded-lg transition"
                        title={selectedId === letter.id ? "Collapse" : "View"}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => copyLetter(letter)}
                        className="p-2 hover:bg-white/10 rounded-lg transition"
                        title="Copy to clipboard"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => downloadLetter(letter)}
                        className="p-2 hover:bg-white/10 rounded-lg transition"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteLetter(letter.id)}
                        className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <ApplyMirrorModeButton
                      content={letter.content}
                      contentType="cover_letter"
                      onTransformed={(newContent) =>
                        handleUpdateCoverLetter(letter.id, newContent)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Show More Button */}
          {letters.length > 3 && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full p-3 text-sm text-[#9333EA] hover:bg-white/5 transition"
            >
              Show {letters.length - 3} more...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
