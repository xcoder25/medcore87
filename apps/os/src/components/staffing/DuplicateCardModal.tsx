'use client';

/**
 * DuplicateCardModal — find and surgically remove duplicate staff ID cards.
 * Flow: Scan → duplicate list → per-card confirm → animated success.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Copy, Layers, Search, Trash2, X, XCircle } from 'lucide-react';
import { listStaffCards } from '../../lib/staffCardStore';
import { deleteStaffMember } from '../../lib/staffCardStore';
import type { StaffCardRecord } from '@medcore/types';

interface DuplicateGroup {
  key: string;
  name: string;
  role: string;
  cards: StaffCardRecord[];
}

interface Props {
  facilityId: string;
  onClose: () => void;
  onDeleted?: (removedIds: string[]) => void;
}

type Phase =
  | { type: 'scanning' }
  | { type: 'results'; groups: DuplicateGroup[] }
  | { type: 'confirm'; card: StaffCardRecord; group: DuplicateGroup }
  | { type: 'success'; card: StaffCardRecord; removedCount: number };

function buildDuplicateGroups(facilityId: string): DuplicateGroup[] {
  const all = listStaffCards().filter(
    (c) => !facilityId || !c.facilityId || c.facilityId === facilityId
  );
  const map = new Map<string, StaffCardRecord[]>();
  for (const c of all) {
    const name = String(c.fullName || '').trim().toLowerCase();
    const role = String(c.roleKey || c.role || '').toLowerCase();
    if (!name) continue;
    const key = name + '|' + role;
    const arr = map.get(key) || [];
    arr.push(c);
    map.set(key, arr);
  }
  const groups: DuplicateGroup[] = [];
  for (const [key, cards] of map) {
    if (cards.length < 2) continue;
    cards.sort((a, b) => {
      const ta = Date.parse(String((a as { issuedAt?: string }).issuedAt || 0)) || 0;
      const tb = Date.parse(String((b as { issuedAt?: string }).issuedAt || 0)) || 0;
      return tb - ta;
    });
    groups.push({ key, name: String(cards[0].fullName || '').trim(), role: String(cards[0].role || cards[0].roleKey || ''), cards });
  }
  return groups;
}

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 10100,
  background: 'rgba(15,23,42,0.62)', backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const SHEET: React.CSSProperties = {
  width: '100%', maxWidth: 520, background: '#fff', borderRadius: 20,
  boxShadow: '0 32px 80px rgba(0,0,0,0.22),0 0 0 1px rgba(0,0,0,0.06)',
  overflow: 'hidden',
};
const hdr = (bg: string, border: string): React.CSSProperties => ({
  padding: '18px 20px 16px', background: bg, borderBottom: '1px solid ' + border,
  display: 'flex', alignItems: 'center', gap: 12,
});
const badge = (bg: string): React.CSSProperties => ({
  width: 40, height: 40, borderRadius: 12, background: bg,
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
});
const CloseBtn: React.FC<{ onClick: () => void; color?: string }> = ({ onClick, color = '#64748B' }) => (
  <button type="button" onClick={onClick} aria-label="Close"
    style={{ background: 'none', border: 'none', cursor: 'pointer', color, padding: 4, borderRadius: 8, display: 'flex', alignItems: 'center' }}>
    <X size={18} />
  </button>
);

export const DuplicateCardModal: React.FC<Props> = ({ facilityId, onClose, onDeleted }) => {
  const [phase, setPhase] = useState<Phase>({ type: 'scanning' });
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const scan = useCallback(() => {
    setPhase({ type: 'scanning' });
    const t = window.setTimeout(() => {
      setPhase({ type: 'results', groups: buildDuplicateGroups(facilityId) });
    }, 350);
    return () => clearTimeout(t);
  }, [facilityId]);

  useEffect(() => { return scan(); }, [scan]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const doDelete = (card: StaffCardRecord, _group: DuplicateGroup) => {
    try {
      deleteStaffMember(card.badgeId);
      const next = [...deletedIds, card.badgeId];
      setDeletedIds(next);
      onDeleted?.(next);
      setPhase({ type: 'success', card, removedCount: next.length });
    } catch { scan(); }
  };

  const Scanning = () => (
    <div style={{ padding: '44px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#6366F1,#0052D4)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'dupSpin 1s linear infinite' }}>
        <Search size={24} color="#fff" />
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>Scanning ID cards…</div>
      <div style={{ fontSize: 13, color: '#64748B' }}>Checking for duplicate name + role combinations</div>
    </div>
  );

  const Results = ({ groups }: { groups: DuplicateGroup[] }) => (
    <>
      <div style={hdr('#F8FAFF', '#E2E8F0')}>
        <div style={badge('linear-gradient(135deg,#6366F1,#0052D4)')}><Layers size={20} color="#fff" /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>
            {groups.length === 0 ? 'No duplicates found' : groups.length + ' duplicate group' + (groups.length !== 1 ? 's' : '') + ' found'}
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
            {groups.length === 0 ? 'All ID cards are unique — nothing to clean up.' : 'Newest card is kept; remove extras below.'}
          </div>
        </div>
        <CloseBtn onClick={onClose} />
      </div>
      <div style={{ maxHeight: 420, overflowY: 'auto', padding: '16px 20px' }}>
        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle2 size={40} color="#16A34A" style={{ marginBottom: 10 }} />
            <div style={{ color: '#16A34A', fontWeight: 700, fontSize: 14 }}>All clean!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groups.map((g) => (
              <div key={g.key} style={{ border: '1.5px solid #E2E8F0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '10px 14px', background: 'linear-gradient(90deg,#F8FAFF,#EFF6FF)', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={14} color="#F59E0B" />
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{g.name}</span>
                  <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>· {g.role}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 999 }}>{g.cards.length} cards</span>
                </div>
                {g.cards.map((c, idx) => {
                  const issuedAt = (c as { issuedAt?: string }).issuedAt;
                  const isNewest = idx === 0;
                  return (
                    <div key={c.badgeId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: idx < g.cards.length - 1 ? '1px solid #F1F5F9' : 'none', background: isNewest ? '#F0FDF4' : '#fff' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <code style={{ fontSize: 12, fontWeight: 700, color: '#0052D4', background: '#EFF6FF', padding: '2px 6px', borderRadius: 5 }}>{c.badgeId}</code>
                          {isNewest && <span style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '1px 6px', borderRadius: 999 }}>KEEP</span>}
                        </div>
                        {issuedAt && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Issued: {new Date(issuedAt).toLocaleDateString()}</div>}
                      </div>
                      {!isNewest && (
                        <button type="button"
                          onClick={() => setPhase({ type: 'confirm', card: c, group: g })}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1.5px solid rgba(220,38,38,0.35)', background: '#FFF1F2', color: '#DC2626', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                          <Trash2 size={12} /> Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: '12px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFBFC' }}>
        <button type="button" onClick={scan} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', color: '#0F172A' }}>
          <Search size={13} /> Re-scan
        </button>
        <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#0052D4,#0D9488)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Done</button>
      </div>
    </>
  );

  const Confirm = ({ card, group }: { card: StaffCardRecord; group: DuplicateGroup }) => (
    <>
      <div style={hdr('#FFF1F2', '#FECACA')}>
        <div style={badge('#DC2626')}><Trash2 size={20} color="#fff" /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#991B1B' }}>Remove duplicate card?</div>
          <div style={{ fontSize: 12, color: '#9F1239', marginTop: 2 }}>This action cannot be undone</div>
        </div>
        <CloseBtn onClick={() => setPhase({ type: 'results', groups: buildDuplicateGroups(facilityId) })} color="#9F1239" />
      </div>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: '#FFF1F2', border: '1.5px solid #FECACA', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><XCircle size={16} color="#DC2626" /><span style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>Card to be removed</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{ fontSize: 13, fontWeight: 800, color: '#DC2626', background: '#FEE2E2', padding: '3px 8px', borderRadius: 6 }}>{card.badgeId}</code>
            <button type="button" onClick={() => { try { void navigator.clipboard.writeText(card.badgeId); } catch { /**/ } }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 2 }}><Copy size={12} /></button>
          </div>
          <div style={{ fontSize: 12, color: '#6B2238', marginTop: 6 }}><strong>{group.name}</strong> · {group.role}</div>
        </div>
        <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><CheckCircle2 size={16} color="#16A34A" /><span style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>Card being kept (newest)</span></div>
          <code style={{ fontSize: 13, fontWeight: 800, color: '#16A34A', background: '#DCFCE7', padding: '3px 8px', borderRadius: 6 }}>{group.cards[0].badgeId}</code>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
          The duplicate card <strong style={{ color: '#0F172A' }}>{card.badgeId}</strong> will be permanently removed. The staff member's primary card and access remain intact.
        </p>
      </div>
      <div style={{ padding: '14px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#FAFBFC' }}>
        <button type="button" onClick={() => setPhase({ type: 'results', groups: buildDuplicateGroups(facilityId) })} style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', color: '#0F172A' }}>Cancel</button>
        <button type="button" onClick={() => doDelete(card, group)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#DC2626,#9F1239)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220,38,38,0.35)' }}>
          <Trash2 size={14} /> Yes, remove card
        </button>
      </div>
    </>
  );

  const Success = ({ card, removedCount }: { card: StaffCardRecord; removedCount: number }) => (
    <>
      <div style={{ padding: '36px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#10B981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(16,185,129,0.4)', animation: 'dupPop 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <CheckCircle2 size={32} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0F172A', marginBottom: 4 }}>Card removed successfully</div>
          <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
            <code style={{ background: '#F1F5F9', padding: '1px 6px', borderRadius: 4, fontWeight: 700, color: '#0052D4' }}>{card.badgeId}</code>
            {' '}has been permanently deleted.
            {removedCount > 1 && <><br /><span style={{ color: '#0D9488', fontWeight: 700 }}>{removedCount} duplicates removed this session.</span></>}
          </div>
        </div>
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '12px 16px', width: '100%', textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46', marginBottom: 6 }}>What happened</div>
          <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: '#047857', lineHeight: 1.7 }}>
            <li>Duplicate ID card removed from store</li>
            <li>Staff registry entry cleaned up</li>
            <li>Primary card and access remain intact</li>
          </ul>
        </div>
      </div>
      <div style={{ padding: '12px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10, justifyContent: 'center', background: '#FAFBFC' }}>
        <button type="button" onClick={() => setPhase({ type: 'results', groups: buildDuplicateGroups(facilityId) })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', color: '#0F172A' }}>
          <ChevronRight size={14} /> Check for more
        </button>
        <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#0052D4,#0D9488)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Done</button>
      </div>
    </>
  );

  return (
    <>
      <style>{'@keyframes dupSpin{to{transform:rotate(360deg)}} @keyframes dupPop{0%{transform:scale(0.4);opacity:0}70%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}'}</style>
      <div style={OVERLAY} onClick={onClose}>
        <div style={SHEET} onClick={(e) => e.stopPropagation()}>
          {phase.type === 'scanning' && <Scanning />}
          {phase.type === 'results' && <Results groups={phase.groups} />}
          {phase.type === 'confirm' && <Confirm card={phase.card} group={phase.group} />}
          {phase.type === 'success' && <Success card={phase.card} removedCount={phase.removedCount} />}
        </div>
      </div>
    </>
  );
};

export default DuplicateCardModal;
