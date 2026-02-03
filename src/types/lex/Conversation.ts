// Lex Conversation Types
// src/types/lex/Conversation.ts

export type MessageRole = 'user' | 'lex' | 'system';
export type ConversationType = 'general' | 'resume_review' | 'job_analysis' | 'cover_letter' | 'interview_prep' | 'career_advice' | 'assessment';
export type ConversationStatus = 'active' | 'archived' | 'deleted';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  // Context references
  resumeId?: string;
  jobAnalysisId?: string;
  coverLetterId?: string;
  assessmentId?: string;

  // AI metadata
  model?: string;
  tokenCount?: number;
  processingTime?: number;

  // Rich content
  attachments?: Attachment[];
  actions?: SuggestedAction[];
  citations?: Citation[];

  // Feedback
  rating?: 'helpful' | 'not_helpful';
  feedback?: string;
}

export interface Attachment {
  id: string;
  type: 'file' | 'image' | 'resume' | 'job_posting';
  name: string;
  url?: string;
  content?: string;
  mimeType?: string;
}

export interface SuggestedAction {
  id: string;
  label: string;
  action: 'navigate' | 'generate' | 'analyze' | 'ask';
  target?: string;
  prompt?: string;
}

export interface Citation {
  id: string;
  text: string;
  source: string;
  url?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  type: ConversationType;
  status: ConversationStatus;
  messages: Message[];

  // Context
  context?: ConversationContext;

  // Metadata
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationContext {
  // Active document references
  activeResumeId?: string;
  activeJobAnalysisId?: string;
  activeCoverLetterId?: string;
  activeAssessmentId?: string;

  // Summarized context for AI
  summary?: string;
  keyTopics?: string[];
  userGoals?: string[];
  actionItems?: string[];

  // Session memory
  recentInsights?: string[];
  pendingFollowUps?: string[];
}

export interface ConversationDB {
  id: string;
  user_id: string;
  title: string;
  type: ConversationType;
  status: ConversationStatus;
  messages: Message[];
  context?: ConversationContext;
  message_count: number;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

// Chat API types
export interface ChatRequest {
  conversationId?: string;
  message: string;
  context?: {
    resumeId?: string;
    jobAnalysisId?: string;
    coverLetterId?: string;
    assessmentId?: string;
  };
  attachments?: Attachment[];
}

export interface ChatResponse {
  success: boolean;
  conversationId: string;
  message?: Message;
  suggestedActions?: SuggestedAction[];
  error?: string;
}

export interface ConversationListItem {
  id: string;
  title: string;
  type: ConversationType;
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface ConversationFilters {
  type?: ConversationType[];
  status?: ConversationStatus[];
  searchQuery?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Transform functions
export function transformConversationFromDB(db: ConversationDB): Conversation {
  return {
    id: db.id,
    userId: db.user_id,
    title: db.title,
    type: db.type,
    status: db.status,
    messages: db.messages,
    context: db.context,
    messageCount: db.message_count,
    lastMessageAt: db.last_message_at,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function transformConversationToDB(conversation: Partial<Conversation>): Partial<ConversationDB> {
  const db: Partial<ConversationDB> = {};

  if (conversation.userId) db.user_id = conversation.userId;
  if (conversation.title !== undefined) db.title = conversation.title;
  if (conversation.type !== undefined) db.type = conversation.type;
  if (conversation.status !== undefined) db.status = conversation.status;
  if (conversation.messages !== undefined) db.messages = conversation.messages;
  if (conversation.context !== undefined) db.context = conversation.context;
  if (conversation.messageCount !== undefined) db.message_count = conversation.messageCount;
  if (conversation.lastMessageAt !== undefined) db.last_message_at = conversation.lastMessageAt;

  return db;
}

// Helper functions
export function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createMessage(role: MessageRole, content: string, metadata?: MessageMetadata): Message {
  return {
    id: generateMessageId(),
    role,
    content,
    timestamp: new Date().toISOString(),
    metadata,
  };
}

export function generateConversationTitle(messages: Message[]): string {
  if (messages.length === 0) return 'New Conversation';

  const firstUserMessage = messages.find(m => m.role === 'user');
  if (!firstUserMessage) return 'New Conversation';

  // Take first 50 characters of the first user message
  const title = firstUserMessage.content.substring(0, 50);
  return title.length < firstUserMessage.content.length ? `${title}...` : title;
}

// Conversation type labels for UI
export const CONVERSATION_TYPE_LABELS: Record<ConversationType, {
  label: string;
  icon: string;
  color: string;
}> = {
  general: {
    label: 'General Chat',
    icon: '💬',
    color: 'blue',
  },
  resume_review: {
    label: 'Resume Review',
    icon: '📄',
    color: 'green',
  },
  job_analysis: {
    label: 'Job Analysis',
    icon: '🔍',
    color: 'purple',
  },
  cover_letter: {
    label: 'Cover Letter',
    icon: '✉️',
    color: 'orange',
  },
  interview_prep: {
    label: 'Interview Prep',
    icon: '🎯',
    color: 'red',
  },
  career_advice: {
    label: 'Career Advice',
    icon: '🧭',
    color: 'teal',
  },
  assessment: {
    label: 'Assessment',
    icon: '📊',
    color: 'indigo',
  },
};
