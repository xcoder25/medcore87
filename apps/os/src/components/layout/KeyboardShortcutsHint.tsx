'use client';

import React, { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';

const SHORTCUTS = [
  { keys: '⌘ K', action: 'Search / jump anywhere' },
  { keys: '⌘ /', action: 'Show this shortcuts list' },
  { keys: 'Esc', action: 'Close panels' },
  { keys: 'G then D', action: 'Go to home desk' },
  { keys: 'G then P', action: 'Go to patient 360°' },
  { keys: 'G then L', action: 'Go to laboratory' },
  { keys: 'G then R', action: 'Go to pharmacy' },
  { keys: 'G then Q', action: 'Go to patient queue' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsHint: React.FC<Props> = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 20,
          width: 'min(420px, 100%)',
          boxShadow: '0 20px 50px rgba(15,23,42,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Keyboard size={18} color="#0052D4" />
          <span style={{ fontWeight: 800, fontSize: 15 }}>Keyboard shortcuts</span>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
        {SHORTCUTS.map((s) => (
          <div
            key={s.keys}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid #F1F5F9',
              fontSize: 13,
            }}
          >
            <span style={{ color: '#475569' }}>{s.action}</span>
            <kbd
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                fontWeight: 700,
                background: '#F1F5F9',
                padding: '3px 8px',
                borderRadius: 6,
                color: '#0F172A',
              }}
            >
              {s.keys}
            </kbd>
          </div>
        ))}
        <div style={{ marginTop: 12, fontSize: 11, color: '#94A3B8' }}>
          Designed for speed — same idea as Epic keyboard workflows.
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsHint;
