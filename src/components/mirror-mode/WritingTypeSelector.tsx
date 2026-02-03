// WritingTypeSelector.tsx
// Allows users to categorize their writing samples for better voice learning
'use client';

import { useState } from 'react';
import { WRITING_TYPE_OPTIONS, type WritingType } from '@/lib/mirror-mode/writingTypes';

interface WritingTypeSelectorProps {
  value: WritingType;
  onChange: (type: WritingType) => void;
  variant?: 'dropdown' | 'cards';
  disabled?: boolean;
}

export default function WritingTypeSelector({
  value,
  onChange,
  variant = 'dropdown',
  disabled = false,
}: WritingTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedType = WRITING_TYPE_OPTIONS.find((t) => t.value === value);

  if (variant === 'cards') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label
          style={{
            fontSize: '0.875rem',
            color: 'rgba(240, 240, 245, 0.7)',
            fontWeight: 500,
          }}
        >
          Writing Type
        </label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {WRITING_TYPE_OPTIONS.map((type) => (
            <button
              key={type.value}
              onClick={() => !disabled && onChange(type.value)}
              disabled={disabled}
              style={{
                padding: '1rem',
                background:
                  value === type.value
                    ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(139, 92, 246, 0.2))'
                    : 'rgba(255, 255, 255, 0.03)',
                border:
                  value === type.value
                    ? '1px solid rgba(6, 182, 212, 0.5)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '0.75rem',
                cursor: disabled ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: value === type.value ? '#06b6d4' : 'rgba(255,255,255,0.3)',
                  marginBottom: '0.5rem'
                }} />
              <div
                style={{
                  color: value === type.value ? '#06b6d4' : '#f0f0f5',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}
              >
                {type.label}
              </div>
              <div
                style={{
                  color: 'rgba(240, 240, 245, 0.5)',
                  fontSize: '0.75rem',
                  marginTop: '0.25rem',
                }}
              >
                {type.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Dropdown variant
  return (
    <div style={{ position: 'relative' }}>
      <label
        style={{
          display: 'block',
          fontSize: '0.875rem',
          color: 'rgba(240, 240, 245, 0.7)',
          fontWeight: 500,
          marginBottom: '0.5rem',
        }}
      >
        Writing Type
      </label>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '0.75rem 1rem',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '0.5rem',
          color: '#f0f0f5',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>{selectedType?.label || 'Select type...'}</span>
        </span>
        <span
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '0.25rem',
            background: '#1a1a24',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0.5rem',
            overflow: 'hidden',
            zIndex: 50,
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
          }}
        >
          {WRITING_TYPE_OPTIONS.map((type) => (
            <button
              key={type.value}
              onClick={() => {
                onChange(type.value);
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: value === type.value ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                color: '#f0f0f5',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                textAlign: 'left',
              }}
            >
              <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: value === type.value ? '#06b6d4' : 'rgba(255,255,255,0.3)',
                      flexShrink: 0
                    }} />
              <div>
                <div style={{ fontWeight: 500 }}>{type.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(240, 240, 245, 0.5)' }}>
                  {type.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
