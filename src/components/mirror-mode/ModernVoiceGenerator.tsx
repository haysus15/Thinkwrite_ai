// src/components/mirror-mode/ModernVoiceGenerator.tsx
'use client';

import { useState } from 'react';

type Props = {
  confidenceLevel: number;
  isReady: boolean;
};

const contentTypes = [
  { value: 'freeform', label: 'Freeform', icon: '' },
  { value: 'email', label: 'Email', icon: '' },
  { value: 'message', label: 'Message', icon: '' },
  { value: 'bio', label: 'Bio', icon: '' },
  { value: 'post', label: 'Social Post', icon: '' },
  { value: 'paragraph', label: 'Paragraph', icon: '' },
  { value: 'rewrite', label: 'Rewrite', icon: '' },
];

const lengths = ['Short', 'Medium', 'Long'];
const tones = [
  { value: 'match', label: 'Match My Voice' },
  { value: 'formal', label: 'More Formal' },
  { value: 'casual', label: 'More Casual' },
] as const;

type ToneValue = (typeof tones)[number]['value'];

export default function ModernVoiceGenerator({ confidenceLevel, isReady }: Props) {
  const [contentType, setContentType] = useState('freeform');
  const [prompt, setPrompt] = useState('');
  const [length, setLength] = useState('Medium');
  const [tone, setTone] = useState<ToneValue>('match');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;

    setGenerating(true);
    try {
      const res = await fetch('/api/mirror-mode/voice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: contentType,
          prompt,
          length: length.toLowerCase(),
          tone,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.content);
      }
    } catch (err) {
      console.error('Generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="modern-generator">
      {/* Content Type Selector */}
      <div className="section">
        <label className="label">What do you want to create?</label>
        <div className="type-grid">
          {contentTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setContentType(type.value)}
              className={`type-btn ${contentType === type.value ? 'active' : ''}`}
            >
              <span className="type-label">{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Input */}
      <div className="section">
        <label className="label" htmlFor="prompt">What should it say?</label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want to write..."
          className="prompt-input"
          disabled={!isReady || generating}
        />
      </div>

      {/* Length & Tone */}
      <div className="controls-grid">
        <div className="section">
          <label className="label">Length</label>
          <div className="option-group">
            {lengths.map((l) => (
              <button
                key={l}
                onClick={() => setLength(l)}
                className={`option-btn ${length === l ? 'active' : ''}`}
                disabled={generating}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="section">
          <label className="label">Tone</label>
          <div className="option-group">
            {tones.map((t) => (
              <button
                key={t.value}
                onClick={() => setTone(t.value)}
                className={`option-btn ${tone === t.value ? 'active' : ''}`}
                disabled={generating}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={!prompt.trim() || !isReady || generating}
        className="generate-btn"
      >
        {generating ? (
          <>
            <span className="spinner" />
            Generating...
          </>
        ) : (
          'Generate'
        )}
      </button>

      {/* Result */}
      {result && (
        <div className="result">
          <div className="result-header">
            <span className="result-title">Generated Content</span>
            <button
              onClick={() => navigator.clipboard.writeText(result)}
              className="copy-btn"
            >
              Copy
            </button>
          </div>
          <div className="result-content">{result}</div>
        </div>
      )}

      <style jsx>{`
        .modern-generator {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .label {
          font-size: 0.875rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          letter-spacing: 0.01em;
        }

        /* Content Type Grid */
        .type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 0.75rem;
        }

        .type-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.875rem 1rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1.5px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .type-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(192, 192, 192, 0.3);
          transform: translateY(-1px);
        }

        .type-btn.active {
          background: rgba(192, 192, 192, 0.15);
          border-color: rgba(192, 192, 192, 0.5);
          color: white;
        }

        .type-label {
          font-size: 0.875rem;
          font-weight: 600;
        }

        /* Prompt Input */
        .prompt-input {
          width: 100%;
          min-height: 140px;
          padding: 1rem 1.25rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1.5px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.875rem;
          color: rgba(255, 255, 255, 0.95);
          font-size: 0.9375rem;
          line-height: 1.6;
          font-family: inherit;
          resize: vertical;
          transition: all 0.2s ease;
        }

        .prompt-input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .prompt-input:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(192, 192, 192, 0.25);
        }

        .prompt-input:focus {
          outline: none;
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(192, 192, 192, 0.5);
          box-shadow: 0 0 0 4px rgba(192, 192, 192, 0.08);
        }

        .prompt-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Controls Grid */
        .controls-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
        }

        .option-group {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .option-btn {
          padding: 0.625rem 1rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1.5px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.625rem;
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .option-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(192, 192, 192, 0.3);
        }

        .option-btn.active {
          background: rgba(192, 192, 192, 0.15);
          border-color: rgba(192, 192, 192, 0.5);
          color: white;
          font-weight: 600;
        }

        .option-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Generate Button */
        .generate-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.625rem;
          width: 100%;
          padding: 1rem 2rem;
          background: linear-gradient(135deg, #C0C0C0 0%, #A9A9A9 100%);
          border: none;
          border-radius: 0.75rem;
          color: #000;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 
            0 2px 8px rgba(0, 0, 0, 0.15),
            0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .generate-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #D0D0D0 0%, #B9B9B9 100%);
          transform: translateY(-2px);
          box-shadow: 
            0 6px 20px rgba(192, 192, 192, 0.4),
            0 2px 6px rgba(0, 0, 0, 0.15);
        }

        .generate-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .generate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(0, 0, 0, 0.2);
          border-top-color: #000;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Result */
        .result {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.5rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.875rem;
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .result-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .copy-btn {
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .copy-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(192, 192, 192, 0.3);
        }

        .result-content {
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.9375rem;
          line-height: 1.7;
          white-space: pre-wrap;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .type-grid {
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          }

          .controls-grid {
            grid-template-columns: 1fr;
          }

          .prompt-input {
            font-size: 16px; /* Prevent iOS zoom */
          }
        }
      `}</style>
    </div>
  );
}
