'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Bell,
  Clock,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import type { HospitalNotification } from '../../lib/notificationEngine';

interface Props {
  notification: HospitalNotification;
  folderLabel?: string;
  folderColor?: string;
  onClose: () => void;
  onNavigate?: (moduleKey: string) => void;
  onToggleRead?: (id: string, nextRead: boolean) => void;
}

function resolveTargetModule(mod?: string): string | null {
  if (!mod) return null;
  if (mod === 'treasury-notice' || mod === 'remittance') return 'akwaremit';
  return mod;
}

export const NotificationDetailModal: React.FC<Props> = ({
  notification,
  folderLabel,
  folderColor = '#1D4ED8',
  onClose,
  onNavigate,
  onToggleRead,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const targetMod = resolveTargetModule(notification.module);

  const severityMeta =
    notification.level === 'critical'
      ? { label: 'CRITICAL / STAT', bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA' }
      : notification.level === 'important'
        ? { label: 'URGENT NOTICE', bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' }
        : { label: 'INFORMATION', bg: '#DBEAFE', color: '#1D4ED8', border: '#BFDBFE' };

  const handleCopy = () => {
    const fullText = `${notification.title}\n\n${notification.body}`;
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={notification.title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10250,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 580,
          maxHeight: '86vh',
          background: '#FFFFFF',
          borderRadius: 18,
          border: '1px solid #E2E8F0',
          boxShadow: '0 24px 64px rgba(15, 23, 42, 0.28)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: severityMeta.bg,
                  color: severityMeta.color,
                  border: `1px solid ${severityMeta.border}`,
                }}
              >
                {notification.level === 'critical' ? <AlertCircle size={11} /> : <Bell size={11} />}
                {severityMeta.label}
              </span>
              {folderLabel && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: `${folderColor}15`,
                    color: folderColor,
                    border: `1px solid ${folderColor}35`,
                  }}
                >
                  {folderLabel}
                </span>
              )}
              <span
                style={{
                  fontSize: 11,
                  color: '#64748B',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Clock size={11} />
                {new Date(notification.createdAt).toLocaleString()}
              </span>
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                color: '#0F172A',
                lineHeight: 1.35,
                wordBreak: 'break-word',
              }}
            >
              {notification.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notification"
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Full Body */}
        <div
          style={{
            padding: '18px 20px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: '14px 16px',
              fontSize: 13.5,
              color: '#1E293B',
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {notification.body}
          </div>

          {(notification.module || notification.targetStaff || notification.patientId || notification.visitId) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {notification.module && (
                <span style={metaChip}>
                  Module: <strong>{notification.module}</strong>
                </span>
              )}
              {notification.targetStaff && (
                <span style={metaChip}>
                  Assigned: <strong>{notification.targetStaff}</strong>
                </span>
              )}
              {notification.patientId && (
                <span style={metaChip}>
                  Patient Ref: <strong>{notification.patientId}</strong>
                </span>
              )}
              {notification.visitId && (
                <span style={metaChip}>
                  Visit: <strong>{notification.visitId}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #E2E8F0',
            background: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={handleCopy} style={ghostBtn}>
              {copied ? <Check size={13} color="#059669" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy text'}</span>
            </button>
            {onToggleRead && (
              <button
                type="button"
                onClick={() => onToggleRead(notification.id, !notification.read)}
                style={ghostBtn}
              >
                {notification.read ? <RotateCcw size={13} /> : <CheckCircle2 size={13} />}
                <span>{notification.read ? 'Mark unread' : 'Mark read'}</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {targetMod && onNavigate && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigate(targetMod);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #1D4ED8, #0D9488)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <span>Open workspace</span>
                <ExternalLink size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#0F172A',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const metaChip: React.CSSProperties = {
  fontSize: 11,
  color: '#475569',
  background: '#F1F5F9',
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  padding: '4px 9px',
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '7px 11px',
  borderRadius: 9,
  border: '1px solid #CBD5E1',
  background: '#FFFFFF',
  color: '#334155',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};

export default NotificationDetailModal;
