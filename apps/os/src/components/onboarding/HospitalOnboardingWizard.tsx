'use client';

/**
 * First-login Hospital Onboarding — Admin facility setup + Staff clinical setup.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2, Shield, Plug, Users, CheckCircle2, ChevronRight, ChevronLeft,
  SkipForward, KeyRound, Stethoscope, Sparkles, AlertTriangle, Hospital, Radio,
  Upload, MapPin, Landmark, UserCheck, FileText,
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
import { bindFacilityOnboardingToAdmin, isClinicalRole } from '../../lib/staffCardStore';
import { getAdminSettings, saveAdminSettings } from '../../lib/adminSettingsStore';
import { loadFacilityCatalog, saveFacilityCatalog } from '../../lib/facilityCatalogStore';
import { AKWA_IBOM_LGAS, NIGERIA_STATE_LGAS } from '../../lib/receptionConstants';
import { uploadImageToS3 } from '../../lib/storageClient';
import {
  SUPERVISORY_BOARDS,
  EMPLOYMENT_SCHEMES,
  REGULATORY_COUNCILS,
  isPublicOwnership,
  defaultSupervisoryBoard,
  validateHfrCode,
  validateGpsCoord,
  getRequiredCouncilForRole,
  type SupervisoryBoardKey,
  type EmploymentSchemeKey,
  type RegulatoryCouncilCode,
} from '../../lib/publicHospitalCompliance';

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
    <button type="button" aria-pressed={active} onClick={onClick} style={{
      border: active ? '1.5px solid #0369A1' : '1px solid #E2E8F0',
      background: active ? '#E0F2FE' : '#FFF', color: active ? '#0C4A6E' : '#475569',
      borderRadius: 999, padding: '7px 12px', fontSize: '0.78rem', fontWeight: 650, cursor: 'pointer',
    }}>{children}</button>
  );
}

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} style={{
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
  { id: 1, label: 'Facility profile', icon: Building2 },
  { id: 2, label: 'Compliance', icon: Shield },
  { id: 3, label: 'Services & desks', icon: Plug },
  { id: 4, label: 'Access & payments', icon: Users },
];

const STAFF_STEPS = [
  { id: 1, label: 'Identity', icon: KeyRound },
  { id: 2, label: 'Workspace', icon: Stethoscope },
  { id: 3, label: 'Walkthrough', icon: Sparkles },
];

export function resolveOnboardingMode(session: UserSession): 'facility' | 'staff' | null {
  // Hospital / facility admins only run facility setup — never the clinical workspace wizard
  if (isFacilityAdminRole(session.roleKey, session.role, session.title)) {
    if (!isFacilityOnboarded(session.hospitalId)) return 'facility';
    return null;
  }
  // Clinical workspace wizard is only for clinical providers (doctors, nurses, surgeons, etc.)
  // Non-clinical roles (front desk / reception, records, finance/cashier) skip clinical setup
  if (!isClinicalRole(session.roleKey, session.role, session.title, session.badgeId)) {
    return null;
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
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [boardDocBusy, setBoardDocBusy] = useState(false);
  const [cmdDocBusy, setCmdDocBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [docNote, setDocNote] = useState<string | null>(null);

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

  const uploadGovernanceDoc = useCallback(
    async (file: File | null, target: 'board' | 'cmd') => {
      if (!file) return;
      if (file.size > 15 * 1024 * 1024) {
        setDocNote('Authorization document must be under 15 MB.');
        return;
      }
      setDocNote(null);
      if (target === 'board') setBoardDocBusy(true);
      else setCmdDocBusy(true);
      try {
        const res = await uploadImageToS3(file, {
          folder: 'general',
          facilityId: session.hospitalId,
          filename: `${session.hospitalId.toLowerCase()}-${target}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`,
        });
        if (!res.ok || !res.url) {
          setDocNote(res.error && res.error !== 'S3_NOT_CONFIGURED' ? res.error : 'Document upload failed — please try again.');
          return;
        }
        if (target === 'board') patch({ boardAuthDocUrl: res.url });
        else patch({ cmdApprovalDocUrl: res.url });
      } catch (err: any) {
        setDocNote(err?.message || 'Could not upload document.');
      } finally {
        if (target === 'board') setBoardDocBusy(false);
        else setCmdDocBusy(false);
      }
    },
    [patch, session.hospitalId]
  );

  const captureGps = useCallback(() => {
    setDocNote(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setDocNote('Browser geolocation unavailable — type Latitude & Longitude manually.');
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        patch({
          gpsLatitude: pos.coords.latitude.toFixed(6),
          gpsLongitude: pos.coords.longitude.toFixed(6),
        });
        setGpsBusy(false);
      },
      () => {
        setDocNote('Unable to capture GPS fix — enter coordinates manually.');
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [patch]);

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
      if (draft.facilityName.trim().length < 3) return 'Official facility name is required (at least 3 characters).';
      if (isPublicOwnership(draft.ownership)) {
        const hfr = validateHfrCode(draft.hfrCode);
        if (!hfr.ok) return hfr.error!;
        if (!draft.supervisoryBoard || draft.supervisoryBoard === 'PRIVATE_REG') {
          return 'Select the supervising government board (AKSHMB, AKSPHCDA, AKS MoH, or FMOH).';
        }
        if (draft.boardAuthCircularRef.trim().length < 4) {
          return 'State Supervisory Board authorization letter / circular ref is required (min 4 characters).';
        }
        if (draft.medicalDirector.trim().length < 3) {
          return 'Chief Medical Director (CMD) / Medical Superintendent name is required.';
        }
        const focal = (draft.emrFocalPersonName || draft.primaryContact || '').trim();
        if (focal.length < 3) {
          return 'Designated EMR Focal Person / IT Administrator name is required.';
        }
        if (!draft.lga.trim()) return 'Local Government Area (LGA) is required.';
        if (draft.ward.trim().length < 2) return 'Administrative / Political Ward is required for state registry metadata.';
      } else {
        const contact = (draft.primaryContact || draft.medicalDirector || '').trim();
        if (contact.length < 3) return 'Primary contact or Medical Director is required.';
        if (!draft.lga.trim()) return 'Local Government Area (LGA) is required.';
      }
      const gpsCheck = validateGpsCoord(draft.gpsLatitude, draft.gpsLongitude);
      if (!gpsCheck.ok) return gpsCheck.error!;
      if (draft.specialties.length === 0) return 'Select at least one active clinical unit / service.';
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
    const focalName = (draft.emrFocalPersonName || draft.primaryContact || '').trim();
    const resolvedHfr = draft.hfrCode.trim().toUpperCase();
    const final: FacilityOnboardDraft = {
      ...draft,
      hfrCode: resolvedHfr,
      primaryContact: focalName || draft.medicalDirector.trim(),
      emrFocalPersonName: focalName,
      baaSignedAt: draft.baaAccepted ? new Date().toISOString() : draft.baaSignedAt,
      completedAt: new Date().toISOString(),
      completedBy: session.badgeId || session.name,
    };
    saveFacilityDraft(final);
    try {
      const settings = getAdminSettings(session.hospitalId);
      const tierTypeMap: Record<FacilityOnboardDraft['hospitalTier'], string> = {
        primary_health_centre: 'Primary Health Centre',
        district_general: 'General Hospital',
        secondary_specialist: 'Specialist Hospital',
        tertiary_teaching: 'Federal Tertiary Hospital',
      };
      saveAdminSettings({
        ...settings,
        facilityId: session.hospitalId,
        displayName: final.facilityName || settings.displayName,
        ownership: final.ownership,
        hospitalTier: final.hospitalTier,
        facilityType: tierTypeMap[final.hospitalTier] || settings.facilityType,
        hfrCode: resolvedHfr || settings.hfrCode,
        registrationNo: resolvedHfr || settings.registrationNo,
        supervisoryBoard: final.supervisoryBoard || settings.supervisoryBoard,
        boardAuthCircularRef: final.boardAuthCircularRef || settings.boardAuthCircularRef,
        boardAuthDate: final.boardAuthDate || settings.boardAuthDate,
        boardAuthDocUrl: final.boardAuthDocUrl || settings.boardAuthDocUrl,
        akshiaProviderId: final.akshiaProviderId || settings.akshiaProviderId,
        nhiaProviderCode: final.nhiaFacilityCode || settings.nhiaProviderCode,
        bhcpfCode: final.bhcpfCode || settings.bhcpfCode,
        medicalDirector: final.medicalDirector || settings.medicalDirector,
        cmdApprovalRef: final.cmdApprovalRef || settings.cmdApprovalRef,
        cmdApprovalDate: final.cmdApprovalDate || settings.cmdApprovalDate,
        cmdApprovalDocUrl: final.cmdApprovalDocUrl || settings.cmdApprovalDocUrl,
        emrFocalPersonName: final.emrFocalPersonName || settings.emrFocalPersonName,
        emrFocalPersonPhone: final.emrFocalPersonPhone || final.contactPhone || settings.emrFocalPersonPhone,
        emrFocalPersonEmail: final.emrFocalPersonEmail || final.contactEmail || settings.emrFocalPersonEmail,
        licenseNo: final.licenceNumber || settings.licenseNo,
        taxId: final.taxId || settings.taxId,
        address: final.physicalAddress || settings.address,
        phone: final.contactPhone || final.emrFocalPersonPhone || settings.phone,
        email: final.contactEmail || final.emrFocalPersonEmail || settings.email,
        state: final.state || settings.state,
        lga: final.lga || settings.lga,
        ward: final.ward || settings.ward,
        gpsLatitude: final.gpsLatitude || settings.gpsLatitude,
        gpsLongitude: final.gpsLongitude || settings.gpsLongitude,
        workingHoursStart: final.operatingHoursStart,
        workingHoursEnd: final.operatingHoursEnd,
        akwaremitEnabled: final.enableAkwaRemit ?? settings.akwaremitEnabled,
        autoVerifyInsuranceOnCheckin: final.enableNhisBilling,
        requireVitalsBeforeConsult: settings.requireVitalsBeforeConsult,
        requireBillingClearanceBeforeDischarge: settings.requireBillingClearanceBeforeDischarge,
        updatedAt: new Date().toISOString(),
        updatedBy: session.badgeId || session.name,
      });

      const cat = loadFacilityCatalog(session.hospitalId, final.facilityName);
      saveFacilityCatalog({
        ...cat,
        name: final.facilityName || cat.name,
        ownership: final.ownership,
        type: tierTypeMap[final.hospitalTier] || cat.type,
        hfrCode: resolvedHfr || cat.hfrCode,
        registrationNo: resolvedHfr || cat.registrationNo,
        supervisoryBoard: final.supervisoryBoard || cat.supervisoryBoard,
        boardAuthCircularRef: final.boardAuthCircularRef || cat.boardAuthCircularRef,
        akshiaProviderId: final.akshiaProviderId || cat.akshiaProviderId,
        nhiaProviderCode: final.nhiaFacilityCode || cat.nhiaProviderCode,
        bhcpfCode: final.bhcpfCode || cat.bhcpfCode,
        medicalDirector: final.medicalDirector || cat.medicalDirector,
        cmdApprovalRef: final.cmdApprovalRef || cat.cmdApprovalRef,
        emrFocalPersonName: final.emrFocalPersonName || cat.emrFocalPersonName,
        lga: final.lga || cat.lga,
        ward: final.ward || cat.ward,
        gpsLatitude: final.gpsLatitude || cat.gpsLatitude,
        gpsLongitude: final.gpsLongitude || cat.gpsLongitude,
        address: final.physicalAddress || cat.address,
        phone: final.contactPhone || final.emrFocalPersonPhone || cat.phone,
        email: final.contactEmail || final.emrFocalPersonEmail || cat.email,
        services: {
          ...cat.services,
          family_medicine: final.specialties.includes('primary_care') || cat.services.family_medicine,
          general_medicine: final.specialties.includes('internal_medicine') || cat.services.general_medicine,
          surgery: final.specialties.includes('surgery') || cat.services.surgery,
          paediatrics: final.specialties.includes('paediatrics') || cat.services.paediatrics,
          obstetrics_gynaecology: final.specialties.includes('obstetrics') || cat.services.obstetrics_gynaecology,
          anc_pnc: final.specialties.includes('obstetrics') || cat.services.anc_pnc,
          emergency: final.specialties.includes('emergency') || cat.services.emergency,
          nhis_akshia_desk: final.specialties.includes('nhis_akshia_desk') || cat.services.nhis_akshia_desk,
          health_records_him: final.specialties.includes('health_records_him') || cat.services.health_records_him,
          immunization: final.specialties.includes('immunization_epi') || cat.services.immunization,
        },
      }, session.badgeId || session.name);
    } catch { /* optional */ }
    // Bind onboarding details to THIS admin account + facility (name, email, phone)
    try {
      const bound = bindFacilityOnboardingToAdmin({
        facilityId: session.hospitalId,
        facilityName: final.facilityName,
        adminBadgeId: session.badgeId,
        primaryContact: final.emrFocalPersonName || final.primaryContact || session.name,
        contactEmail: final.emrFocalPersonEmail || final.contactEmail || undefined,
        contactPhone: final.emrFocalPersonPhone || final.contactPhone,
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
    <WizardShell title="Facility setup" subtitle={`${session.facility || draft.facilityName || session.hospitalId} · First-time facility setup`} steps={ADMIN_STEPS} step={step} session={session}>
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', color: '#B91C1C', fontSize: '0.84rem', fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} />{error}
        </div>
      )}

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionTitle>Facility Classification &amp; Ownership</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <Field label="Official Facility Name (State Registry) *">
              <input style={inputStyle} value={draft.facilityName} onChange={(e) => patch({ facilityName: e.target.value })} placeholder="e.g. Immanuel General Hospital, Eket" />
            </Field>
            <Field label="Ownership *">
              <select
                style={inputStyle}
                value={draft.ownership}
                onChange={(e) => {
                  const nextOwn = e.target.value as FacilityOnboardDraft['ownership'];
                  patch({
                    ownership: nextOwn,
                    supervisoryBoard: defaultSupervisoryBoard(nextOwn, draft.hospitalTier),
                  });
                }}
              >
                <option value="public_state">Public (Akwa Ibom State Govt)</option>
                <option value="public_federal">Public (Federal Tertiary)</option>
                <option value="mission">Mission / Faith-Based</option>
                <option value="private">Private Specialist</option>
                <option value="ppp">Public-Private (PPP)</option>
              </select>
            </Field>
            <Field label="Facility Tier *">
              <select
                style={inputStyle}
                value={draft.hospitalTier}
                onChange={(e) => {
                  const nextTier = e.target.value as FacilityOnboardDraft['hospitalTier'];
                  patch({
                    hospitalTier: nextTier,
                    supervisoryBoard: defaultSupervisoryBoard(draft.ownership, nextTier),
                  });
                }}
              >
                <option value="primary_health_centre">Primary Health Centre (PHC)</option>
                <option value="district_general">General / Cottage Hospital</option>
                <option value="secondary_specialist">Specialist Hospital (e.g. Ibom Specialist)</option>
                <option value="tertiary_teaching">Federal Tertiary Hospital (e.g. UUTH)</option>
              </select>
            </Field>
          </div>

          {isPublicOwnership(draft.ownership) ? (
            <>
              <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12, padding: '10px 14px', fontSize: '0.78rem', color: '#0C4A6E', lineHeight: 1.45 }}>
                <strong>Akwa Ibom Public Hospital Onboarding:</strong> Commercial business documents (CAC, TIN, and private operating licences) are bypassed. Setup requires Government HFR Identifier, State Supervisory Board Authorization, and CMD Approval.
              </div>

              <SectionTitle>1. Government &amp; Regulatory Facility Identifiers</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Nigeria Health Facility Registry (HFR) Code *" hint="Mandatory for FMOH HFR, DHIS2 & NHMIS reporting">
                  <input style={inputStyle} value={draft.hfrCode} onChange={(e) => patch({ hfrCode: e.target.value })} placeholder="e.g. 03/06/1/2/1/0001" />
                </Field>
                <Field label="State / Federal Supervisory Board *" hint="Secondary: AKSHMB | Primary: AKSPHCDA | Ministerial: AKS MoH">
                  <select
                    style={inputStyle}
                    value={draft.supervisoryBoard}
                    onChange={(e) => patch({ supervisoryBoard: e.target.value as SupervisoryBoardKey })}
                  >
                    {SUPERVISORY_BOARDS.filter((b) => b.key !== 'PRIVATE_REG').map((b) => (
                      <option key={b.key} value={b.key}>{b.fullName}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Supervisory Board Authorization Letter / Circular Ref *" hint="MoH, HMB, or AKSPHCDA circular approving EMR deployment">
                  <input style={inputStyle} value={draft.boardAuthCircularRef} onChange={(e) => patch({ boardAuthCircularRef: e.target.value })} placeholder="e.g. HMB/AKS/EMR/2026/014" />
                </Field>
                <Field label="Circular Date &amp; Document Upload (PDF / Scan)">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="date" style={{ ...inputStyle, flex: 1 }} value={draft.boardAuthDate} onChange={(e) => patch({ boardAuthDate: e.target.value })} />
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '9px 12px', borderRadius: 10, background: '#0369A1', color: '#FFF', fontSize: '0.76rem', fontWeight: 700, cursor: boardDocBusy ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
                      <Upload size={13} />
                      <span>{boardDocBusy ? 'Uploading…' : draft.boardAuthDocUrl ? '✓ Uploaded' : 'Upload PDF/Img'}</span>
                      <input type="file" accept=".pdf,application/pdf,image/*" disabled={boardDocBusy} style={{ display: 'none' }} onChange={(e) => { void uploadGovernanceDoc(e.target.files?.[0] || null, 'board'); e.target.value = ''; }} />
                    </label>
                  </div>
                </Field>
                <Field label="AKSHIA Public Provider Code" hint="For Akwa Ibom State Health Insurance (akshealth.org) claims">
                  <input style={inputStyle} value={draft.akshiaProviderId} onChange={(e) => patch({ akshiaProviderId: e.target.value })} placeholder="Assigned AKSHIA code" />
                </Field>
                <Field label="NHIA / BHCPF Provider Codes">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input style={inputStyle} value={draft.nhiaFacilityCode} onChange={(e) => patch({ nhiaFacilityCode: e.target.value })} placeholder="NHIA Code" />
                    <input style={inputStyle} value={draft.bhcpfCode} onChange={(e) => patch({ bhcpfCode: e.target.value })} placeholder="BHCPF Code" />
                  </div>
                </Field>
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="State MoH Operating Licence No." hint="Private / Mission facility operating licence">
                <input style={inputStyle} value={draft.licenceNumber} onChange={(e) => patch({ licenceNumber: e.target.value })} />
              </Field>
              <Field label="HFR Code / NHIA / Tax ID (TIN)">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <input style={inputStyle} value={draft.hfrCode} onChange={(e) => patch({ hfrCode: e.target.value })} placeholder="HFR Code" />
                  <input style={inputStyle} value={draft.nhiaFacilityCode} onChange={(e) => patch({ nhiaFacilityCode: e.target.value })} placeholder="NHIA code" />
                  <input style={inputStyle} value={draft.taxId} onChange={(e) => patch({ taxId: e.target.value })} placeholder="TIN" />
                </div>
              </Field>
            </div>
          )}

          <SectionTitle>2. Facility Leadership &amp; Administrative Sign-Off</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Chief Medical Director (CMD) / Medical Superintendent *">
              <input style={inputStyle} value={draft.medicalDirector} onChange={(e) => patch({ medicalDirector: e.target.value })} placeholder="e.g. Dr. Iniobong Udoh" />
            </Field>
            <Field label="CMD Letterhead Approval Ref &amp; Document">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input style={{ ...inputStyle, flex: 1 }} value={draft.cmdApprovalRef} onChange={(e) => patch({ cmdApprovalRef: e.target.value })} placeholder="e.g. IGH/CMD/EMR/2026/002" />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '9px 12px', borderRadius: 10, background: '#0F172A', color: '#FFF', fontSize: '0.76rem', fontWeight: 700, cursor: cmdDocBusy ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
                  <Upload size={13} />
                  <span>{cmdDocBusy ? 'Uploading…' : draft.cmdApprovalDocUrl ? '✓ Signed Letter' : 'Upload Letter'}</span>
                  <input type="file" accept=".pdf,application/pdf,image/*" disabled={cmdDocBusy} style={{ display: 'none' }} onChange={(e) => { void uploadGovernanceDoc(e.target.files?.[0] || null, 'cmd'); e.target.value = ''; }} />
                </label>
              </div>
            </Field>
            <Field label="Designated EMR Focal Person / IT Administrator *" hint="Internal officer named in CMD letterhead">
              <input
                style={inputStyle}
                value={draft.emrFocalPersonName || draft.primaryContact}
                onChange={(e) => patch({ emrFocalPersonName: e.target.value, primaryContact: e.target.value })}
                placeholder="EMR Focal Person / IT Admin full name"
              />
            </Field>
            <Field label="Focal Person Phone &amp; Official Email">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input
                  style={inputStyle}
                  value={draft.contactPhone}
                  onChange={(e) => patch({ contactPhone: e.target.value, emrFocalPersonPhone: e.target.value })}
                  placeholder="+234 …"
                />
                <input
                  style={inputStyle}
                  type="email"
                  value={draft.contactEmail}
                  onChange={(e) => patch({ contactEmail: e.target.value, emrFocalPersonEmail: e.target.value })}
                  placeholder="focal@hospital.gov.ng"
                />
              </div>
            </Field>
          </div>

          {docNote && (
            <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '6px 10px' }}>
              {docNote}
            </div>
          )}

          <SectionTitle>3. Facility Metadata (State, LGA, Ward, GPS)</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="State / Local Government Area (LGA) *">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input style={inputStyle} value={draft.state} onChange={(e) => patch({ state: e.target.value })} placeholder="State" />
                {NIGERIA_STATE_LGAS[draft.state] || draft.state.toLowerCase().includes('akwa ibom') ? (
                  <select style={inputStyle} value={draft.lga} onChange={(e) => patch({ lga: e.target.value })}>
                    <option value="">Select LGA *</option>
                    {(NIGERIA_STATE_LGAS[draft.state] || AKWA_IBOM_LGAS).map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                ) : (
                  <input style={inputStyle} value={draft.lga} onChange={(e) => patch({ lga: e.target.value })} placeholder="LGA *" />
                )}
              </div>
            </Field>
            <Field label="Ward (Administrative / Political Ward) *">
              <input style={inputStyle} value={draft.ward} onChange={(e) => patch({ ward: e.target.value })} placeholder="e.g. Idua Ward I" />
            </Field>
            <Field label="Physical / Registry Address">
              <input style={inputStyle} value={draft.physicalAddress} onChange={(e) => patch({ physicalAddress: e.target.value })} placeholder="Hospital Road, …" />
            </Field>
            <Field label="Facility GPS Coordinates (Lat / Lng)">
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...inputStyle, flex: 1 }} value={draft.gpsLatitude} onChange={(e) => patch({ gpsLatitude: e.target.value })} placeholder="Lat" />
                <input style={{ ...inputStyle, flex: 1 }} value={draft.gpsLongitude} onChange={(e) => patch({ gpsLongitude: e.target.value })} placeholder="Lng" />
                <button type="button" onClick={captureGps} disabled={gpsBusy} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #BAE6FD', background: '#EFF6FF', color: '#0369A1', borderRadius: 10, padding: '0 10px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <MapPin size={13} /> {gpsBusy ? '…' : 'GPS'}
                </button>
              </div>
            </Field>
          </div>
          <SectionTitle>Active Clinical Units Inventory</SectionTitle>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>Select active clinical and records units (GOPD, Maternity, Pharmacy, Lab, NHIS/AKSHIA Desk, Health Records/HIM) — unlocks matching desks in MedCore.</p>
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
          <Toggle checked={draft.baaAccepted} onChange={(v) => patch({ baaAccepted: v })} label="Business Associate / Data Processing Agreement" desc="Accept MedCore data processing terms for this facility (NDPR-aligned storage and audit)." />
          <Field label="Signatory full name *"><input style={inputStyle} value={draft.baaSignedBy} onChange={(e) => patch({ baaSignedBy: e.target.value })} placeholder="Name of authorised officer" /></Field>
          <Field label="Data storage region" hint="Choose residency for clinical data">
            <select style={inputStyle} value={draft.storageRegion} onChange={(e) => patch({ storageRegion: e.target.value as StorageRegion })}>
              <option value="ng-lagos">Nigeria cloud (recommended)</option>
              <option value="local_only">Onsite hub preferred (LAN + cloud when online)</option>
              <option value="af-south">Africa region (if configured)</option>
            </select>
          </Field>
          <Field label="Audit log retention (years)">
            <input style={inputStyle} type="number" min={3} max={25} value={draft.auditRetentionYears} onChange={(e) => patch({ auditRetentionYears: parseInt(e.target.value) || 7 })} />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionTitle>Clinical desks & modules (in this app)</SectionTitle>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>
            Enable what this facility will run. Each toggle maps to a real MedCore workspace: Reception, Doctor, Nursing/Maternity, Laboratory, Pharmacy, Radiology, Theatre, Beds, Records (HIM), and Accounts/Cashier.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Toggle checked={draft.enableEprescribe} onChange={(v) => patch({ enableEprescribe: v })} label="e-Prescribing & pharmacy" desc="Orders from doctors → Pharmacy dispense queue." />
            <Toggle checked={draft.enableLis} onChange={(v) => patch({ enableLis: v })} label="Laboratory" desc="Lab orders, results, critical value alerts." />
            <Toggle checked={draft.enablePacs} onChange={(v) => patch({ enablePacs: v })} label="Radiology / imaging" desc="Radiology desk and imaging requests." />
            <Toggle checked={draft.enableNhisBilling} onChange={(v) => patch({ enableNhisBilling: v })} label="NHIA / insurance flags" desc="Check-in and Accounts insurance workflow." />
            <Toggle checked={draft.enableAkwaRemit} onChange={(v) => patch({ enableAkwaRemit: v })} label="AkwaRemit / Remita State Revenue" desc="Cashier POS, cash, and bank-transfer payments via Akwa Ibom TSA — keys configured on server." />
            <Toggle checked={draft.enableFhir} onChange={(v) => patch({ enableFhir: v })} label="FHIR export (optional)" desc="Only if an HIE partner requires export." />
            <Toggle checked={draft.enableHl7} onChange={(v) => patch({ enableHl7: v })} label="HL7 device gateway" desc="Only if analysers/devices will connect." />
          </div>
          <SectionTitle>How patients present</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {([['in_person', 'Walk-in / OPD'], ['telehealth', 'Telehealth'], ['home_visit', 'Home visit'], ['outreach', 'Outreach']] as [AppointmentType, string][]).map(([k, lab]) => (
              <Chip key={k} active={draft.appointmentTypes.includes(k)} onClick={() => toggleAppt(k)}>{lab}</Chip>
            ))}
          </div>
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, fontSize: '0.8rem', color: '#334155', lineHeight: 1.45 }}>
            <strong>Always available:</strong> Staff Access (enrol + ID cards), Command Centre, patient registry, notifications, MedCore cloud sync. Optional onsite LAN hub is set in Admin Settings when a hospital server is on UPS.
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionTitle>Roles this facility will enrol</SectionTitle>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>
            Same roles as Staff Access. After setup, create each staff member with <strong>Staff ID + PIN</strong>. Email + password is for administrators only.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {([
              ['hospital_admin', 'Hospital Admin'],
              ['doctor', 'Medical Officer'],
              ['surgeon', 'Surgeon'],
              ['nurse', 'Nursing'],
              ['midwife', 'Midwife'],
              ['reception', 'Reception'],
              ['records', 'Records / HIM'],
              ['accountant', 'Accounts'],
              ['pharmacist', 'Pharmacy'],
              ['lab', 'Laboratory'],
              ['radiologist', 'Radiology'],
              ['sysadmin', 'ICT / SysAdmin'],
            ] as [string, string][]).map(([key, lab]) => {
              const on = draft.seedRoles.includes(key);
              return (
                <Chip
                  key={key}
                  active={on}
                  onClick={() =>
                    patch({
                      seedRoles: on
                        ? draft.seedRoles.filter((r) => r !== key)
                        : [...draft.seedRoles, key],
                    })
                  }
                >
                  {lab}
                </Chip>
              );
            })}
          </div>
          <SectionTitle>Access policy</SectionTitle>
          <Toggle
            checked={draft.requireMfa}
            onChange={(v) => patch({ requireMfa: v })}
            label="Stronger MFA for admin email logins (optional)"
            desc="Desk staff continue with Staff ID + PIN. MFA is not required for PIN sign-in."
          />
          <Toggle
            checked={draft.enableSso}
            onChange={(v) => patch({ enableSso: v })}
            label="SSO via hospital directory (optional)"
            desc="Only if ICT will connect Azure AD / AD later. Not needed for badge desks."
          />
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
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: 14, fontSize: '0.82rem', color: '#065F46', lineHeight: 1.5 }}>
            <strong>This completes facility configuration.</strong>
            <ol style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              <li>Open <strong>Staff Access</strong> and enrol civil-service clinical &amp; HIM staff with Staff ID/IPPIS + practicing licences (MDCN, NMCN, PCN, MLSCN, HRORBN).</li>
              <li>Health Records (HIM) &amp; Reception initiate patient folders and visits; each clinical desk operates in its own module.</li>
              <li>Admin Settings: review HFR / AKSHIA / NHIA / BHCPF codes, AkwaRemit TSA, and onsite LAN hub URL if used.</li>
            </ol>
          </div>
        </div>
      )}

      <WizardFooter
        step={step} total={4}
        onBack={() => { setError(null); setStep((s) => Math.max(1, s - 1)); }}
        onNext={next}
        onFinish={finish}
        onSkip={() => setShowSkipConfirm(true)}
        skipLabel={step < 4 ? 'Skip remaining (configure later)' : undefined}
        finishLabel="Complete facility setup"
      />

      {showSkipConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#FFF', borderRadius: 16, maxWidth: 440, width: '100%', padding: 24, boxShadow: '0 20px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={20} color="#D97706" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>Skip Remaining Onboarding?</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>MedCore Hospital OS Configuration</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: '12px 0 20px' }}>
              Are you sure you want to skip remaining configuration steps? Recommended defaults will be applied. You can modify clinical specialties, compliance policies, and module access at any time in System Administration.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowSkipConfirm(false)}
                style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#FFF', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Continue Setup
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSkipConfirm(false);
                  finish();
                }}
                style={{ padding: '8px 16px', borderRadius: 10, background: '#0284C7', color: '#FFF', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                Yes, Skip for Now
              </button>
            </div>
          </div>
        </div>
      )}

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
    // Mark all identity handles so the wizard never re-triggers after re-login
    const extraIds = [session.id, session.email].filter(
      (k): k is string => !!k && typeof k === 'string' && k.trim().length > 0
    );
    markStaffOnboarded(session.badgeId || session.id, extraIds);
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
          <SectionTitle>Civil Service Identity &amp; Practicing License</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Employment Scheme">
              <select
                style={inputStyle}
                value={draft.employmentScheme || 'aks_civil_service'}
                onChange={(e) => patch({ employmentScheme: e.target.value as EmploymentSchemeKey })}
              >
                {EMPLOYMENT_SCHEMES.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Civil Service / IPPIS / AKSPHCDA ID" hint="Verifies active posting at this hospital">
              <input
                style={inputStyle}
                value={draft.civilServiceId || ''}
                onChange={(e) => patch({ civilServiceId: e.target.value })}
                placeholder="e.g. AKS/HMB/14829 or IPPIS-…"
              />
            </Field>
            <Field label="Regulatory Council">
              <select
                style={inputStyle}
                value={draft.regulatoryBody || getRequiredCouncilForRole(session.roleKey).council}
                onChange={(e) => patch({ regulatoryBody: e.target.value as RegulatoryCouncilCode })}
              >
                {Object.values(REGULATORY_COUNCILS).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.shortName} — {c.fullName}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Annual Practicing License / Registration No."
              hint={getRequiredCouncilForRole(session.roleKey).councilName}
            >
              <input
                style={inputStyle}
                value={draft.practicingLicenseNo || draft.medicalLicence || draft.npiOrMdcn || ''}
                onChange={(e) =>
                  patch({
                    practicingLicenseNo: e.target.value,
                    medicalLicence: e.target.value,
                  })
                }
                placeholder={getRequiredCouncilForRole(session.roleKey).placeholder}
              />
            </Field>
            <Field label="License Expiry Date">
              <input
                type="date"
                style={inputStyle}
                value={draft.licenseExpiry || ''}
                onChange={(e) => patch({ licenseExpiry: e.target.value })}
              />
            </Field>
            <Field label="Clinical specialty / unit">
              <input style={inputStyle} value={draft.specialty || ''} onChange={(e) => patch({ specialty: e.target.value })} placeholder="e.g. Obstetrics, GOPD, HIM" />
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
