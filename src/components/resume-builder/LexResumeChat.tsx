"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ApplyMirrorModeButton } from "@/components/voice-transform";

interface Message {
  role: "user" | "assistant";
  content: string;
  draftedContent?: { type: string; content: string } | null;
}

export function LexResumeChat({ initialDraftId }: { initialDraftId?: string }) {
  const searchParams = useSearchParams();
  const draftIdFromUrl = searchParams.get("draft");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [draftId, setDraftId] = useState(initialDraftId || draftIdFromUrl || undefined);
  const [currentSection, setCurrentSection] = useState("context");
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const [sections, setSections] = useState<Record<string, { content: string }>>(
    {}
  );
  const [voiceTransformed, setVoiceTransformed] = useState<string | null>(null);
  const [finalSaved, setFinalSaved] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (draftId && messages.length === 0) {
      loadExistingDraft();
      return;
    }

    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content:
            "Hey! I'm Lex. Let's build your resume together.\n\nFirst question: What type of role are you targeting? This helps me tailor how we present your experience.",
        },
      ]);
    }
  }, [draftId, messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadExistingDraft = async () => {
    try {
      const res = await fetch(`/api/resume-builder/draft/${draftId}`);
      const data = await res.json();
      if (data.success && data.draft) {
        setMessages(data.draft.conversation_history || []);
        setCurrentSection(data.draft.current_section || "context");
        setCompletedSections(
          Object.keys(data.draft.sections || {}).filter(
            (k) => data.draft.sections[k]?.status === "approved"
          )
        );
        setSections(data.draft.sections || {});
      }
    } catch (err) {
      console.error("Failed to load draft:", err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/resume-builder/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, message: userMsg }),
      });

      const data = await res.json();

      if (data.success) {
        setDraftId(data.draftId);
        if (data.progress?.currentSection) {
          setCurrentSection(data.progress.currentSection);
        }
        if (Array.isArray(data.progress?.completedSections)) {
          setCompletedSections(data.progress.completedSections);
        }
        if (data.sections) {
          setSections(data.sections);
        }
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply,
            draftedContent: data.draftedContent,
          },
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (content: string, sectionType: string) => {
    const res = await fetch("/api/resume-builder/save-section", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId, sectionType, content }),
    });

    const data = await res.json();
    if (data.success) {
      setSections((prev) => ({
        ...prev,
        [sectionType]: { content },
      }));
      setCompletedSections((prev) =>
        prev.includes(sectionType) ? prev : [...prev, sectionType]
      );
      if (data.nextSection) {
        setCurrentSection(data.nextSection);
      }
      setInput("Saved! What's next?");
      setTimeout(() => sendMessage(), 100);
    }
  };

  const sectionOrder = ["summary", "experience", "education", "skills", "projects", "review"];
  const progressIndex = Math.max(
    0,
    sectionOrder.indexOf(currentSection)
  );
  const progressPercent = Math.round(
    ((progressIndex + 1) / sectionOrder.length) * 100
  );
  const draftedSectionType =
    currentSection !== "context" ? currentSection : "summary";

  const compiledResume = useMemo(() => {
    const parts: string[] = [];
    const ordered = ["summary", "experience", "education", "skills", "projects"];

    ordered.forEach((key) => {
      const content = sections[key]?.content;
      if (!content) return;
      parts.push(key.toUpperCase());
      parts.push(content);
      parts.push("");
    });

    return parts.join("\n").trim();
  }, [sections]);

  const handleSaveFinal = async (content: string, transformed?: string) => {
    if (!draftId) return;

    const res = await fetch("/api/resume-builder/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId,
        finalContent: content,
        transformedContent: transformed,
      }),
    });

    const data = await res.json();
    if (data.success) {
      setFinalSaved(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent text-white">
      <div className="border-b border-white/10 bg-black/20 px-4 py-3">
        <div className="flex items-center justify-between text-xs text-white/60 mb-2">
          <span>Progress</span>
          <span>
            {completedSections.length}/{sectionOrder.length - 1} sections approved
          </span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-600 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-white/50">
          Current: <span className="text-white/90">{currentSection}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === "user"
                  ? "bg-violet-600 text-white"
                  : "border border-white/10 bg-black/30 text-white/90"
              }`}
            >
              <p className="whitespace-pre-wrap">
                {msg.content.replace(/---\n[\s\S]*?\n---/g, "[See draft below]")}
              </p>

              {msg.draftedContent && (
                <div className="mt-3 p-3 rounded-lg border border-white/10 bg-black/40">
                  <div className="text-xs text-white/50 mb-2 uppercase">Draft</div>
                  <div className="text-sm text-white/85 whitespace-pre-wrap">
                    {msg.draftedContent.content}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() =>
                        handleSave(msg.draftedContent!.content, draftedSectionType)
                      }
                      className="px-3 py-1 text-xs font-medium rounded border border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10 transition"
                    >
                      ✓ Save This
                    </button>
                    <button
                      onClick={() => setInput("Can you revise that? ")}
                      className="px-3 py-1 text-xs rounded border border-white/15 text-white/70 hover:text-white hover:bg-white/5 transition"
                    >
                      Revise
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-lg p-3 border border-white/10 bg-black/30 text-white/60">
              Lex is typing...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-white/10 bg-black/20 p-4">
        {currentSection === "review" && compiledResume && (
          <div className="mb-3 space-y-3">
            <ApplyMirrorModeButton
              content={compiledResume}
              contentType="resume_builder"
              onTransformed={(newContent) => setVoiceTransformed(newContent)}
            />
            {voiceTransformed && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-white/10 bg-black/40 text-white/85 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {voiceTransformed}
                </div>
                <button
                  onClick={() => handleSaveFinal(compiledResume, voiceTransformed)}
                  disabled={finalSaved}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-50"
                >
                  {finalSaved ? "✓ Saved" : "Save Final Resume"}
                </button>
              </div>
            )}
            {!voiceTransformed && (
              <button
                onClick={() => handleSaveFinal(compiledResume)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-white/15 text-white/80 hover:text-white hover:bg-white/5 transition"
              >
                Save Without Voice Transform
              </button>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Tell Lex about your experience..."
            className="flex-1 px-4 py-2 rounded-lg border border-white/15 bg-black/30 text-white placeholder-white/40 focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
