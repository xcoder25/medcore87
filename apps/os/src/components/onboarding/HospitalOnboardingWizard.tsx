'use client';

/**
 * First-login Hospital Onboarding — Admin facility setup + Staff clinical setup.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2, Shield, Plug, Users, CheckCircle2, ChevronRight, ChevronLeft,
  SkipForward, KeyRound, Stethoscope, Sparkles, AlertTriangle, Hospital, Radio,
} from 'lucide-react';
import type { UserSession } from '../auth/AuthScreen';
import {
  SPECIALTY_OPTIONS,
  loadFacilityDraft,
  saveFacilityDraft,
  markFacilityOnboarded,
  loadStaffDraft,
  saveStaffDraft,
  markStaffOnboarded,
  isFacilityOnboarded,
  isStaffOnboarded,
  isFacilityAdminRole,
  subscribeFacilityDraft,
  subscribeOnboarding,
  type FacilityOnboardDraft,
  type StaffOnboardDraft,
  type SpecialtyKey,
  type StorageRegion,
  type AppointmentType,
} from '../../lib/onboardingStore';
import { bindFacilityOnboardingToAdmin } from '../../lib/staffCardStore';
import { getAdminSettings, saveAdminSettings } from '../../lib/adminSettingsStore';

interface Props {
  session: UserSession;
  mode: 'facility' | 'staff';
  onComplete: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E2E8F0',
  fontSize: '0.88rem', background: '#FFF', outline: 'none', color: '#0F172A',
};
const labelStyle: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 5,
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      border: active ? '1.5px solid #0369A1' : '1px solid #E2E8F0',
      background: active ? '#E0F2FE' : '#FFF', color: active ? '#0C4A6E' : '#475569',
      borderRadius: 999, padding: '7px 12px', fontSize: '0.78rem', fontWeight: 650, cursor: 'pointer',
    }}>{children}</button>
  );
}

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
      border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px',
      background: checked ? '#F0FDF4' : '#FFF', cursor: 'pointer',
    }}>
      <div style={{
        width: 40, height: 22, borderRadius: 999, background: checked ? '#059669' : '#CBD5E1',
        position: 'relative', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 3, left: checked ? 20 : 3, width: 16, height: 16,
          borderRadius: '50%', background: '#FFF', transition: 'left 0.15s',
        }} />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0F172A' }}>{label}</div>
        {desc && <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2 }}>{desc}</div>}
      </div>
    </button>
  );
}

const ADMIN_STEPS = [
  { id: 1, label: 'Organization', icon: Building2 },
  { id: 2, label: 'Compliance', icon: Shield },
  { id: 3, label: 'Integrations', icon: Plug },
  { id: 4, label: 'Users & roles', icon: Users },
];

const STAFF_STEPS = [
  { id: 1, label: 'Identity', icon: KeyRound },
  { id: 2, label: 'Workspace', icon: Stethoscope },
  { id: 3, label: 'Walkthrough', icon: Sparkles },
];

export function resolveOnboardingMode(session: UserSession): 'facility' | 'staff' | null {
  if (isFacilityAdminRole(session.roleKey, session.role, session.title)) {
    if (!isFacilityOnboarded(session.hospitalId)) return 'facility';
  }
  const key = session.badgeId || session.id;
  if (key && !isStaffOnboarded(key)) return 'staff';
  return null;
}

export const HospitalOnboardingWizard: React.FC<Props> = ({ session, mode, onComplete }) => {
  if (mode === 'facility') return <FacilityWizard session={session} onComplete={onComplete} />;
  return <StaffWizard session={session} onComplete={onComplete} />;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>{children}</h3>;
}

function WizardShell({ title, subtitle, steps, step, session, children }: {
  title: string; subtitle: string;
  steps: { id: number; label: string; icon: React.ElementType }[];
  step: number; session: UserSession; children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0C4A6E 0%, #0369A1 40%, #F0F9FF 40%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 820, background: '#FFF', borderRadius: 20, boxShadow: '0 24px 64px rgba(12, 74, 110, 0.25)', overflow: 'hidden', border: '1px solid #E0F2FE' }}>
        <div style={{ background: 'linear-gradient(135deg, #0C4A6E, #0369A1)', color: '#FFF', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Hospital size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{title}</div>
              <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>{subtitle}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.75rem', opacity: 0.9, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.18)', padding: '3px 9px', borderRadius: 999, fontSize: '0.70rem', fontWeight: 700, color: '#F0FDF4' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', boxShadow: '0 0 6px #34D399', display: 'inline-block' }} />
              <span>Realtime Cloud &amp; LAN</span>
            </div>
            <div style={{ fontWeight: 700 }}>{session.name}</div>
            <div style={{ opacity: 0.85 }}>{session.badgeId || session.role}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderBottom: '1px solid #F1F5F9', overflowX: 'auto', background: '#F8FAFC' }}>
          {steps.map((s) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, flexShrink: 0,
                background: active ? '#E0F2FE' : done ? '#ECFDF5' : 'transparent',
                color: active ? '#0369A1' : done ? '#059669' : '#94A3B8',
                fontWeight: active || done ? 700 : 500, fontSize: '0.78rem',
              }}>
                {done ? <CheckCircle2 size={15} /> : <Icon size={15} />}
                <span>Step {s.id} · {s.label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ padding: '20px 24px 8px', maxHeight: 'min(62vh, 560px)', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

function WizardFooter({ step, total, onBack, onNext, onFinish, onSkip, skipLabel, finishLabel }: {
  step: number; total: number; onBack: () => void; onNext: () => void; onFinish: () => void;
  onSkip?: () => void; skipLabel?: string; finishLabel: string;
}) {
  const isLast = step >= total;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0 8px', marginTop: 8, borderTop: '1px solid #F1F5F9', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {step > 1 && (
          <button type="button" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #E2E8F0', background: '#FFF', borderRadius: 10, padding: '10px 14px', fontWeight: 650, fontSize: '0.84rem', cursor: 'pointer', color: '#475569' }}>
            <ChevronLeft size={16} /> Back
          </button>
        )}
        {onSkip && skipLabel && (
          <button type="button" onClick={onSkip} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', padding: '10px 8px' }}>
            <SkipForward size={14} /> {skipLabel}
          </button>
        )}
      </div>
      {!isLast ? (
        <button type="button" onClick={onNext} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'linear-gradient(135deg, #0369A1, #0EA5E9)', color: '#FFF', borderRadius: 10, padding: '11px 18px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}>
          Continue <ChevronRight size={16} />
        </button>
      ) : (
        <button type="button" onClick={onFinish} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'linear-gradient(135deg, #059669, #10B981)', color: '#FFF', borderRadius: 10, padding: '11px 18px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}>
          <CheckCircle2 size={16} /> {finishLabel}
        </button>
      )}
    </div>
  );
}

function FacilityWizard({ session, onComplete }: { session: UserSession; onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<FacilityOnboardDraft>(() =>
    loadFacilityDraft(session.hospitalId, session.facility)
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeFacilityDraft(session.hospitalId, (remote) => {
      setDraft((curr) => ({ ...curr, ...remote }));
    });
    return unsub;
  }, [session.hospitalId]);

  const patch = useCallback((p: Partial<FacilityOnboardDraft>) => {
    setDraft((d) => {
      const next = { ...d, ...p };
      saveFacilityDraft(next);
      return next;
    });
  }, []);

  const toggleSpecialty = (key: SpecialtyKey) => {
    const has = draft.specialties.includes(key);
    patch({ specialties: has ? draft.specialties.filter((s) => s !== key) : [...draft.specialties, key] });
  };

  const toggleAppt = (t: AppointmentType) => {
    const has = draft.appointmentTypes.includes(t);
    patch({
      appointmentTypes: has ? draft.appointmentTypes.filter((x) => x !== t) : [...draft.appointmentTypes, t],
    });
  };

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!draft.facilityName.trim()) return 'Facility name is required';
      if (!draft.primaryContact.trim()) return 'Primary contact is required';
      if (draft.specialties.length === 0) return 'Select at least one specialty';
    }
    if (s === 2) {
      if (!draft.ndprAccepted) return 'Accept NDPR / data protection terms to continue';
      if (!draft.baaAccepted) return 'Accept the Business Associate / Data Processing Agreement';
      if (!draft.baaSignedBy.trim()) return 'Enter the name of the signatory';
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => Math.min(4, s + 1));
  };

  const finish = () => {
    const final: FacilityOnboardDraft = {
      ...draft,
      baaSignedAt: draft.baaAccepted ? new Date().toISOString() : draft.baaSignedAt,
      completedAt: new Date().toISOString(),
      completedBy: session.badgeId || session.name,
    };
    saveFacilityDraft(final);
    try {
      const settings = getAdminSettings(session.hospitalId);
      saveAdminSettings({
        ...settings,
        facilityId: session.hospitalId,
        displayName: final.facilityName || settings.displayName,
        address: final.physicalAddress || settings.address,
        phone: final.contactPhone || settings.phone,
        email: final.contactEmail || settings.email,
        state: final.state || settings.state,
        lga: final.lga || settings.lga,
        workingHoursStart: final.operatingHoursStart,
        workingHoursEnd: final.operatingHoursEnd,
        updatedAt: new Date().toISOString(),
        updatedBy: session.badgeId || session.name,
      });
    } catch { /* optional */ }
    // Bind onboarding details to THIS admin account + facility (name, email, phone)
    try {
      const bound = bindFacilityOnboardingToAdmin({
        facilityId: session.hospitalId,
        facilityName: final.facilityName,
        adminBadgeId: session.badgeId,
        primaryContact: final.primaryContact || session.name,
        contactEmail: final.contactEmail || session.email,
        contactPhone: final.contactPhone,
        physicalAddress: final.physicalAddress,
        state: final.state,
        lga: final.lga,
      });
      if (bound.ok && bound.badgeId) {
        final.completedBy = bound.badgeId;
        saveFacilityDraft(final);
      }
    } catch { /* optional */ }
    // Lock facility: no further auto-admin generation after this
    markFacilityOnboarded(session.hospitalId, session.badgeId || session.name);
    onComplete();
  };

  return (
    <WizardShell title="Hospital onboarding" subtitle={`${session.facility || draft.facilityName || session.hospitalId} · First-time facility setup`} steps={ADMIN_STEPS} step={step} session={session}>
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', color: '#B91C1C', fontSize: '0.84rem', fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} />{error}
        </div>
      )}

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionTitle>Organization profile & practice details</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Hospital / clinic name *">
              <input style={inputStyle} value={draft.facilityName} onChange={(e) => patch({ facilityName: e.target.value })} placeholder="e.g. Immanuel General Hospital, Eket" />
            </Field>
            <Field label="Primary contact *">
              <input style={inputStyle} value={draft.primaryContact} onChange={(e) => patch({ primaryContact: e.target.value })} placeholder="Medical Director / Admin name" />
            </Field>
            <Field label="Phone"><input style={inputStyle} value={draft.contactPhone} onChange={(e) => patch({ contactPhone: e.target.value })} placeholder="+234 …" /></Field>
            <Field label="Email"><input style={inputStyle} type="email" value={draft.contactEmail} onChange={(e) => patch({ contactEmail: e.target.value })} /></Field>
            <Field label="Physical address"><input style={inputStyle} value={draft.physicalAddress} onChange={(e) => patch({ physicalAddress: e.target.value })} /></Field>
            <Field label="State / LGA">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input style={inputStyle} value={draft.state} onChange={(e) => patch({ state: e.target.value })} placeholder="State" />
                <input style={inputStyle} value={draft.lga} onChange={(e) => patch({ lga: e.target.value })} placeholder="LGA" />
              </div>
            </Field>
            <Field label="Facility licence / registration" hint="State MoH or corporate licence number">
              <input style={inputStyle} value={draft.licenceNumber} onChange={(e) => patch({ licenceNumber: e.target.value })} />
            </Field>
            <Field label="NHIA facility code / Tax ID">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input style={inputStyle} value={draft.nhiaFacilityCode} onChange={(e) => patch({ nhiaFacilityCode: e.target.value })} placeholder="NHIA code" />
                <input style={inputStyle} value={draft.taxId} onChange={(e) => patch({ taxId: e.target.value })} placeholder="TIN" />
              </div>
            </Field>
          </div>
          <SectionTitle>Specialty configuration</SectionTitle>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>Select all that apply — tailors clinical templates, order sets, and desks.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SPECIALTY_OPTIONS.map((s) => (
              <Chip key={s.key} active={draft.specialties.includes(s.key)} onClick={() => toggleSpecialty(s.key)}>{s.label}</Chip>
            ))}
          </div>
          <SectionTitle>Operating hours & scheduling</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Opens"><input style={inputStyle} type="time" value={draft.operatingHoursStart} onChange={(e) => patch({ operatingHoursStart: e.target.value })} /></Field>
            <Field label="Closes"><input style={inputStyle} type="time" value={draft.operatingHoursEnd} onChange={(e) => patch({ operatingHoursEnd: e.target.value })} /></Field>
            <Field label="Default consult (mins)"><input style={inputStyle} type="number" min={5} max={60} value={draft.defaultConsultMins} onChange={(e) => patch({ defaultConsultMins: parseInt(e.target.value) || 15 })} /></Field>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {([['in_person', 'In-person'], ['telehealth', 'Telehealth'], ['home_visit', 'Home visit'], ['outreach', 'Outreach']] as [AppointmentType, string][]).map(([k, l]) => (
              <Chip key={k} active={draft.appointmentTypes.includes(k)} onClick={() => toggleAppt(k)}>{l}</Chip>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionTitle>Regulatory & compliance verification</SectionTitle>
          <Toggle checked={draft.ndprAccepted} onChange={(v) => patch({ ndprAccepted: v })} label="Nigeria Data Protection Regulation (NDPR)" desc="I confirm this facility will process patient data in line with NDPR and applicable privacy law." />
          <Toggle checked={draft.baaAccepted} onChange={(v) => patch({ baaAccepted: v })} label="Business Associate / Data Processing Agreement" desc="Digital acceptance of MedCore BAA covering safeguards, GDPR principles where applicable, and local residency." />
          <Field label="Signatory full name *"><input style={inputStyle} value={draft.baaSignedBy} onChange={(e) => patch({ baaSignedBy: e.target.value })} placeholder="Name of authorised officer" /></Field>
          <Field label="Data storage region" hint="Choose residency for clinical data">
            <select style={inputStyle} value={draft.storageRegion} onChange={(e) => patch({ storageRegion: e.target.value as StorageRegion })}>
              <option value="ng-lagos">Nigeria · Lagos (recommended)</option>
              <option value="af-south">AWS Africa (Cape Town)</option>
              <option value="eu-west">EU West</option>
              <option value="us-east">US East</option>
              <option value="local_only">On-premise / local only</option>
            </select>
          </Field>
          <Field label="Audit log retention (years)">
            <input style={inputStyle} type="number" min={3} max={25} value={draft.auditRetentionYears} onChange={(e) => patch({ auditRetentionYears: parseInt(e.target.value) || 7 })} />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionTitle>Systems & third-party integrations</SectionTitle>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>Enable what this facility will use. Change later under Settings.</p>
          <Toggle checked={draft.enableFhir} onChange={(v) => patch({ enableFhir: v })} label="FHIR gateway" desc="Modern interoperability (patient, encounter, observation)." />
          <Toggle checked={draft.enableHl7} onChange={(v) => patch({ enableHl7: v })} label="HL7 messaging" desc="Legacy ADT / ORU / ORM feeds." />
          <Toggle checked={draft.enablePacs} onChange={(v) => patch({ enablePacs: v })} label="PACS (radiology)" desc="Connect imaging archive / Orthanc." />
          <Toggle checked={draft.enableLis} onChange={(v) => patch({ enableLis: v })} label="LIS (laboratory)" desc="Specimen and result pipeline." />
          <Toggle checked={draft.enableEprescribe} onChange={(v) => patch({ enableEprescribe: v })} label="e-Prescriptions" desc="Electronic prescribing to facility pharmacy network." />
          <Toggle checked={draft.enableNhisBilling} onChange={(v) => patch({ enableNhisBilling: v })} label="NHIA / insurance billing" desc="Claims, ICD-10 / procedure coding support." />
          <Toggle checked={draft.enablePaystack} onChange={(v) => patch({ enablePaystack: v })} label="Paystack payments" desc="Reception and cashier card / transfer collections." />
        </div>
      )}

      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionTitle>User & role provisioning</SectionTitle>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>Seed role categories for RBAC. Staff enrolment assigns individuals to these roles.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {draft.seedRoles.map((r) => (
              <span key={r} style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 999, padding: '6px 12px', fontSize: '0.78rem', fontWeight: 650, color: '#334155' }}>{r}</span>
            ))}
          </div>
          <Toggle checked={draft.requireMfa} onChange={(v) => patch({ requireMfa: v })} label="Mandatory multi-factor authentication (MFA)" desc="Require authenticator or SMS second factor for clinical and admin roles." />
          <Toggle checked={draft.enableSso} onChange={(v) => patch({ enableSso: v })} label="Single Sign-On (SSO)" desc="Optional integration with hospital directory." />
          {draft.enableSso && (
            <Field label="SSO provider">
              <select style={inputStyle} value={draft.ssoProvider} onChange={(e) => patch({ ssoProvider: e.target.value as FacilityOnboardDraft['ssoProvider'] })}>
                <option value="none">Not configured</option>
                <option value="azure_ad">Microsoft Azure AD</option>
                <option value="okta">Okta</option>
                <option value="hospital_ad">Hospital Active Directory</option>
              </select>
            </Field>
          )}
          <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12, padding: 14, fontSize: '0.82rem', color: '#0C4A6E' }}>
            <strong>Next:</strong> Use Staff Enrolment to add clinicians. Test-patient / sandbox mode is available from clinical desks.
          </div>
        </div>
      )}

      <WizardFooter
        step={step} total={4}
        onBack={() => { setError(null); setStep((s) => Math.max(1, s - 1)); }}
        onNext={next}
        onFinish={finish}
        onSkip={finish}
        skipLabel={step < 4 ? 'Skip remaining (configure later)' : undefined}
        finishLabel="Complete hospital setup"
      />
    </WizardShell>
  );
}

function StaffWizard({ session, onComplete }: { session: UserSession; onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<StaffOnboardDraft>(() =>
    loadStaffDraft(session.badgeId || session.id, session.hospitalId)
  );

  useEffect(() => {
    const key = session.badgeId || session.id;
    const unsub = subscribeOnboarding(() => {
      setDraft((curr) => ({ ...curr, ...loadStaffDraft(key, session.hospitalId) }));
    }, session.hospitalId);
    return unsub;
  }, [session.badgeId, session.id, session.hospitalId]);

  const patch = useCallback((p: Partial<StaffOnboardDraft>) => {
    setDraft((d) => {
      const next = { ...d, ...p };
      saveStaffDraft(next);
      return next;
    });
  }, []);

  const finish = (skip = false) => {
    const final: StaffOnboardDraft = {
      ...draft,
      tourCompleted: skip ? true : draft.tourCompleted || step >= 3,
      completedAt: new Date().toISOString(),
    };
    saveStaffDraft(final);
    markStaffOnboarded(session.badgeId || session.id);
    onComplete();
  };

  const tourItems = useMemo(() => {
    const rk = (session.roleKey || '').toLowerCase();
    if (rk.includes('nurse') || rk.includes('mid')) {
      return [
        { title: 'Patient search', body: 'Look up by name, hospital number, or scan QR on the patient card.' },
        { title: 'Vitals & triage', body: 'Record BP, temp, pulse, SpO₂ and allergies from the triage panel.' },
        { title: 'Nursing notes', body: 'Use flowsheets and handoff notes; escalate critical early-warning scores.' },
        { title: 'Alerts', body: 'Watch drug interactions, critical labs, and pending tasks in the notification centre.' },
      ];
    }
    if (rk.includes('pharm')) {
      return [
        { title: 'Prescription queue', body: 'Open pending e-prescriptions and verify patient identity.' },
        { title: 'Dispense & FEFO', body: 'Dispense from formulary with batch / expiry awareness.' },
        { title: 'Interactions', body: 'Review allergy and interaction alerts before release.' },
        { title: 'Controlled drugs', body: 'Log controlled substances per facility policy.' },
      ];
    }
    if (rk.includes('lab')) {
      return [
        { title: 'Specimen queue', body: 'Accept and barcode specimens from the LIS pipeline.' },
        { title: 'Results entry', body: 'Enter or verify analyser results and flag criticals.' },
        { title: 'Patient lookup', body: 'Search by hospital number before releasing reports.' },
        { title: 'Alerts', body: 'Critical values notify the ordering clinician in realtime.' },
      ];
    }
    return [
      { title: 'Patient search & directory', body: 'Find records by name, MRN / hospital number, or QR code.' },
      { title: 'Vitals & triage panel', body: 'Review intake vitals, allergies, and risk flags before the encounter.' },
      { title: 'Clinical notes & orders', body: 'Add SOAP notes, order meds / labs, and sign the chart.' },
      { title: 'Notification centre', body: 'Critical alerts for interactions, results, and pending tasks.' },
    ];
  }, [session.roleKey]);

  return (
    <WizardShell title="Clinical workspace setup" subtitle={`${session.name} · ${session.role} · First login`} steps={STAFF_STEPS} step={step} session={session}>
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionTitle>Security & identity</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Medical licence number" hint="MDCN / state nursing / pharmacy council">
              <input style={inputStyle} value={draft.medicalLicence || ''} onChange={(e) => patch({ medicalLicence: e.target.value })} />
            </Field>
            <Field label="NPI / professional ID">
              <input style={inputStyle} value={draft.npiOrMdcn || ''} onChange={(e) => patch({ npiOrMdcn: e.target.value })} />
            </Field>
            <Field label="Clinical specialty">
              <input style={inputStyle} value={draft.specialty || ''} onChange={(e) => patch({ specialty: e.target.value })} placeholder="e.g. Obstetrics, General practice" />
            </Field>
          </div>
          <Toggle
            checked={draft.mfaEnabled}
            onChange={(v) => patch({ mfaEnabled: v, mfaMethod: v ? (draft.mfaMethod === 'none' ? 'authenticator' : draft.mfaMethod) : 'none' })}
            label="Enable multi-factor authentication"
            desc="Authenticator app, SMS, or security key for this account."
          />
          {draft.mfaEnabled && (
            <Field label="MFA method">
              <select style={inputStyle} value={draft.mfaMethod} onChange={(e) => patch({ mfaMethod: e.target.value as StaffOnboardDraft['mfaMethod'] })}>
                <option value="authenticator">Authenticator app</option>
                <option value="sms">SMS one-time code</option>
                <option value="security_key">Security key</option>
              </select>
            </Field>
          )}
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionTitle>Clinical workspace preferences</SectionTitle>
          <Field label="Default charting template">
            <select style={inputStyle} value={draft.preferredTemplate} onChange={(e) => patch({ preferredTemplate: e.target.value as StaffOnboardDraft['preferredTemplate'] })}>
              <option value="soap">SOAP note</option>
              <option value="progress">Progress note</option>
              <option value="specialty_flowsheet">Specialty flowsheet</option>
              <option value="anc_partograph">ANC / Partograph (maternity)</option>
            </select>
          </Field>
          <Field label="Quick-order favourites" hint="Comma-separated meds or lab panels">
            <input style={inputStyle} value={(draft.quickOrders || []).join(', ')} onChange={(e) => patch({ quickOrders: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
          </Field>
          <Toggle checked={draft.eSignatureDrawn} onChange={(v) => patch({ eSignatureDrawn: v })} label="E-signature ready" desc="Confirm you will use badge PIN / digital signature for notes and prescriptions." />
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionTitle>Interactive product walkthrough</SectionTitle>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>Role-specific tour for <strong>{session.role}</strong>. Complete or skip — reopen help anytime.</p>
          {tourItems.map((t, i) => (
            <div key={t.title} style={{ display: 'flex', gap: 12, border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, background: '#FFF' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#E0F2FE', color: '#0369A1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>{i + 1}</div>
              <div>
                <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9rem' }}>{t.title}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 4 }}>{t.body}</div>
              </div>
            </div>
          ))}
          <Toggle checked={draft.tourCompleted} onChange={(v) => patch({ tourCompleted: v })} label="I understand the core workflow" />
          <Toggle checked={draft.sandboxPracticeDone} onChange={(v) => patch({ sandboxPracticeDone: v })} label="Practice with test patient / sandbox (optional)" desc="Recommended before touching live charts." />
        </div>
      )}

      <WizardFooter
        step={step} total={3}
        onBack={() => setStep((s) => Math.max(1, s - 1))}
        onNext={() => setStep((s) => Math.min(3, s + 1))}
        onFinish={() => finish(false)}
        onSkip={() => finish(true)}
        skipLabel="Skip for now"
        finishLabel="Enter MedCore"
      />
    </WizardShell>
  );
}

export default HospitalOnboardingWizard;
