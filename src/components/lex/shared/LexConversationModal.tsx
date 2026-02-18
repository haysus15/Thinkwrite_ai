// src/components/lex/shared/LexConversationModal.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SavedConversation } from '../types/lex.types';

export interface LexSaveMessage {
  id: string;
  sender: 'user' | 'lex';
  text: string;
  timestamp: Date;
  context?: string;
}

export interface LexConversationContext {
  sessionType?: string;
  workspaceView?: string;
  resumeId?: string;
  jobId?: string;
}

interface LexConversationModalProps {
  messages: LexSaveMessage[];
  topic: string;
  onLoad: (payload: { messages: LexSaveMessage[]; context?: LexConversationContext | null }) => void;
  context?: LexConversationContext;
  triggerLabel?: string;
  triggerClassName?: string;
}

export default function LexConversationModal({
  messages,
  topic,
  onLoad,
  context,
  triggerLabel = 'Save Chat',
  triggerClassName,
}: LexConversationModalProps) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState<string | null>(null);
  const [archivingConversation, setArchivingConversation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');

  const canSave = useMemo(() => messages.length > 0, [messages.length]);
  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conv) => {
      const haystack = `${conv.title} ${conv.description || ''} ${conv.topic || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [conversations, search]);

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const response = await fetch('/api/lex/conversations');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load conversations');
      }
      setConversations(data.conversations || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load conversations');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchList();
    }
  }, [open, fetchList]);

  const handleSave = async () => {
    if (!canSave) {
      setError('No messages to save yet.');
      return;
    }
    if (!title.trim()) {
      setError('Add a title to save this chat.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        topic,
        context: context || null,
        messages: messages.map((m) => ({
          sender: m.sender,
          text: m.text,
          timestamp: m.timestamp.toISOString(),
          context: m.context || 'text',
        })),
      };
      const response = await fetch('/api/lex/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save conversation');
      }
      setTitle('');
      setDescription('');
      await fetchList();
    } catch (err: any) {
      setError(err?.message || 'Failed to save conversation');
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (conversationId: string) => {
    setLoadingConversation(conversationId);
    setError(null);
    try {
      const response = await fetch(`/api/lex/conversations?conversationId=${conversationId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load conversation');
      }
      const loadedMessages: LexSaveMessage[] = (data.messages || []).map((msg: any) => ({
        id: msg.id,
        sender: msg.sender,
        text: msg.text,
        timestamp: new Date(msg.timestamp),
        context: msg.context,
      }));
      onLoad({ messages: loadedMessages, context: data.context || null });
      setOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to load conversation');
    } finally {
      setLoadingConversation(null);
    }
  };

  const handleArchive = async (conversationId: string) => {
    if (!confirm('Archive this saved conversation? You can’t undo this.')) return;
    setArchivingConversation(conversationId);
    setError(null);
    try {
      const response = await fetch(`/api/lex/conversations?conversationId=${conversationId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to archive conversation');
      }
      await fetchList();
    } catch (err: any) {
      setError(err?.message || 'Failed to archive conversation');
    } finally {
      setArchivingConversation(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ||
          'career-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium shadow-lg'
        }
      >
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl border border-white/10 bg-[#0b1020] text-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <div>
                <div className="text-sm font-semibold text-white/90">Saved Lex Chats</div>
                <div className="text-[11px] text-white/50">Save or load previous conversations.</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-2 py-1 rounded border border-white/15 text-xs text-white/70 hover:text-white hover:bg-white/5 transition"
              >
                Close
              </button>
            </div>

            <div className="px-5 py-4 border-b border-white/10">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/50 mb-2">
                Save current chat
              </div>
              <div className="grid gap-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Conversation title"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/40"
                />
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/40"
                />
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-white/50">
                    {canSave ? `${messages.length} messages ready` : 'No messages yet'}
                  </div>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave || saving}
                  className="career-btn-primary px-3 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save chat'}
                </button>
                </div>
                {error && <div className="text-[11px] text-red-300">{error}</div>}
              </div>
            </div>

            <div className="flex-1 overflow-auto px-5 py-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/50 mb-2">
                Saved conversations
              </div>
              <div className="mb-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search saved chats..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/40"
                />
              </div>
              {loadingList ? (
                <div className="text-[12px] text-white/60">Loading conversations…</div>
              ) : filteredConversations.length === 0 ? (
                <div className="text-[12px] text-white/50">No saved conversations yet.</div>
              ) : (
                <div className="space-y-2">
                  {filteredConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-white/90 truncate">{conv.title}</div>
                        <div className="text-[11px] text-white/50">
                          {conv.messageCount} messages · {new Date(conv.updatedAt).toLocaleDateString()}
                        </div>
                        {conv.description && (
                          <div className="text-[11px] text-white/60 mt-1 line-clamp-2">
                            {conv.description}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleArchive(conv.id)}
                          disabled={archivingConversation === conv.id}
                          className="px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/5 text-[11px] text-red-300 hover:bg-red-500/15 transition disabled:opacity-60"
                        >
                          {archivingConversation === conv.id ? 'Archiving…' : 'Archive'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoad(conv.id)}
                          disabled={loadingConversation === conv.id}
                          className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/5 text-[11px] text-white/80 hover:bg-white/10 transition disabled:opacity-60"
                        >
                          {loadingConversation === conv.id ? 'Loading…' : 'Load'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
