'use client';

/**
 * Reception / Front Desk workspace — operational only (no clinical chart content).
 */
import React, { useMemo, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  Search, UserPlus, CreditCard, Calendar, Users, Ticket, AlertTriangle,
  QrCode, Phone, Clock, Building2, CheckCircle2, ArrowRight, Printer,
  Wallet, Activity, FileText, Bell,
} from 'lucide-react';

interface Props {
  session: UserSession;
  onNavigate: (moduleKey: string) => void;
}

type Tab = 'overview' | 'search' | 'appointments' | 'queue' | 'tasks';

const emptyKpis = [
  { key: 'today', label: 'Patients today', value: '—', sub: 'From live registrations', tone: '#0052D4' },
  { key: 'in', label: 'Checked in', value: '—', sub: 'Arrived this shift', tone: '#059669' },
  { key: 'wait', label: 'Waiting', value: '—', sub: 'In queue', tone: '#D97706' },
  { key: 'consult', label: 'With clinician', value: '—', sub: 'In department', tone: '#0284C7' },
  { key: 'appts', label: 'Appointments', value: '—', sub: 'Scheduled today', tone: '#7C3AED' },
  { key: 'new', label: 'New patients', value: '—', sub: 'First registration', tone: '#00BFA5' },
  { key: 'pay', label: 'Outstanding', value: '—', sub: 'Front-desk balances', tone: '#EA580C' },
  { key: 'noshow', label: 'No-shows', value: '—', sub: 'Missed appointments', tone: '#DC2626' },
];

export const ReceptionWorkspace: React.FC<Props> = ({ session, onNavigate }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const now = useMemo(
    () =>
      new Date().toLocaleString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    []
  );

  const flash = (msg: string, nav?: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2800);
    if (nav) setTimeout(() => onNavigate(nav), 400);
  };

  const quick = [
    { label: 'Register patient', icon: UserPlus, nav: 'patient-card', primary: true },
    { label: 'Find patient', icon: Search, nav: 'patient-card' },
    { label: 'Check in', icon: CheckCircle2, nav: 'patient-flow' },
    { label: 'Walk-in', icon: Users, nav: 'patient-flow' },
    { label: 'Receive payment', icon: CreditCard, nav: 'cashier' },
    { label: 'Queue ticket', icon: Ticket, nav: 'patient-flow' },
    { label: 'Scan card / QR', icon: QrCode, nav: 'patient-card' },
    { label: 'Emergency register', icon: AlertTriangle, nav: 'patient-card' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1100 }}>
      {notice && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 9999,
            background: '#fff',
            border: '1px solid #86EFAC',
            color: '#047857',
            padding: '12px 16px',
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 13,
            boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          borderRadius: 18,
          padding: '18px 20px',
          background: 'linear-gradient(135deg, #0369A1 0%, #0284C7 45%, #00BFA5 100%)',
          color: '#fff',
          boxShadow: '0 12px 36px rgba(2,132,199,0.28)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', opacity: 0.9 }}>
            RECEPTION · FRONT DESK
          </div>
          <h1
            style={{
              margin: '6px 0 0',
              fontSize: '1.35rem',
              fontWeight: 800,
              fontFamily: 'var(--os-font-heading, Outfit, sans-serif)',
              letterSpacing: '-0.02em',
            }}
          >
            {session.facility || 'Hospital'} reception
          </h1>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.95, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Building2 size={13} /> {session.facility}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Clock size={13} /> {now}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Users size={13} /> {session.name} · Shift active
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="os-ghost-btn" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', borderColor: 'rgba(255,255,255,0.35)' }} onClick={() => flash('Opening notifications')}>
            <Bell size={14} /> Alerts
          </button>
          <button type="button" className="os-ghost-btn" style={{ background: '#fff', color: '#0284C7', borderColor: '#fff', fontWeight: 800 }} onClick={() => flash('Register patient', 'patient-card')}>
            <UserPlus size={14} /> Register
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', background: '#F1F5F9', padding: 4, borderRadius: 12, border: '1px solid #E2E8F0', width: 'fit-content' }}>
        {(
          [
            ['overview', 'Overview'],
            ['search', 'Patient search'],
            ['appointments', 'Appointments'],
            ['queue', 'Live queue'],
            ['tasks', 'Tasks'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{
              padding: '8px 14px',
              borderRadius: 9,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
              background: tab === k ? 'linear-gradient(90deg, #0284C7, #00BFA5)' : 'transparent',
              color: tab === k ? '#fff' : '#64748B',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {/* KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 10,
            }}
          >
            {emptyKpis.map((k) => (
              <div
                key={k.key}
                className="os-card"
                style={{
                  padding: '14px 14px',
                  borderTop: `3px solid ${k.tone}`,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: '#94A3B8', textTransform: 'uppercase' }}>
                  {k.label}
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0A2540', marginTop: 4, fontFamily: 'var(--os-font-heading)' }}>
                  {k.value}
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="os-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 12, color: '#0A2540' }}>Quick actions</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {quick.map((q) => {
                const Icon = q.icon;
                return (
                  <button
                    key={q.label}
                    type="button"
                    className={q.primary ? 'os-primary-btn' : 'os-ghost-btn'}
                    onClick={() => flash(q.label, q.nav)}
                  >
                    <Icon size={14} /> {q.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Flow tracker legend */}
          <div className="os-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Patient flow (operational)</div>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>
              Track where a patient is in the visit — without clinical notes, diagnoses, or results.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12, fontWeight: 700 }}>
              {['Registered', 'Checked in', 'Payment', 'Waiting', 'With provider', 'Lab/Pharmacy', 'Completed'].map(
                (s, i, arr) => (
                  <React.Fragment key={s}>
                    <span
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: i === 0 ? 'rgba(2,132,199,0.12)' : '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        color: '#0A2540',
                      }}
                    >
                      {s}
                    </span>
                    {i < arr.length - 1 && <ArrowRight size={12} color="#94A3B8" />}
                  </React.Fragment>
                )
              )}
            </div>
            <button type="button" className="os-ghost-btn" style={{ marginTop: 12 }} onClick={() => onNavigate('patient-flow')}>
              <Activity size={14} /> Open live flow board
            </button>
          </div>

          {/* Privacy note */}
          <div className="os-role-note">
            Reception view is limited to registration, identity, appointments, queue, payments, and administrative documents.
            Clinical notes, diagnoses, lab results, imaging, and prescriptions are hidden unless Role Visibility grants them.
          </div>
        </>
      )}

      {tab === 'search' && (
        <div className="os-card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Patient search</div>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>
            Search by name, phone, hospital number, digital card, appointment no., or DOB — results show front-desk fields only.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                className="os-search-input"
                style={{ width: '100%', padding: '12px 12px 12px 36px' }}
                placeholder="Name, phone, patient ID, card…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button type="button" className="os-primary-btn" onClick={() => flash('Open patient registry', 'patient-card')}>
              Search
            </button>
            <button type="button" className="os-ghost-btn" onClick={() => flash('Scan digital card', 'patient-card')}>
              <QrCode size={14} /> Scan card
            </button>
          </div>
          <div style={{ marginTop: 16, padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 13, border: '1px dashed #E2E8F0', borderRadius: 12 }}>
            No patients loaded yet. Register a patient or open the patient card module to build the MPI for this facility.
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['View profile', 'Check in', 'Book appointment', 'Collect payment', 'Print queue ticket', 'Print card'].map((a) => (
              <button key={a} type="button" className="os-ghost-btn" style={{ fontSize: 12 }} onClick={() => flash(a, a.includes('payment') ? 'cashier' : 'patient-card')}>
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'appointments' && (
        <div className="os-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 800 }}>Today&apos;s appointments</div>
            <button type="button" className="os-primary-btn" style={{ fontSize: 12 }} onClick={() => flash('Book appointment', 'patient-card')}>
              <Calendar size={14} /> Book
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="os-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Department</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 28, color: '#94A3B8' }}>
                    No appointments for this facility yet. Book from patient card or walk-in flow.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'queue' && (
        <div className="os-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: 800 }}>Live queue by department</div>
            <button type="button" className="os-ghost-btn" onClick={() => onNavigate('patient-flow')}>
              Full flow board <ArrowRight size={14} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {['General OPD', 'Pediatrics', 'Laboratory', 'Pharmacy', 'Radiology', 'Emergency'].map((d) => (
              <div key={d} style={{ padding: 12, borderRadius: 12, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{d}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0284C7', marginTop: 4 }}>0</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>waiting</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: '#64748B' }}>
            Status: <span style={{ color: '#059669' }}>● Waiting</span> · <span style={{ color: '#D97706' }}>● Called</span> ·{' '}
            <span style={{ color: '#0284C7' }}>● With provider</span> · <span style={{ color: '#7C3AED' }}>● Done</span> ·{' '}
            <span style={{ color: '#DC2626' }}>● Priority</span>
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          <div className="os-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>My tasks</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#475569', fontSize: 13, lineHeight: 1.7 }}>
              <li>Verify new registrations</li>
              <li>Confirm today&apos;s appointments</li>
              <li>Follow up outstanding payments</li>
              <li>Resolve duplicate records if flagged</li>
            </ul>
          </div>
          <div className="os-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Handoffs</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" className="os-ghost-btn" onClick={() => onNavigate('cashier')}>
                <Wallet size={14} /> Billing / cashier
              </button>
              <button type="button" className="os-ghost-btn" onClick={() => onNavigate('patient-card')}>
                <FileText size={14} /> Patient cards &amp; MPI
              </button>
              <button type="button" className="os-ghost-btn" onClick={() => onNavigate('billing')}>
                <Printer size={14} /> Invoices &amp; receipts
              </button>
              <button type="button" className="os-ghost-btn" onClick={() => flash('Call patient — use hospital phone / SMS templates')}>
                <Phone size={14} /> Contact patient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceptionWorkspace;
