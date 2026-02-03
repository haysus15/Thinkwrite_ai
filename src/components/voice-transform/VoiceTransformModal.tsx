"use client";

import { useState } from "react";
import { useVoiceProfile } from "@/hooks/useVoiceProfile";
import { VoiceFeedbackInline } from "@/components/voice-feedback";

interface Props {
  content: string;
  contentType: string;
  onClose: () => void;
  onTransformed: (newContent: string) => void;
}

export function VoiceTransformModal({
  content,
  contentType,
  onClose,
  onTransformed,
}: Props) {
  const { profile, readiness, isLoading: profileLoading } = useVoiceProfile();
  const [isTransforming, setIsTransforming] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewConfidence, setPreviewConfidence] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const handleTransform = async () => {
    setIsTransforming(true);
    setError(null);

    try {
      const res = await fetch("/api/voice-transform/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, contentType }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Transform failed");
        return;
      }

      setPreview(data.transformed);
      setPreviewConfidence(data.voiceMetadata?.confidenceLevel);
    } catch (err) {
      setError("Failed to transform content");
    } finally {
      setIsTransforming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-2xl mx-4 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-100">Apply Your Voice</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {profileLoading ? (
            <div className="text-zinc-400">Loading voice profile...</div>
          ) : !profile ? (
            <div className="p-4 bg-amber-900/20 border border-amber-800/50 rounded-lg">
              <p className="text-amber-400">No voice profile found.</p>
              <a
                href="/mirror-mode"
                className="inline-block mt-2 text-sm text-amber-400 hover:underline"
              >
                Go to Mirror Mode →
              </a>
            </div>
          ) : (
            <>
              <div className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-zinc-300">Your Voice Profile</span>
                  <span className="text-sm text-violet-400">
                    {readiness?.score}% confidence
                  </span>
                </div>
                <p className="text-xs text-zinc-400">{profile.voiceSummary}</p>
              </div>

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {preview ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-zinc-300">Transformed:</div>
                  <div className="p-4 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-200 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {preview}
                  </div>
                  <div className="flex justify-end mt-2">
                    <VoiceFeedbackInline
                      contentType={contentType}
                      studioType="career"
                      originalContent={preview}
                      confidenceLevel={previewConfidence}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-zinc-300">Original:</div>
                  <div className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-400 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {content}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-700">
          {preview ? (
            <>
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Try Again
              </button>
              <button
                onClick={() => onTransformed(preview)}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg"
              >
                Use This Version
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={handleTransform}
                disabled={isTransforming || !profile}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg disabled:opacity-50"
              >
                {isTransforming ? "Transforming..." : "Transform Content"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
