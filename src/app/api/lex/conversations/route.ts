// Conversation Persistence API - Save & Load Chat Sessions
// src/app/api/lex/conversations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';

interface SavedConversation {
  id: string;
  title: string;
  description?: string;
  messageCount: number;
  lastMessageAt: string;
  topic: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ConversationMessage {
  id: string;
  sender: 'user' | 'lex';
  text: string;
  timestamp: string;
  context?: string;
  attachments?: Array<{
    documentId: string;
    fileName: string;
    fileType: string;
  }>;
}

// Get user's saved conversations
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (conversationId) {
      // Load specific conversation with messages
      return await loadConversation(conversationId, userId);
    } else {
      // Get list of user's saved conversations
      return await getUserConversations(userId);
    }

  } catch (error) {
    console.error('Conversation fetch error:', error);
    return Errors.internal();
  }
}

// Save a new conversation
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const body = await request.json();
    const { title, description, messages, topic } = body;

    if (!title || !messages || !Array.isArray(messages)) {
      return Errors.validationError('Missing required fields: title, messages');
    }

    // Check conversation limit (10 max per user)
    const { count } = await supabase
      .from('saved_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_archived', false);

    if (count && count >= 10) {
      return NextResponse.json({ 
        error: 'Maximum of 10 saved conversations allowed. Please archive or delete old conversations first.' 
      }, { status: 400 });
    }

    // Save conversation (without message_count - it's calculated in view)
    const lastMessage = messages[messages.length - 1];
    const { data: conversation, error: convError } = await supabase
      .from('saved_conversations')
      .insert({
        user_id: userId,
        title: title,
        description: description,
        conversation_topic: topic || 'general',
        last_message_at: lastMessage?.timestamp || new Date().toISOString(),
        is_pinned: false,
        is_archived: false
      })
      .select()
      .single();

    if (convError) {
      console.error('Conversation save error:', convError);
      return NextResponse.json({ error: 'Failed to save conversation' }, { status: 500 });
    }

    // Save messages
    const messageInserts = messages.map((msg: any) => ({
      conversation_id: conversation.id,
      sender: msg.sender,
      message_text: msg.text,
      message_type: msg.context === 'document-analysis' ? 'document_analysis' : 'text',
      context_type: msg.context || 'text',
      timestamp: msg.timestamp
    }));

    const { data: savedMessages, error: msgError } = await supabase
      .from('conversation_messages')
      .insert(messageInserts)
      .select();

    if (msgError) {
      console.error('Messages save error:', msgError);
      // Clean up conversation if messages failed
      await supabase.from('saved_conversations').delete().eq('id', conversation.id);
      return NextResponse.json({ error: 'Failed to save messages' }, { status: 500 });
    }

    // Handle message attachments
    await saveMessageAttachments(supabase, savedMessages, messages);

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      message: 'Conversation saved successfully'
    });

  } catch (error) {
    console.error('Conversation save error:', error);
    return Errors.internal();
  }
}

// Update conversation (for continuing conversations)
export async function PATCH(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const body = await request.json();
    const { conversationId, newMessages, title } = body;

    if (!conversationId) {
      return Errors.missingField('conversationId');
    }

    // Verify ownership
    const { data: existingConv, error: checkError } = await supabase
      .from('saved_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (checkError || !existingConv) {
      return Errors.notFound('Conversation');
    }

    // Update conversation metadata
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (title) {
      updateData.title = title;
    }

    if (newMessages && newMessages.length > 0) {
      const lastMessage = newMessages[newMessages.length - 1];
      updateData.last_message_at = lastMessage.timestamp;

      // Add new messages
      const messageInserts = newMessages.map((msg: any) => ({
        conversation_id: conversationId,
        sender: msg.sender,
        message_text: msg.text,
        message_type: msg.context === 'document-analysis' ? 'document_analysis' : 'text',
        context_type: msg.context || 'text',
        timestamp: msg.timestamp
      }));

      const { data: savedMessages, error: msgError } = await supabase
        .from('conversation_messages')
        .insert(messageInserts)
        .select();

      if (msgError) {
        console.error('New messages save error:', msgError);
        return Errors.databaseError('Failed to save new messages');
      }

      // Handle attachments for new messages
      await saveMessageAttachments(supabase, savedMessages, newMessages);
    }

    const { error } = await supabase
      .from('saved_conversations')
      .update(updateData)
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Conversation update error:', error);
      return Errors.databaseError('Failed to update conversation');
    }

    return NextResponse.json({
      success: true,
      message: 'Conversation updated successfully'
    });

  } catch (error) {
    console.error('Conversation update error:', error);
    return Errors.internal();
  }
}

// Delete conversation
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return Errors.missingField('conversationId');
    }

    // Archive instead of hard delete - only user's own conversations
    const { error } = await supabase
      .from('saved_conversations')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Conversation delete error:', error);
      return Errors.databaseError('Failed to delete conversation');
    }

    return NextResponse.json({
      success: true,
      message: 'Conversation archived successfully'
    });

  } catch (error) {
    console.error('Conversation delete error:', error);
    return Errors.internal();
  }
}

// Helper function to get user's conversation list
async function getUserConversations(userId: string) {
  const supabase = createSupabaseAdmin();
  // Use the conversation_summary view instead of saved_conversations table
  // This view includes the calculated message_count
  const { data: conversations, error } = await supabase
    .from('conversation_summary')
    .select(`
      id,
      title,
      description,
      conversation_topic,
      message_count,
      last_message_at,
      is_pinned,
      created_at,
      updated_at
    `)
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return NextResponse.json({
    success: true,
    conversations: conversations.map((conv): SavedConversation => ({
      id: conv.id,
      title: conv.title,
      description: conv.description,
      messageCount: conv.message_count,
      lastMessageAt: conv.last_message_at,
      topic: conv.conversation_topic,
      isPinned: conv.is_pinned,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at
    }))
  });
}

// Helper function to load specific conversation
async function loadConversation(conversationId: string, userId: string) {
  const supabase = createSupabaseAdmin();
  // Verify ownership
  const { data: conversation, error: convError } = await supabase
    .from('saved_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // Get messages with attachments
  const { data: messages, error: msgError } = await supabase
    .from('conversation_messages')
    .select(`
      id,
      sender,
      message_text,
      message_type,
      context_type,
      timestamp,
      message_attachments (
        id,
        document_id,
        attachment_type,
        user_documents (
          file_name,
          file_type
        )
      )
    `)
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: true });

  if (msgError) {
    throw msgError;
  }

  // Format messages
  const formattedMessages: ConversationMessage[] = messages.map(msg => ({
    id: msg.id,
    sender: msg.sender,
    text: msg.message_text,
    timestamp: msg.timestamp,
    context: msg.context_type,
    attachments: msg.message_attachments.map((att: any) => ({
      documentId: att.document_id,
      fileName: att.user_documents.file_name,
      fileType: att.user_documents.file_type
    }))
  }));

  return NextResponse.json({
    success: true,
    conversation: {
      id: conversation.id,
      title: conversation.title,
      description: conversation.description,
      topic: conversation.conversation_topic,
      isPinned: conversation.is_pinned,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at
    },
    messages: formattedMessages
  });
}

// Helper function to save message attachments
async function saveMessageAttachments(supabase: ReturnType<typeof createSupabaseAdmin>, savedMessages: any[], originalMessages: any[]) {
  try {
    const attachmentInserts = [];

    for (let i = 0; i < savedMessages.length; i++) {
      const savedMsg = savedMessages[i];
      const originalMsg = originalMessages[i];

      if (originalMsg.documentId) {
        attachmentInserts.push({
          message_id: savedMsg.id,
          document_id: originalMsg.documentId,
          attachment_type: 'analysis'
        });
      }
    }

    if (attachmentInserts.length > 0) {
      const { error } = await supabase
        .from('message_attachments')
        .insert(attachmentInserts);

      if (error) {
        console.error('Attachment save error:', error);
      }
    }
  } catch (error) {
    console.error('Attachment processing error:', error);
  }
}