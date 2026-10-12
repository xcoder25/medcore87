'use client';

/**
 * Midwife desk — ANC visits due + batch SMS reminders.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquare, RefreshCw, Send, Baby } from 'lucide-react';
import {
  listDueAncVisits,
  listAncPlans,
  runAncDueSmsBatch,
  subscribeAncPlans,
  type AncDueItem,
  type AncBatchResult,
} from '../../lib/ancNpiSms';

interface Props {
  facilityId: string;
  facilityName?: string;
}

export const AncDueSmsPanel: React.FC<Props> = ({
  facilityId,
  facilityName = 'Hospital',
}) => {
  const [due, setDue] = useState<AncDueItem[]>([]);
  const [planCount, setPlanCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AncBatchResult | null>(null);
  const [windowDays, setWindowDays] = useState(3);

  const reload = useCallback(() => {
    setDue(listDueAncVisits(facilityId, windowDays, { includeOptedOut: true }));
    setPlanCount(listAncPlans(facilityId).length);
  }, [facilityId, windowDays]);

  useEffect(() => {
    reload();
    return subscribeAncPlans(reload);
  }, [reload]);

  const runBatch = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await runAncDueSmsBatch(facilityId, facilityName, windowDays);
      setResult(r);
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #FBCFE8',
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#9D174D' }}>
            <MessageSquare size={16} /> ANC due list · SMS
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
            {planCount} ANC plans on cloud · {due.length} contact(s) in next {windowDays} day(s) / overdue ≤7d
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
            Window{' '}
            <select
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              style={{ marginLeft: 4, borderRadius: 8, border: '1px solid #E2E8F0', padding: '4px 8px' }}
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
            </select>
          </label>
          <button
            type="button"
            onClick={reload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid #E2E8F0',
              background: '#fff',
              borderRadius: 8,
              padding: '6px 10px',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            type="button"
            disabled={busy || due.filter((d) => d.plan.smsOptIn !== false && d.plan.phone).length === 0}
            onClick={runBatch}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: 'none',
              background: 'linear-gradient(135deg,#BE185D,#DB2777)',
              color: '#fff',
              borderRadius: 8,
              padding: '6px 12px',
              fontWeight: 800,
              fontSize: 12,
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.7 : 1,
            }}
          >
            <Send size={12} /> {busy ? 'Sending…' : 'Send due SMS'}
          </button>
        </div>
      </div>

      {result && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 10,
            background: result.unconfigured ? '#FFF7ED' : result.failed ? '#FEF2F2' : '#ECFDF5',
            fontSize: 12,
            fontWeight: 600,
            color: '#0F172A',
          }}
        >
          Batch: {result.sent} sent · {result.failed} failed · {result.skipped} skipped
          {result.unconfigured && ' · SMS gateway not configured (SMS_API_URL / SMS_API_KEY)'}
        </div>
      )}

      {due.length === 0 ? (
        <div style={{ marginTop: 14, fontSize: 13, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Baby size={16} /> No ANC contacts due in this window — register mothers under ANC.
        </div>
      ) : (
        <div style={{ marginTop: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#9D174D', background: '#FDF2F8' }}>
                {'Mother|Phone|Due|Visit|SMS|Status'.split('|').map((h) => (
                  <th key={h} style={{ padding: '8px 6px', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {due.map((d) => (
                <tr key={`${d.plan.patientId}-${d.visit.week}`} style={{ borderTop: '1px solid #FCE7F3' }}>
                  <td style={{ padding: '8px 6px', fontWeight: 700 }}>{d.plan.patientName}</td>
                  <td style={{ padding: '8px 6px' }}>{d.plan.phone || '—'}</td>
                  <td style={{ padding: '8px 6px', color: d.overdue ? '#DC2626' : '#0F172A', fontWeight: 700 }}>
                    {d.visit.dueDate}
                    {d.overdue ? ' · overdue' : d.daysUntil === 0 ? ' · today' : ` · ${d.daysUntil}d`}
                  </td>
                  <td style={{ padding: '8px 6px' }}>{d.visit.label}</td>
                  <td style={{ padding: '8px 6px' }}>
                    {d.plan.smsOptIn === false ? 'Opt-out' : d.plan.smsLang || 'en'}
                  </td>
                  <td style={{ padding: '8px 6px' }}>
                    {d.plan.lastSmsVisitWeek === d.visit.week && d.plan.lastSmsAt
                      ? `Sent ${d.plan.lastSmsAt.slice(0, 10)}`
                      : 'Pending'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AncDueSmsPanel;
