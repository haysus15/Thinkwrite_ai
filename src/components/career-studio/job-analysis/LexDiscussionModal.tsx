"use client";

import React, { useState, useRef, useEffect } from 'react';

interface LexDiscussionModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobAnalysisId: string;
}

interface DiscussionMessage {
  id: string;
  role: 'user' | 'lex';
  message: string;
  timestamp: Date;
}

export default function LexDiscussionModal({ 
  isOpen, 
  onClose, 
  jobAnalysisId
}: LexDiscussionModalProps) {
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLexTyping, setIsLexTyping] = useState(false);
  const [analysisContext, setAnalysisContext] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load discussion when modal opens
  useEffect(() => {
    if (isOpen && jobAnalysisId) {
      initializeDiscussion();
    }
  }, [isOpen, jobAnalysisId]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeDiscussion = async () => {
    setIsLexTyping(true);
    try {
      const response = await fetch('/api/job-analysis/discuss-with-lex', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobAnalysisId,
          userMessage: "Let's discuss this job analysis"
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setAnalysisContext(data.analysisContext);
        setMessages([{
          id: 'lex-1',
          role: 'lex',
          message: data.lexResponse,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Failed to initialize discussion:', error);
      setMessages([{
        id: 'lex-error',
        role: 'lex',
        message: "I'm having trouble accessing this job analysis right now. Can you tell me what specific aspects you'd like to discuss?",
        timestamp: new Date()
      }]);
    } finally {
      setIsLexTyping(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLexTyping) return;

    const userMessage: DiscussionMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      message: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLexTyping(true);

    try {
      const response = await fetch('/api/job-analysis/discuss-with-lex', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobAnalysisId,
          userMessage: inputMessage.trim()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        const lexMessage: DiscussionMessage = {
          id: `lex-${Date.now()}`,
          role: 'lex',
          message: data.lexResponse,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, lexMessage]);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: DiscussionMessage = {
        id: `lex-error-${Date.now()}`,
        role: 'lex',
        message: "I'm having trouble right now. Can you try rephrasing your question?",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLexTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.05]">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9333EA] to-violet-700 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">L</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">Discuss with Lex</h3>
              {analysisContext && (
                <p className="text-white/60 text-sm">
                  {analysisContext.jobTitle} at {analysisContext.company}
                  {analysisContext.hasEmail && <span className="text-emerald-400 ml-2">• Email Available</span>}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Analysis Context Summary */}
        {analysisContext && (
          <div className="px-6 py-4 bg-white/[0.02] border-b border-white/[0.05]">
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-white/70">Job:</span>
                <span className="text-white font-medium">{analysisContext.jobTitle}</span>
              </div>
              <div className="w-px h-4 bg-white/20"></div>
              <div className="flex items-center space-x-2">
                <span className="text-white/70">Company:</span>
                <span className="text-white font-medium">{analysisContext.company}</span>
              </div>
              {analysisContext.keyInsights && analysisContext.keyInsights.length > 0 && (
                <>
                  <div className="w-px h-4 bg-white/20"></div>
                  <div className="flex items-center space-x-2">
                    <span className="text-orange-400 text-xs">️</span>
                    <span className="text-orange-400 text-xs">
                      {analysisContext.keyInsights.length} concern{analysisContext.keyInsights.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 max-h-96">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-3 rounded-xl ${
                  message.role === 'user'
                    ? 'bg-[#9333EA] text-white'
                    : 'bg-white/[0.05] text-white border border-white/[0.1]'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.message}</p>
                  <p className="text-xs opacity-70 mt-2">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {isLexTyping && (
              <div className="flex justify-start">
                <div className="bg-white/[0.05] border border-white/[0.1] px-4 py-3 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-[#9333EA] rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-[#9333EA] rounded-full animate-bounce delay-100"></div>
                      <div className="w-2 h-2 bg-[#9333EA] rounded-full animate-bounce delay-200"></div>
                    </div>
                    <span className="text-white/70 text-xs">Lex is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Quick Questions */}
        <div className="px-6 py-4 border-t border-white/[0.05]">
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              "Should I apply for this job?",
              "What are the biggest red flags?",
              "How should I address the concerns?",
              "What questions should I ask in interviews?"
            ].map((question, index) => (
              <button
                key={index}
                onClick={() => setInputMessage(question)}
                className="px-3 py-2 bg-white/[0.05] hover:bg-white/[0.1] rounded-lg text-white text-xs border border-white/[0.1] transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-white/[0.05]">
          <div className="flex space-x-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Lex about this job opportunity..."
              disabled={isLexTyping}
              className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white placeholder-white/50 text-sm focus:outline-none focus:border-[#9333EA] focus:ring-2 focus:ring-[#9333EA]/20 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLexTyping}
              className="px-6 py-3 bg-[#9333EA] hover:bg-violet-700 disabled:bg-white/[0.05] disabled:text-white/40 text-white font-medium rounded-xl transition-colors disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
