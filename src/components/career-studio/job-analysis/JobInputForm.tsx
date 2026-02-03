"use client";

import React, { useState } from 'react';

interface JobInputFormProps {
  onAnalyze: (content: string, isUrl: boolean) => Promise<void>;
  isLoading: boolean;
}

export default function JobInputForm({ onAnalyze, isLoading }: JobInputFormProps) {
  const [content, setContent] = useState('');
  const [inputType, setInputType] = useState<'url' | 'text'>('url');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isLoading) return;
    
    await onAnalyze(content.trim(), inputType === 'url');
  };

  const detectInputType = (value: string) => {
    // Simple URL detection
    if (value.trim().startsWith('http://') || value.trim().startsWith('https://')) {
      setInputType('url');
    } else {
      setInputType('text');
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    detectInputType(value);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Input Type Toggle */}
      <div className="flex space-x-2">
        <button
          type="button"
          onClick={() => setInputType('url')}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
            inputType === 'url'
              ? 'bg-[#9333EA] text-white'
              : 'bg-white/[0.05] text-white/60 hover:text-white hover:bg-white/[0.08]'
          }`}
        >
           URL
        </button>
        <button
          type="button"
          onClick={() => setInputType('text')}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
            inputType === 'text'
              ? 'bg-[#9333EA] text-white'
              : 'bg-white/[0.05] text-white/60 hover:text-white hover:bg-white/[0.08]'
          }`}
        >
           Text
        </button>
      </div>

      {/* Content Input */}
      <div className="space-y-2">
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder={inputType === 'url' 
            ? "Paste job URL (e.g., https://company.com/careers/job-123)"
            : "Paste job description text..."
          }
          className="w-full h-32 bg-white/[0.02] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/50 text-sm focus:outline-none focus:border-[#9333EA] focus:ring-2 focus:ring-[#9333EA]/20 backdrop-blur-sm resize-none"
          disabled={isLoading}
        />
        
        {/* Input validation indicator */}
        {content && (
          <div className="flex items-center space-x-2 text-xs">
            {inputType === 'url' ? (
              content.startsWith('http') ? (
                <span className="text-emerald-400 flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Valid URL detected</span>
                </span>
              ) : (
                <span className="text-orange-400 flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>Include http:// or https://</span>
                </span>
              )
            ) : (
              <span className="text-blue-400 flex items-center space-x-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>Job description text - {content.length} characters</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Analyze Button */}
      <button
        type="submit"
        disabled={!content.trim() || isLoading || (inputType === 'url' && !content.startsWith('http'))}
        className="w-full bg-[#9333EA] hover:bg-violet-700 disabled:bg-white/[0.05] disabled:text-white/40 text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Analyze Job</span>
          </>
        )}
      </button>

      {/* Quick Examples */}
      {!content && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-white/40">Quick examples:</p>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                setContent('https://boards.greenhouse.io/company/jobs/12345');
                setInputType('url');
              }}
              className="block w-full text-left text-xs text-white/60 hover:text-white/80 transition-colors p-2 rounded hover:bg-white/[0.02]"
            >
               Greenhouse job posting
            </button>
            <button
              type="button"
              onClick={() => {
                setContent('Senior Software Developer\n\nWe are looking for a rockstar developer to join our fast-paced startup environment...');
                setInputType('text');
              }}
              className="block w-full text-left text-xs text-white/60 hover:text-white/80 transition-colors p-2 rounded hover:bg-white/[0.02]"
            >
               Job description text
            </button>
          </div>
        </div>
      )}
    </form>
  );
}