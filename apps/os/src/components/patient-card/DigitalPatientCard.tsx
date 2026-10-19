'use client';

/**
 * Statewide Digital Health Card EMR Integration Module
 *
 * Implements the Statewide Health Card Architecture:
 * 1. Zero-Print Privacy Standard: Physical card acts strictly as a cryptographic pointer (no raw PHI on surface).
 * 2. State Health Identifier (SHID): Unique, standardized, non-sequential identifier.
 * 3. Secure QR Code Pointer: Encodes rotatable HTTPS HIE token, NEVER raw PHI.
 * 4. Emergency Flag UI: Boolean-driven visual anchor on the card (Medical Shield / Star of Life).
 * 5. Three-Tier Role-Based Access Control (RBAC) Scanning API:
 *    - Paramedic / Emergency Mode: Fast-path lightweight JSON (Blood type, Anaphylaxis, Code status).
 *    - General Practitioner / Clinic Mode: Full OAuth2 authenticated EHR records.
 *    - Public Civilian Mode: Safe public verification with zero PII.
 * 6. Offline-First Paramedic Capability: AES-256 encrypted local partition decryptable with paramedic hardware key.
 * 7. HL7 FHIR R4 Interoperability: Native FHIR R4 Bundle generation (Patient, AllergyIntolerance, Condition, Coverage).
 * 8. CR80 Standard Specification: 3.375" x 2.125" at print-ready 300 DPI canvas export & Apple Wallet (.pkpass) integration.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, UserPlus, CheckCircle2, Copy, Printer, QrCode, Building2,
  Phone, Calendar, CreditCard, X, RefreshCw, Shield, AlertTriangle,
  Lock, Key, Wifi, WifiOff, FileCode, Download, Eye, Smartphone,
  Activity, Sparkles, Send, Check, Terminal, ExternalLink, ShieldCheck
} from 'lucide-react';
import {
  listPatients,
  upsertPatient,
  subscribePatients,
  generateHospitalNumber,
  type FacilityPatient,
} from '../../lib/patientRegistryStore';
import { emitLiveAction } from '../../lib/liveActions';
import {
  getOrCreateStateHealthCard,
  generateSHID,
  checkEmergencyFlag,
  simulateScanResolution,
  generateFhirR4Bundle,
  generateAppleWalletPassJson,
  decryptOfflinePayload,
  type StatewideHealthCard,
  type ScanRoleMode,
} from '../../lib/stateHealthCardService';
import { StatewideHealthCardRenderer } from './StatewideHealthCardRenderer';

interface Props {
  session?: {
    hospitalId?: string;
    facility?: string;
    name?: string;
    roleKey?: string;
  };
}

const emptyForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  dob: '',
  sex: 'Male' as FacilityPatient['sex'],
  phone: '',
  email: '',
  address: '',
  state: 'Akwa Ibom',
  lga: 'Uyo',
  bloodGroup: 'O+',
  genotype: 'AA',
  emergencyContact: '',
  emergencyRelation: 'Next of Kin',
  occupation: '',
  nhiaNumber: '',
  nin: '',
  insuranceProvider: 'AKSHIA (State Health Scheme)',
  insuranceId: '',
  category: 'General',
  criticalAllergies: 'Penicillin (Anaphylaxis risk)',
  chronicConditions: 'Severe Asthma',
  currentMedications: 'Salbutamol Inhaler, EpiPen',
  emergencyFlagManual: false,
};

type ActiveTab = 'card' | 'rbac' | 'offline' | 'fhir' | 'register';

export const DigitalPatientCard: React.FC<Props> = ({ session }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const facilityName = session?.facility || 'Ikot Ekpene General Hospital';

  const [patients, setPatients] = useState<FacilityPatient[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('card');

  // Form state
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // RBAC Scanner state
  const [scanMode, setScanMode] = useState<ScanRoleMode>('paramedic');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any | null>(null);

  // Offline Paramedic state
  const [isOfflineMode, setIsOfflineMode] = useState(true);
  const [paramedicKeyInput, setParamedicKeyInput] = useState('AMBULANCE-KEY-8824');
  const [offlineDecrypted, setOfflineDecrypted] = useState<any | null>(null);
  const [offlineError, setOfflineError] = useState<string | null>(null);

  // Session storage check
  useEffect(() => {
    try {
      const id = sessionStorage.getItem('medcore_open_patient_id');
      const hn = sessionStorage.getItem('medcore_open_patient_hn');
      sessionStorage.removeItem('medcore_open_patient_id');
      sessionStorage.removeItem('medcore_open_patient_hn');
      if (id) setSelectedId(id);
      else if (hn) setSearch(hn);
    } catch {
      /* ignore */
    }
  }, []);

  const reload = useCallback(() => {
    let list = listPatients(facilityId);
    if (!list || list.length === 0) {
      list = listPatients();
    }
    setPatients(list);

    if (list.length > 0 && !selectedId) {
      setSelectedId(list[0].id);
    }
  }, [facilityId, selectedId]);

  useEffect(() => {
    reload();
    return subscribePatients(reload);
  }, [reload]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    flash(`Copied ${label} to clipboard`);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        (p.middleName || '').toLowerCase().includes(q) ||
        p.hospitalNumber.toLowerCase().includes(q) ||
        (p.shid || '').toLowerCase().includes(q) ||
        (p.nhiaNumber || '').toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }, [patients, search]);

  const selectedPatient = useMemo(() => {
    const p = patients.find((pt) => pt.id === selectedId);
    if (p) return p;
    if (patients.length > 0) return patients[0];
    return null;
  }, [patients, selectedId]);

  // Current patient's statewide health card
  const activeCard: StatewideHealthCard = useMemo(() => {
    if (selectedPatient) {
      return getOrCreateStateHealthCard(selectedPatient);
    }
    // Fallback standard demo card matching Alex Rivera from user brief
    return {
      shid: 'ARISE-PMC-78421',
      patientId: 'P-DEMO-01',
      fullName: 'Alex Rivera',
      dob: '15 March 1992',
      gender: 'Male',
      issueDate: '01 Jan 2026',
      expiryDate: '31 Dec 2028',
      emergencyFlag: true,
      emergencyReasons: ['Critical Allergy: Penicillin', 'Chronic Alert: Severe Asthma'],
      secureToken: 'eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2hpZS5ha3dhaWJvbS5nb3YubmciLCJzdWIiOiJBUklTRS1QTUMtNzg0MjEifQ.sig_arise',
      hieGatewayUrl: 'https://hie.akwaibom.gov.ng/gateway/v1/card/resolve?token=eyJhbGciOiJIUzI1NiJ9...',
      offlineEncryptedPayload: 'AES256-GCM::eyJzaGlkIjoiQVJJU0UtUE1DLTc4NDIxIiwiYmxvb2RUeXBlIjoiTysiLCJnZW5vdHlwZSI6IkFBIiwiY3JpdGljYWxBbGxlcmdpZXMiOlsiUGVuaWNpbGxpbiJdfQ==::TAG_9981',
      cardStatus: 'ACTIVE',
      issuingAuthority: 'ARISE State Health Information Exchange',
      stateMinistry: 'Akwa Ibom State Ministry of Health',
    };
  }, [selectedPatient]);

  // Execute Mock RBAC Scan
  const handleTriggerScan = (mode: ScanRoleMode) => {
    setScanMode(mode);
    setIsScanning(true);
    setScanResult(null);

    setTimeout(() => {
      const patient = selectedPatient || {
        id: 'P-DEMO-01',
        hospitalNumber: 'IGH-2026-00412',
        firstName: 'Alex',
        lastName: 'Rivera',
        dob: '1992-03-15',
        sex: 'Male',
        phone: '+234 802 000 7842',
        bloodGroup: 'O+',
        genotype: 'AA',
        allergies: ['Penicillin (Anaphylaxis risk)', 'Latex'],
        chronicConditions: ['Severe Asthma (Inhaler dependent)'],
        currentMedications: ['Salbutamol 100mcg Inhaler', 'EpiPen Auto-Injector'],
        emergencyContact: 'Dr. Elena Rivera',
        emergencyRelation: 'Spouse',
        facilityId,
        facilityName,
        status: 'active',
        registeredAt: new Date().toISOString(),
      } as FacilityPatient;

      const res = simulateScanResolution(activeCard, patient, mode);
      setScanResult(res);
      setIsScanning(false);
      flash(`Scanned successfully under ${mode.toUpperCase()} mode`);
    }, 600);
  };

  // Execute Offline Paramedic Decryption
  const handleDecryptOffline = () => {
    setOfflineError(null);
    setOfflineDecrypted(null);

    const res = decryptOfflinePayload(activeCard.offlineEncryptedPayload, paramedicKeyInput);
    if (res.success) {
      setOfflineDecrypted(res.data);
      flash('Hardware key verified · Emergency partition decrypted');
    } else {
      setOfflineError(res.error || 'Decryption failed');
    }
  };

  // Download Apple Wallet pass.json
  const handleDownloadWalletPass = () => {
    const passObj = generateAppleWalletPassJson(activeCard);
    const blob = new Blob([JSON.stringify(passObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arise-health-pass-${activeCard.shid}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('Downloaded Apple & Google Wallet pass manifest');
  };

  // Download FHIR R4 Bundle
  const handleDownloadFhir = () => {
    const patient = selectedPatient || ({} as FacilityPatient);
    const bundle = generateFhirR4Bundle(activeCard, patient);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FHIR-R4-Patient-${activeCard.shid}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('Downloaded HL7 FHIR R4 Bundle');
  };

  // Register New Patient with SHID
  const handleRegisterPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      flash('Please enter first and last name.');
      return;
    }
    if (!form.phone.trim()) {
      flash('Phone number is required for card token notifications.');
      return;
    }

    setBusy(true);
    try {
      const hospitalNumber = generateHospitalNumber(facilityId);
      const shid = generateSHID();
      const allergiesList = form.criticalAllergies
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const conditionsList = form.chronicConditions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const medsList = form.currentMedications
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const hasEmergency = checkEmergencyFlag({
        allergies: allergiesList,
        chronicConditions: conditionsList,
        emergencyFlag: form.emergencyFlagManual,
      }).hasEmergency;

      const newPatient: FacilityPatient = {
        id: hospitalNumber,
        hospitalNumber,
        shid,
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || undefined,
        lastName: form.lastName.trim(),
        dob: form.dob || '1992-03-15',
        sex: form.sex,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        state: form.state.trim() || 'Akwa Ibom',
        lga: form.lga.trim() || 'Uyo',
        bloodGroup: form.bloodGroup,
        genotype: form.genotype,
        emergencyContact: form.emergencyContact.trim() || undefined,
        emergencyRelation: form.emergencyRelation.trim() || undefined,
        occupation: form.occupation.trim() || undefined,
        nhiaNumber: form.nhiaNumber.trim() || undefined,
        nin: form.nin.trim() || undefined,
        insuranceProvider: form.insuranceProvider.trim() || undefined,
        insuranceId: form.insuranceId.trim() || undefined,
        category: form.category,
        facilityId,
        facilityName,
        status: 'active',
        registeredAt: new Date().toISOString(),
        lastVisit: new Date().toISOString().slice(0, 10),
        allergies: allergiesList,
        chronicConditions: conditionsList,
        currentMedications: medsList,
        emergencyFlag: hasEmergency,
        cardIssueDate: '01 Jan 2026',
        cardExpiryDate: '31 Dec 2028',
      };

      upsertPatient(newPatient);
      setSelectedId(newPatient.id);
      setActiveTab('card');
      setForm(emptyForm);
      reload();
      emitLiveAction(`Issued Statewide Health Card · ${shid}`, { module: 'patient-card' });
      flash(`Issued Card for ${newPatient.firstName} ${newPatient.lastName} (${shid})`);
    } finally {
      setBusy(false);
    }
  };

  const fullName = (p: FacilityPatient) =>
    [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');

  return (
    <div className="os-mpi-shell" style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
      {/* ── Top Hero Banner ── */}
      <div
        className="os-mpi-hero"
        style={{
          background: 'linear-gradient(135deg, #052A20 0%, #073B2E 50%, #0A2540 100%)',
          borderBottom: '1px solid rgba(52, 211, 153, 0.25)',
          padding: '24px 32px',
          borderRadius: 20,
          marginBottom: 20,
          color: '#fff',
          boxShadow: '0 16px 36px rgba(5, 42, 32, 0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  background: '#047857',
                  color: '#A7F3D0',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  padding: '3px 10px',
                  borderRadius: 999,
                  textTransform: 'uppercase',
                }}
              >
                ARISE EMR Module
              </span>
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38BDF8',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 999,
                }}
              >
                Zero-Print Privacy · HL7 FHIR R4
              </span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: '4px 0 8px', letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              Statewide Digital Health Card Suite
            </h1>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#94A3B8', flexWrap: 'wrap' }}>
              <span>Facility: <strong style={{ color: '#E2E8F0' }}>{facilityName}</strong></span>
              <span>•</span>
              <span>Enrolled Registry: <strong style={{ color: '#34D399' }}>{patients.length} patients</strong></span>
              <span>•</span>
              <span>Current SHID: <strong style={{ color: '#F97316', fontFamily: 'monospace' }}>{activeCard.shid}</strong></span>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="os-ghost-btn"
              onClick={() => setActiveTab('register')}
              style={{
                background: '#FFFFFF',
                color: '#047857',
                border: 'none',
                fontWeight: 800,
                fontSize: 13,
                padding: '9px 16px',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              <UserPlus size={16} /> Enroll &amp; Issue Card
            </button>
            <button
              type="button"
              className="os-ghost-btn"
              onClick={() => handleTriggerScan('paramedic')}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#FFFFFF',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                fontWeight: 700,
                fontSize: 13,
                padding: '9px 16px',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Smartphone size={16} /> Test RBAC Scan
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 22,
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            paddingTop: 16,
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'card' as const, label: 'CR80 Card Studio', icon: CreditCard, badge: 'Live 3D' },
            { id: 'rbac' as const, label: 'RBAC Scanner Simulator', icon: Smartphone, badge: '3 Modes' },
            { id: 'offline' as const, label: 'Offline Paramedic Vault', icon: WifiOff, badge: 'AES-256' },
            { id: 'fhir' as const, label: 'HL7 FHIR R4 Bundle', icon: FileCode, badge: 'Standard' },
            { id: 'register' as const, label: 'Enroll Patient', icon: UserPlus },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: active ? 800 : 600,
                  border: 'none',
                  background: active ? '#047857' : 'rgba(255, 255, 255, 0.08)',
                  color: active ? '#FFFFFF' : '#CBD5E1',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={16} />
                {tab.label}
                {tab.badge && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: active ? '#064E3B' : 'rgba(255,255,255,0.15)',
                      color: active ? '#6EE7B7' : '#94A3B8',
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 9999,
            background: '#064E3B',
            border: '1px solid #34D399',
            color: '#ECFDF5',
            padding: '12px 18px',
            borderRadius: 14,
            fontWeight: 700,
            fontSize: 13,
            boxShadow: '0 16px 36px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <CheckCircle2 size={18} color="#34D399" /> {toast}
        </div>
      )}

      {/* ── TAB 1: CR80 Card Studio & Patient Selector ── */}
      {activeTab === 'card' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 420px) minmax(480px, 1fr)',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {/* Left Column: Patient Registry List */}
          <div className="os-card" style={{ padding: 0, overflow: 'hidden', borderRadius: 16 }}>
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#F8FAFC',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0F172A' }}>
                Facility Patients ({filtered.length})
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className="os-ghost-btn"
                style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 8 }}
              >
                + New
              </button>
            </div>

            {/* Search Input */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F1F5F9', borderRadius: 10, padding: '7px 12px' }}>
                <Search size={15} color="#64748B" />
                <input
                  type="text"
                  placeholder="Search name, SHID, hospital no, phone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    width: '100%',
                    fontSize: 12.5,
                    color: '#0F172A',
                  }}
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                    <X size={14} color="#64748B" />
                  </button>
                )}
              </div>
            </div>

            {/* Patients Scroll List */}
            <div style={{ maxHeight: 540, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                  No matching patients found.
                </div>
              ) : (
                filtered.map((p) => {
                  const isSel = selectedId === p.id;
                  const hasAlert = checkEmergencyFlag(p).hasEmergency;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 16px',
                        border: 'none',
                        borderBottom: '1px solid #F1F5F9',
                        background: isSel ? '#F0FDF4' : '#FFFFFF',
                        borderLeft: isSel ? '4px solid #047857' : '4px solid transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A' }}>
                            {fullName(p)}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                            {p.sex} • DOB {p.dob || '—'} • {p.phone}
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                            <span style={{ fontSize: 10.5, fontFamily: 'monospace', fontWeight: 700, color: '#047857' }}>
                              {p.shid || p.hospitalNumber}
                            </span>
                            {hasAlert && (
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  background: '#FEE2E2',
                                  color: '#DC2626',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                <AlertTriangle size={10} /> Emergency
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: p.status === 'active' ? '#ECFDF5' : '#F1F5F9',
                            color: p.status === 'active' ? '#047857' : '#64748B',
                          }}
                        >
                          {p.status}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Visual Health Card & Specification Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* The CR80 Visual Card Component */}
            <div
              style={{
                background: '#0F172A',
                padding: '32px 24px',
                borderRadius: 24,
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={18} color="#34D399" />
                  <span style={{ color: '#E2E8F0', fontWeight: 800, fontSize: 13 }}>
                    CR80 Card Standard (3.375" × 2.125")
                  </span>
                </div>
                <span style={{ color: '#94A3B8', fontSize: 11 }}>
                  Click card to flip
                </span>
              </div>

              <StatewideHealthCardRenderer card={activeCard} />
            </div>

            {/* Card Metadata & Security Specifications */}
            <div className="os-card" style={{ padding: 20, borderRadius: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px', color: '#0F172A' }}>
                    Zero-Print Cryptographic Security Profile
                  </h3>
                  <p style={{ fontSize: 12.5, color: '#64748B', margin: 0 }}>
                    In compliance with the Zero-Print Privacy Standard, no medical diagnoses or blood types are visible on the physical surface.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleDownloadWalletPass}
                    className="os-ghost-btn"
                    style={{ fontSize: 12, padding: '7px 12px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 6 }}
                    title="Export Apple Wallet / Google Wallet pass file"
                  >
                    <Download size={14} /> Wallet .pkpass
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="os-ghost-btn"
                    style={{ fontSize: 12, padding: '7px 12px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Printer size={14} /> Print
                  </button>
                </div>
              </div>

              {/* Data Specifications Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 14,
                  marginTop: 18,
                  paddingTop: 16,
                  borderTop: '1px solid #E2E8F0',
                  fontSize: 12,
                }}
              >
                <div>
                  <div style={{ color: '#64748B', fontWeight: 600 }}>Standardized SHID</div>
                  <div style={{ fontWeight: 800, color: '#047857', fontFamily: 'monospace', fontSize: 13.5, marginTop: 2 }}>
                    {activeCard.shid}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748B', fontWeight: 600 }}>Emergency Visual Anchor</div>
                  <div style={{ fontWeight: 800, color: activeCard.emergencyFlag ? '#DC2626' : '#047857', marginTop: 2 }}>
                    {activeCard.emergencyFlag ? 'Active (Medical Shield Flagged)' : 'Standard (Clear)'}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748B', fontWeight: 600 }}>QR Resolution Pointer</div>
                  <div style={{ fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                    mTLS / OAuth2 HIE Gateway
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748B', fontWeight: 600 }}>Card Status</div>
                  <div style={{ fontWeight: 800, color: '#059669', marginTop: 2 }}>
                    {activeCard.cardStatus} · Rotatable Token
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748B', fontWeight: 600 }}>National Identity (NIN)</div>
                  <div style={{ fontWeight: 800, color: activeCard.nin ? '#047857' : '#64748B', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {activeCard.nin ? (
                      <>
                        <ShieldCheck size={14} color="#047857" />
                        <span>Bound ({activeCard.nin.slice(0, 4)}••••{activeCard.nin.slice(-3)})</span>
                      </>
                    ) : (
                      <span>Unbound (Optional)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Emergency Alert Reasons if any */}
              {activeCard.emergencyReasons && activeCard.emergencyReasons.length > 0 && (
                <div
                  style={{
                    marginTop: 16,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <AlertTriangle size={18} color="#DC2626" />
                  <div style={{ fontSize: 12, color: '#991B1B' }}>
                    <strong>Emergency Triggered:</strong> {activeCard.emergencyReasons.join(' • ')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: RBAC Scanner Simulator ── */}
      {activeTab === 'rbac' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 440px) 1fr', gap: 24, alignItems: 'start' }}>
          {/* Left: Device Mode Switcher */}
          <div className="os-card" style={{ padding: 22, borderRadius: 18 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px', color: '#0F172A' }}>
              Role-Based Access Control (RBAC) Engine
            </h3>
            <p style={{ fontSize: 12.5, color: '#64748B', marginBottom: 18 }}>
              Select a scanning device context to simulate how the Central State HIE responds to the encrypted QR pointer:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                {
                  id: 'paramedic' as const,
                  title: 'Emergency / Paramedic Mode',
                  badge: 'Ambulance Tablet · mTLS',
                  badgeColor: '#EF4444',
                  desc: 'High-availability, ultra-low-latency endpoint returning ONLY life-saving essentials (Blood Type, Anaphylaxis, Code Status). Zero clinical notes or demographic PII.',
                },
                {
                  id: 'clinic' as const,
                  title: 'General Practitioner Mode',
                  badge: 'Certified Clinic EMR · OAuth2',
                  badgeColor: '#0EA5E9',
                  desc: 'Triggers full OAuth2 handshake unlocking complete EHR: past visits, active problems, prescriptions, vitals, and HMO billing status.',
                },
                {
                  id: 'public' as const,
                  title: 'Public Civilian Phone Mode',
                  badge: 'Standard Camera · Zero PII',
                  badgeColor: '#10B981',
                  desc: 'Civilian scanning with camera app. Routes to generic public state verification screen confirming card authenticity with ZERO personal medical data.',
                },
              ].map((m) => {
                const isCurrent = scanMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleTriggerScan(m.id)}
                    style={{
                      textAlign: 'left',
                      padding: 14,
                      borderRadius: 12,
                      border: isCurrent ? '2px solid #047857' : '1px solid #E2E8F0',
                      background: isCurrent ? '#F0FDF4' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: 13.5, color: '#0F172A' }}>{m.title}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: m.badgeColor + '20',
                          color: m.badgeColor,
                        }}
                      >
                        {m.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 6, lineHeight: 1.45 }}>
                      {m.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                type="button"
                onClick={() => handleTriggerScan(scanMode)}
                disabled={isScanning}
                className="os-primary-btn"
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
                }}
              >
                {isScanning ? <RefreshCw size={16} className="os-spin" /> : <QrCode size={16} />}
                {isScanning ? 'Resolving HIE Token…' : `Scan Card as ${scanMode.toUpperCase()}`}
              </button>
            </div>
          </div>

          {/* Right: Returned Payload Terminal Inspector */}
          <div
            style={{
              background: '#0B132B',
              borderRadius: 20,
              padding: 24,
              color: '#E2E8F0',
              fontFamily: 'monospace',
              fontSize: 12.5,
              minHeight: 520,
              boxShadow: '0 20px 45px rgba(0,0,0,0.3)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', paddingBottom: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Terminal size={16} color="#34D399" />
                <span style={{ fontWeight: 800, color: '#34D399' }}>HIE GATEWAY RESPONSE</span>
                {scanResult?.latencyMs && (
                  <span style={{ fontSize: 11, background: '#1E293B', padding: '2px 6px', borderRadius: 4, color: '#38BDF8' }}>
                    {scanResult.latencyMs}ms Latency
                  </span>
                )}
              </div>

              {scanResult && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(JSON.stringify(scanResult, null, 2), 'HIE Response')}
                  style={{
                    border: 'none',
                    background: '#1E293B',
                    color: '#94A3B8',
                    padding: '4px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Copy size={12} /> {copied === 'HIE Response' ? 'Copied' : 'Copy JSON'}
                </button>
              )}
            </div>

            {isScanning ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                <RefreshCw size={28} className="os-spin" style={{ margin: '0 auto 12px', color: '#34D399' }} />
                <div>Authenticating device certificate against Central State Registry…</div>
              </div>
            ) : scanResult ? (
              <div style={{ overflowX: 'auto', maxHeight: 460 }}>
                {/* Visual highlights if Paramedic Mode */}
                {scanMode === 'paramedic' && (
                  <div
                    style={{
                      marginBottom: 16,
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid #EF4444',
                      padding: 12,
                      borderRadius: 10,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    <div style={{ color: '#FCA5A5', fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
                      ⚠️ PARAMEDIC FAST-PATH TRIAGE PAYLOAD
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, fontSize: 12 }}>
                      <div>Blood Type: <strong style={{ color: '#FFFFFF' }}>{scanResult.bloodType}</strong></div>
                      <div>Genotype: <strong style={{ color: '#FFFFFF' }}>{scanResult.genotype}</strong></div>
                      <div>Code Status: <strong style={{ color: '#F87171' }}>{scanResult.codeStatus}</strong></div>
                    </div>
                  </div>
                )}

                {/* Visual highlights if Public Mode */}
                {scanMode === 'public' && (
                  <div
                    style={{
                      marginBottom: 16,
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid #10B981',
                      padding: 12,
                      borderRadius: 10,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    <div style={{ color: '#6EE7B7', fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
                      🛡️ PUBLIC STATE HEALTH VERIFICATION (ZERO PII)
                    </div>
                    <div style={{ fontSize: 12, color: '#E2E8F0' }}>
                      {scanResult.message}
                    </div>
                  </div>
                )}

                <pre style={{ margin: 0, color: '#A7F3D0', lineHeight: 1.5 }}>
                  {JSON.stringify(scanResult, null, 2)}
                </pre>
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
                Click a device mode on the left or tap "Scan Card" to inspect live response.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: Offline-First Paramedic Storage (AES-256) ── */}
      {activeTab === 'offline' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 460px) 1fr', gap: 24, alignItems: 'start' }}>
          {/* Left: Offline Simulator Controls */}
          <div className="os-card" style={{ padding: 22, borderRadius: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ padding: 8, borderRadius: 10, background: '#FEF3C7', color: '#D97706' }}>
                <WifiOff size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Offline Paramedic Encryption Vault
                </h3>
                <div style={{ fontSize: 12, color: '#64748B' }}>0% Cellular &amp; Remote Region Architecture</div>
              </div>
            </div>

            <p style={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.5, marginBottom: 16 }}>
              In remote state territories without cellular coverage, paramedics rely on hardware-encrypted emergency partitions stored locally on smart cards or secure digital wallet passes.
            </p>

            <div style={{ padding: 14, background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Raw Encrypted Container (AES-256-GCM)
              </div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#0F172A', wordBreak: 'break-all', marginTop: 4 }}>
                {activeCard.offlineEncryptedPayload}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Paramedic Hardware Key / Biometric Security Token
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={paramedicKeyInput}
                  onChange={(e) => setParamedicKeyInput(e.target.value)}
                  placeholder="e.g. AMBULANCE-KEY-8824"
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: '1px solid #CBD5E1',
                    fontSize: 12.5,
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  type="button"
                  onClick={handleDecryptOffline}
                  className="os-primary-btn"
                  style={{ fontSize: 12.5, padding: '9px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Key size={14} /> Decrypt
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <span style={{ fontSize: 11, color: '#64748B' }}>Valid Keys:</span>
                {['AMBULANCE-KEY-8824', 'PARAMEDIC-EMS-911', 'RESCUE-KEY-2026'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setParamedicKeyInput(k)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: '#047857',
                      fontSize: 11,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {offlineError && (
              <div style={{ padding: 12, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 12 }}>
                {offlineError}
              </div>
            )}
          </div>

          {/* Right: Decrypted Offline Results */}
          <div className="os-card" style={{ padding: 22, borderRadius: 18, minHeight: 460 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px', color: '#0F172A' }}>
              Decrypted Local Triage Summary
            </h3>

            {offlineDecrypted ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: 12, borderRadius: 10, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={16} /> Successfully decrypted offline via state-certified hardware key.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                  <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10 }}>
                    <div style={{ color: '#64748B', fontSize: 11, fontWeight: 700 }}>BLOOD TYPE</div>
                    <div style={{ fontWeight: 900, fontSize: 18, color: '#DC2626', marginTop: 2 }}>
                      {offlineDecrypted.bloodType}
                    </div>
                  </div>

                  <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10 }}>
                    <div style={{ color: '#64748B', fontSize: 11, fontWeight: 700 }}>GENOTYPE</div>
                    <div style={{ fontWeight: 900, fontSize: 18, color: '#047857', marginTop: 2 }}>
                      {offlineDecrypted.genotype}
                    </div>
                  </div>

                  <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, gridColumn: 'span 2' }}>
                    <div style={{ color: '#64748B', fontSize: 11, fontWeight: 700 }}>CODE STATUS</div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', marginTop: 2 }}>
                      {offlineDecrypted.codeStatus}
                    </div>
                  </div>

                  <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, gridColumn: 'span 2' }}>
                    <div style={{ color: '#64748B', fontSize: 11, fontWeight: 700 }}>CRITICAL ALLERGIES</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#B91C1C', marginTop: 2 }}>
                      {Array.isArray(offlineDecrypted.criticalAllergies)
                        ? offlineDecrypted.criticalAllergies.join(', ')
                        : offlineDecrypted.criticalAllergies}
                    </div>
                  </div>

                  <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, gridColumn: 'span 2' }}>
                    <div style={{ color: '#64748B', fontSize: 11, fontWeight: 700 }}>EMERGENCY CONTACT</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', marginTop: 2 }}>
                      {offlineDecrypted.emergencyContact}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                <Lock size={32} style={{ margin: '0 auto 12px', color: '#CBD5E1' }} />
                Emergency partition is encrypted. Enter paramedic key on the left to unlock.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: HL7 FHIR Interoperability Standard ── */}
      {activeTab === 'fhir' && (
        <div className="os-card" style={{ padding: 24, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px', color: '#0F172A' }}>
                HL7 FHIR R4 Compliant Interoperability Bundle
              </h3>
              <p style={{ fontSize: 12.5, color: '#64748B', margin: 0 }}>
                Standardized healthcare exchange data structure compatible with Epic, Cerner, and national registries.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={handleDownloadFhir}
                className="os-primary-btn"
                style={{ fontSize: 12.5, padding: '8px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={14} /> Download .fhir.json
              </button>
            </div>
          </div>

          <div
            style={{
              background: '#0B132B',
              borderRadius: 14,
              padding: 20,
              color: '#A7F3D0',
              fontFamily: 'monospace',
              fontSize: 12,
              maxHeight: 520,
              overflowY: 'auto',
            }}
          >
            <pre style={{ margin: 0 }}>
              {JSON.stringify(generateFhirR4Bundle(activeCard, selectedPatient || ({} as FacilityPatient)), null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* ── TAB 5: Enroll Patient & Issue SHID ── */}
      {activeTab === 'register' && (
        <div className="os-card" style={{ padding: 26, borderRadius: 20, maxWidth: 840, margin: '0 auto' }}>
          <div style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: 14, marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px', color: '#0F172A' }}>
              Enroll Patient &amp; Generate State Health Card
            </h3>
            <p style={{ fontSize: 12.5, color: '#64748B', margin: 0 }}>
              Generates a standardized SHID (non-sequential format) and links to the Statewide Health Information Exchange.
            </p>
          </div>

          <form onSubmit={handleRegisterPatient} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                First Name *
                <input
                  type="text"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 8, border: '1px solid #CBD5E1' }}
                  placeholder="e.g. Alex"
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                Middle Name
                <input
                  type="text"
                  value={form.middleName}
                  onChange={(e) => setForm({ ...form, middleName: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 8, border: '1px solid #CBD5E1' }}
                  placeholder="e.g. M."
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                Last Name *
                <input
                  type="text"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 8, border: '1px solid #CBD5E1' }}
                  placeholder="e.g. Rivera"
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                Date of Birth
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm({ ...form, dob: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 8, border: '1px solid #CBD5E1' }}
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                Gender
                <select
                  value={form.sex}
                  onChange={(e) => setForm({ ...form, sex: e.target.value as any })}
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 8, border: '1px solid #CBD5E1' }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                Phone Number *
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 8, border: '1px solid #CBD5E1' }}
                  placeholder="e.g. 0802 000 7842"
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                Blood Group
                <select
                  value={form.bloodGroup}
                  onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 8, border: '1px solid #CBD5E1' }}
                >
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </label>
            </div>

            {/* National Identity & Health Insurance Identification */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                National Identity Number (NIN)
                <span style={{ fontSize: 11, fontWeight: 600, color: '#047857', marginLeft: 6 }}>
                  (Binds to Digital Health Card)
                </span>
                <input
                  type="text"
                  maxLength={11}
                  value={form.nin}
                  onChange={(e) => setForm({ ...form, nin: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 8, border: '1px solid #CBD5E1' }}
                  placeholder="11-digit NIN (e.g. 12345678901)"
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                NHIA / State Scheme Number
                <input
                  type="text"
                  value={form.nhiaNumber}
                  onChange={(e) => setForm({ ...form, nhiaNumber: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 8, border: '1px solid #CBD5E1' }}
                  placeholder="e.g. AKSHIA-POL-88201"
                />
              </label>
            </div>

            {/* Emergency & Alert Profile */}
            <div style={{ background: '#F8FAFC', padding: 16, borderRadius: 12, border: '1px solid #E2E8F0', marginTop: 6 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={16} color="#DC2626" /> First Responder Critical Alerts (Triggers Card Emergency Flag)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>
                  Critical Allergies (comma separated)
                  <input
                    type="text"
                    value={form.criticalAllergies}
                    onChange={(e) => setForm({ ...form, criticalAllergies: e.target.value })}
                    placeholder="e.g. Penicillin, Latex, Peanuts"
                    style={{ width: '100%', padding: '8px 10px', marginTop: 4, borderRadius: 8, border: '1px solid #CBD5E1' }}
                  />
                </label>

                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>
                  Chronic Alert Conditions
                  <input
                    type="text"
                    value={form.chronicConditions}
                    onChange={(e) => setForm({ ...form, chronicConditions: e.target.value })}
                    placeholder="e.g. Severe Asthma, Epilepsy"
                    style={{ width: '100%', padding: '8px 10px', marginTop: 4, borderRadius: 8, border: '1px solid #CBD5E1' }}
                  />
                </label>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12, fontWeight: 700, color: '#DC2626', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.emergencyFlagManual}
                  onChange={(e) => setForm({ ...form, emergencyFlagManual: e.target.checked })}
                />
                Force Emergency Flag Visual Anchor on Physical Card Surface
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setActiveTab('card')}
                className="os-ghost-btn"
                style={{ padding: '9px 18px', borderRadius: 10 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="os-primary-btn"
                style={{
                  padding: '9px 24px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
                }}
              >
                {busy ? 'Registering…' : 'Issue Statewide Health Card'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default DigitalPatientCard;
