// Enhanced Career Studio Sidebar Chat with Resume Analysis Integration
// Intelligent routing and guidance based on user's resume status and analysis

import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, FileText, BarChart3, Target, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import EnhancedLexConversationSystem from '../../lib/enhanced-lex-conversation-system';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  messageType?: 'analysis_summary' | 'improvement_suggestion' | 'routing' | 'general';
  actionItems?: string[];
  suggestedQuestions?: string[];
}

interface ResumeContext {
  hasResume: boolean;
  masterResume?: {
    id: string;
    fileName: string;
    score?: number;
    analysisStatus: 'pending' | 'complete' | 'needs_lex_review';
    lastAnalyzed?: string;
    keyIssues?: string[];
  };
  allResumes?: Array<{
    id: string;
    fileName: string;
    score?: number;
    isMaster: boolean;
  }>;
}

interface EnhancedSidebarChatProps {
  onNavigate?: (section: string, data?: any) => void;
  className?: string;
}

export default function EnhancedSidebarChat({ onNavigate, className = '' }: EnhancedSidebarChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLexTyping, setIsLexTyping] = useState(false);
  const [resumeContext, setResumeContext] = useState<ResumeContext>({ hasResume: false });
  const [conversationSystem] = useState(new EnhancedLexConversationSystem());
  const [isInitialized, setIsInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeChat();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const initializeChat = async () => {
    try {
      // Load resume context
      await loadResumeContext();
      
      // Generate intelligent opening message based on user's status
      const openingMessage = await generateIntelligentOpening();
      
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: openingMessage.content,
        timestamp: new Date(),
        messageType: openingMessage.type,
        suggestedQuestions: openingMessage.suggestedQuestions
      }]);
      
      setIsInitialized(true);
    } catch (error) {
      console.error('Chat initialization failed:', error);
      setMessages([{
        id: 'fallback',
        role: 'assistant',
        content: "Hey! I'm Lex, your career coach. Ready to make your resume work harder for you? What can I help with today?",
        timestamp: new Date(),
        messageType: 'general'
      }]);
    }
  };

  const loadResumeContext = async () => {
    try {
      const response = await fetch("/api/lex/resume-context");
      const data = await response.json();
      
      if (data.success) {
        const context: ResumeContext = {
          hasResume: data.allResumes && data.allResumes.length > 0,
          allResumes: data.allResumes
        };

        // Set master resume context if available
        if (data.resumeContext?.masterResume) {
          const masterAnalysis = data.resumeContext.masterResume.automatedAnalysis;
          context.masterResume = {
            id: data.resumeContext.masterResume.id,
            fileName: data.resumeContext.masterResume.fileName,
            score: masterAnalysis?.overallScore,
            analysisStatus: masterAnalysis ? 
              (data.resumeContext.masterResume.lexAnalyses?.length > 0 ? 'complete' : 'needs_lex_review') : 
              'pending',
            lastAnalyzed: data.resumeContext.masterResume.uploadedAt,
            keyIssues: masterAnalysis?.resumeQuotes?.slice(0, 3).map((q: any) => q.issue)
          };
        }

        setResumeContext(context);
      }
    } catch (error) {
      console.error('Failed to load resume context:', error);
    }
  };

  const generateIntelligentOpening = async () => {
    // Generate contextual opening based on user's resume status
    if (!resumeContext.hasResume) {
      return {
        content: "Hey! I'm Lex, your HR expert and career coach. I notice you haven't uploaded a resume yet - that's the perfect place to start! \n\nI can help you analyze your resume with both automated scoring AND my HR expertise for a complete double-review. Want to upload one now?",
        type: 'routing' as const,
        suggestedQuestions: [
          "How do I upload my resume?",
          "What makes a good resume?",
          "Tell me about the analysis process"
        ]
      };
    }

    if (resumeContext.masterResume) {
      const { masterResume } = resumeContext;
      
      if (masterResume.analysisStatus === 'pending') {
        return {
          content: `I see you've uploaded "${masterResume.fileName}" but it hasn't been analyzed yet. Let me run both our automated analysis AND my HR expert review to give you the complete picture. \n\nReady for the double-review treatment?`,
          type: 'analysis_summary' as const,
          suggestedQuestions: [
            "Analyze my resume now",
            "What's the difference between automated and HR analysis?",
            "How does the scoring work?"
          ]
        };
      }

      if (masterResume.analysisStatus === 'needs_lex_review' && masterResume.score) {
        return {
          content: `I've got your automated analysis results for "${masterResume.fileName}" - ${masterResume.score}/100. But here's the thing: automated systems miss a lot of what HR managers actually care about. \n\nLet me do my own review and show you where I agree (and disagree) with that score. Ready for my honest take?`,
          type: 'analysis_summary' as const,
          suggestedQuestions: [
            "Give me your HR perspective",
            "What did the automated analysis miss?",
            `Why did I get ${masterResume.score}/100?`
          ]
        };
      }

      if (masterResume.analysisStatus === 'complete' && masterResume.score) {
        const scoreLevel = masterResume.score >= 80 ? 'strong' : masterResume.score >= 60 ? 'decent' : 'needs work';
        const tone = masterResume.score >= 80 ? 'great shape' : masterResume.score >= 60 ? 'some opportunities' : 'some real issues we should tackle';
        
        return {
          content: `Welcome back! I've done a full double-review of "${masterResume.fileName}" - automated analysis plus my HR expertise. Your score is ${masterResume.score}/100, which puts you in ${scoreLevel} territory.\n\nI found ${tone}. Want to dive into the specifics or work on improvements?`,
          type: 'analysis_summary' as const,
          suggestedQuestions: [
            "Show me the detailed analysis",
            "What should I improve first?",
            "How does this compare to other candidates?",
            "Help me tailor this for specific jobs"
          ]
        };
      }
    }

    // Fallback for edge cases
    return {
      content: "Hey! I'm Lex, your career coach and HR expert. I'm here to help you create a resume that actually gets interviews. What's your biggest career challenge right now? ",
      type: 'general' as const,
      suggestedQuestions: [
        "Review my resume",
        "Help with job applications",
        "Career strategy advice"
      ]
    };
  };

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLexTyping(true);

    try {
      // Check for quick routing commands
      const quickRoute = handleQuickRouting(message);
      if (quickRoute) {
        setMessages(prev => [...prev, quickRoute]);
        setIsLexTyping(false);
        return;
      }

      // Process through enhanced conversation system
      const conversationContext = {
        currentResume: resumeContext.masterResume ? {
          id: resumeContext.masterResume.id,
          fileName: resumeContext.masterResume.fileName
        } : undefined,
        conversationMode: 'general_chat' as const,
        previousMessages: messages.slice(-4).map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString()
        }))
      };

      const response = await conversationSystem.processResumeAnalysisConversation(
        message,
        conversationContext
      );

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        actionItems: response.suggestedActions,
        suggestedQuestions: response.nextQuestions
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Message processing failed:', error);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having a quick technical hiccup, but I'm still here! What can I help you with? Try asking about your resume, career goals, or job search strategy.",
        timestamp: new Date(),
        messageType: 'general'
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLexTyping(false);
    }
  };

  const handleQuickRouting = (message: string): ChatMessage | null => {
    const lowerMessage = message.toLowerCase();

    // Resume analysis routing
    if (lowerMessage.includes('analyze') || lowerMessage.includes('review my resume')) {
      if (!resumeContext.hasResume) {
        return {
          id: 'route-upload',
          role: 'assistant',
          content: "Let's get your resume uploaded first! Head to the Resume Manager tab on the left, or click the 'Upload Resume' card on the dashboard. Once it's uploaded, I'll do a complete analysis for you. ",
          timestamp: new Date(),
          messageType: 'routing',
          actionItems: ['Upload resume first', 'Then request analysis']
        };
      } else if (resumeContext.masterResume) {
        // Trigger analysis if needed
        if (resumeContext.masterResume.analysisStatus === 'pending') {
          triggerResumeAnalysis();
          return {
            id: 'route-analyzing',
            role: 'assistant',
            content: "Perfect! I'm running both automated analysis AND my HR expert review on your resume right now. This will take about 30 seconds... ",
            timestamp: new Date(),
            messageType: 'analysis_summary'
          };
        } else {
          onNavigate?.('resume-manager');
          return {
            id: 'route-analysis',
            role: 'assistant',
            content: "Let me show you the detailed analysis! I'm taking you to the Resume Manager where you can see both the automated scoring and my HR insights. ",
            timestamp: new Date(),
            messageType: 'routing'
          };
        }
      }
    }

    // Job analysis routing
    if (lowerMessage.includes('job') && (lowerMessage.includes('analyze') || lowerMessage.includes('description'))) {
      onNavigate?.('job-analysis');
      return {
        id: 'route-job',
        role: 'assistant',
        content: "Great idea! Job analysis helps you understand what employers really want. I'm taking you to the Job Analysis tab where you can paste any job description for a detailed breakdown. ",
        timestamp: new Date(),
        messageType: 'routing',
        actionItems: ['Paste job description', 'Get breakdown and requirements']
      };
    }

    // Resume tailoring routing
    if (lowerMessage.includes('tailor') || lowerMessage.includes('customize')) {
      return {
        id: 'route-tailor',
        role: 'assistant',
        content: "Smart move! Tailoring beats generic resumes every time. Use the 'Tailor Resume' feature to customize your resume for specific jobs. You can analyze a job first, then tailor your resume to match. ",
        timestamp: new Date(),
        messageType: 'routing',
        actionItems: ['Analyze target job first', 'Then tailor resume to match']
      };
    }

    return null;
  };

  const triggerResumeAnalysis = async () => {
    if (!resumeContext.masterResume) return;

    try {
      const response = await fetch(`/api/resumes/${resumeContext.masterResume.id}/lex-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewType: 'compare_analyses'
        })
      });

      if (response.ok) {
        // Reload resume context to get updated analysis
        await loadResumeContext();
        
        // Add completion message
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: 'analysis-complete',
            role: 'assistant',
            content: "Analysis complete!  I've reviewed your resume with both automated scoring and my HR expertise. Want to see where we agree and disagree?",
            timestamp: new Date(),
            messageType: 'analysis_summary',
            suggestedQuestions: [
              "Show me the detailed results",
              "What's your biggest concern?",
              "How can I improve this?"
            ]
          }]);
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to trigger analysis:', error);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(currentMessage);
    }
  };

  const getResumeStatusIndicator = () => {
    if (!resumeContext.hasResume) {
      return (
        <div className="flex items-center space-x-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg mb-3">
          <AlertCircle className="w-4 h-4 text-orange-400" />
          <span className="text-orange-300 text-xs">No resume uploaded</span>
        </div>
      );
    }

    if (resumeContext.masterResume) {
      const { masterResume } = resumeContext;
      const statusConfig = {
        pending: { icon: AlertCircle, color: 'orange', text: 'Analysis pending' },
        needs_lex_review: { icon: BarChart3, color: 'blue', text: 'Ready for HR review' },
        complete: { icon: CheckCircle, color: 'green', text: `Score: ${masterResume.score}/100` }
      };

      const status = statusConfig[masterResume.analysisStatus];
      const StatusIcon = status.icon;

      return (
        <div className={`flex items-center space-x-2 px-3 py-2 bg-${status.color}-500/10 border border-${status.color}-500/20 rounded-lg mb-3`}>
          <StatusIcon className={`w-4 h-4 text-${status.color}-400`} />
          <span className={`text-${status.color}-300 text-xs`}>{status.text}</span>
          <span className="text-white/60 text-xs">• {masterResume.fileName}</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`flex flex-col h-full bg-white/[0.02] border border-white/[0.05] rounded-xl backdrop-blur-xl ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/[0.08]">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-[#9333EA] rounded-lg flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Chat with Lex</h3>
            <p className="text-white/60 text-xs">HR Expert & Career Coach</p>
          </div>
        </div>
        
        {/* Resume Status Indicator */}
        {getResumeStatusIndicator()}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl p-3 ${
              message.role === 'user' 
                ? 'bg-[#9333EA] text-slate-900' 
                : 'bg-white/[0.05] text-white border border-white/[0.08]'
            }`}>
              <div className="whitespace-pre-wrap text-sm">{message.content}</div>
              
              {/* Action Items */}
              {message.actionItems && message.actionItems.length > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="text-xs text-white/60 font-medium">Quick Actions:</div>
                  {message.actionItems.map((action, index) => (
                    <div key={index} className="text-xs text-[#9333EA] flex items-center space-x-2">
                      <Target className="w-3 h-3" />
                      <span>{action}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Suggested Questions */}
              {message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-white/60 font-medium">Suggested questions:</div>
                  <div className="space-y-1">
                    {message.suggestedQuestions.map((question, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestedQuestion(question)}
                        className="block w-full text-left text-xs text-white/80 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg p-2 transition-colors"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="text-xs text-white/40 mt-2">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        
        {/* Typing Indicator */}
        {isLexTyping && (
          <div className="flex justify-start">
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-[#9333EA] rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-[#9333EA] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-[#9333EA] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-white/60 text-xs">Lex is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/[0.08]">
        <div className="flex space-x-3">
          <input
            type="text"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Lex about your resume, career goals, or job search..."
            className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-2 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-[#9333EA]/50"
            disabled={isLexTyping}
          />
          <button
            onClick={() => sendMessage(currentMessage)}
            disabled={isLexTyping || !currentMessage.trim()}
            className="bg-[#9333EA] hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 p-2 rounded-lg transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mt-2 text-center">
          <button 
            onClick={() => onNavigate?.('full-chat')}
            className="text-xs text-[#9333EA] hover:text-violet-400 transition-colors"
          >
            Need a deeper conversation? → Full Chat Mode
          </button>
        </div>
      </div>
    </div>
  );
}
