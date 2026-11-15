'use client';

import React from 'react';
import { RotateCcw, Trash2, Cloud, CheckCircle2 } from 'lucide-react';

export interface FormDraftBannerProps {
  hasRecoverableDraft: boolean;
  lastSavedAt: string | null;
  isSaving?: boolean;
  onRestore: () => void;
  onDiscard: () => void;
  formLabel?: string;
}

export const FormDraftBanner: React.FC<FormDraftBannerProps> = ({
  hasRecoverableDraft,
  lastSavedAt,
  isSaving,
  onRestore,
  onDiscard,
  formLabel = 'Form',
}) => {
  if (!hasRecoverableDraft && !isSaving && !lastSavedAt) return null;

  const formattedTime = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  if (hasRecoverableDraft) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 12,
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          color: '#1E3A8A',
          fontSize: 12.5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cloud size={16} color="#0284C7" />
          <span>
            <strong>Unsaved {formLabel} draft recovered</strong>
            {formattedTime ? ` (saved at ${formattedTime})` : ''}. Restore your previous progress?
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onRestore}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#0284C7',
              color: '#fff',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} /> Restore Draft
          </button>
          <button
            type="button"
            onClick={onDiscard}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              background: '#fff',
              color: '#475569',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={13} /> Discard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        color: isSaving ? '#0284C7' : '#059669',
        padding: '2px 8px',
      }}
    >
      {isSaving ? (
        <>
          <Cloud size={12} /> Saving {formLabel.toLowerCase()} draft...
        </>
      ) : (
        <>
          <CheckCircle2 size={12} /> Draft auto-saved{formattedTime ? ` · ${formattedTime}` : ''}
        </>
      )}
    </div>
  );
};

export default FormDraftBanner;
