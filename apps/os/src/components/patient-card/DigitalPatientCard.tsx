'use client';

/**
 * Patient MPI / digital card — realtime facility registry (no demo patients).
 * Reception-safe: identity, contact, insurance, visit status — not clinical notes.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, UserPlus, CheckCircle2, Copy, Printer, QrCode, Building2,
  Phone, Calendar, CreditCard, X, RefreshCw,
} from 'lucide-react';
import {
  listPatients,
  upsertPatient,
  subscribePatients,
  generateHospitalNumber,
  resetPatientRegistry,
  type FacilityPatient,
} from '../../lib/patientRegistryStore';
import { emitLiveAction } from '../../lib/liveActions';

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
  sex: 'Female' as FacilityPatient['sex'],
  phone: '',
  email: '',
  address: '',
  state: 'Akwa Ibom',
  lga: '',
  bloodGroup: '',
  genotype: '',
  emergencyContact: '',
  emergencyRelation: '',
  occupation: '',
  nhiaNumber: '',
  nin: '',
  insuranceProvider: '',
  insuranceId: '',
  category: 'General',
};

export const DigitalPatientCard: React.FC<Props> = ({ session }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const facilityName = session?.facility || 'Hospital';

  const [patients, setPatients] = useState<FacilityPatient[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = useCallback(() => {
    setPatients(listPatients(facilityId));
  }, [facilityId]);

  useEffect(() => {
    reload();
    return subscribePatients(reload);
  }, [reload]);

  // Optional cloud pull
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const { firestoreSubscribeFacility } = await import('../../lib/firebase');
        unsub = firestoreSubscribeFacility(facilityId, (data) => {
          const remote = data.patients;
          if (!Array.isArray(remote) || remote.length === 0) return;
          try {
            const local = listPatients();
            const byId = new Map(local.map((p) => [p.id, p]));
            for (const r of remote as FacilityPatient[]) {
              if (r?.id) byId.set(r.id, r);
            }
            const merged = Array.from(byId.values());
            localStorage.setItem('medcore_os_patient_registry_v1', JSON.stringify(merged));
            reload();
          } catch {
            /* ignore */
          }
        });
      } catch {
        /* offline */
      }
    })();
    return () => unsub();
  }, [facilityId, reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        (p.middleName || '').toLowerCase().includes(q) ||
        p.hospitalNumber.toLowerCase().includes(q) ||
        (p.nhiaNumber || '').toLowerCase().includes(q) ||
        (p.nin || '').toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }, [patients, search]);

  const selected = patients.find((p) => p.id === selectedId) || null;

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      flash('Enter first and last name.');
      return;
    }
    if (!form.phone.trim()) {
      flash('Phone number is required.');
      return;
    }
    setBusy(true);
    try {
      const hospitalNumber = generateHospitalNumber(facilityId);
      const patient: FacilityPatient = {
        id: hospitalNumber,
        hospitalNumber,
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || undefined,
        lastName: form.lastName.trim(),
        dob: form.dob || '',
        sex: form.sex,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        state: form.state.trim() || undefined,
        lga: form.lga.trim() || undefined,
        bloodGroup: form.bloodGroup || undefined,
        genotype: form.genotype || undefined,
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
      };
      upsertPatient(patient);
      setSelectedId(patient.id);
      setShowRegister(false);
      setForm(emptyForm);
      reload();
      emitLiveAction(`Patient registered · ${patient.hospitalNumber}`, { module: 'patient-card' });
      flash(`Registered ${patient.firstName} ${patient.lastName} · ${patient.hospitalNumber}`);
    } finally {
      setBusy(false);
    }
  };

  const fullName = (p: FacilityPatient) =>
    [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');

  return (
    <div className="os-mpi-shell">
      <div className="os-mpi-hero">
        <div>
          <div className="os-chip">Patient MPI · Live</div>
          <h1>Register &amp; find patients</h1>
          <div className="os-mpi-hero-meta">
            <span>{facilityName}</span>
            <span>{patients.length} enrolled</span>
            <span>Front-desk safe · no clinical chart dump</span>
          </div>
        </div>
        <button type="button" className="os-ghost-btn" style={{ background: '#fff', color: '#0284C7', borderColor: '#fff', fontWeight: 800 }} onClick={() => setShowRegister(true)}>
          <UserPlus size={16} /> Register patient
        </button>
      </div>
      {toast && (
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
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 240 }} className="os-search-wrap">
          <Search size={16} style={{ color: '#0052D4' }} />
          <input
            className="os-search-input"
            placeholder="Search name, hospital no., phone, NIN, AKSHIA…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="button" className="os-primary-btn" onClick={() => setShowRegister(true)}>
          <UserPlus size={16} /> Register patient
        </button>
        <button
          type="button"
          className="os-ghost-btn"
          onClick={() => {
            reload();
            flash('Patient list refreshed');
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
        {patients.length > 0 && (
          <button
            type="button"
            className="os-ghost-btn"
            style={{ color: '#B91C1C', borderColor: 'rgba(185,28,28,0.3)', fontSize: 12 }}
            onClick={() => {
              if (window.confirm('Clear all patients on this browser for a fresh MPI?')) {
                resetPatientRegistry();
                setSelectedId(null);
                reload();
                flash('Patient registry cleared');
              }
            }}
          >
            Reset list
          </button>
        )}
      </div>

      <div style={{ fontSize: 13, color: '#64748B' }}>
        <Building2 size={13} style={{ display: 'inline', marginRight: 4 }} />
        {facilityName} · <strong>{patients.length}</strong> enrolled
        {patients.length === 0 && ' · register the first patient to begin'}
      </div>

      {/* Register form */}
      {showRegister && (
        <form className="os-card os-register-panel" onSubmit={handleRegister} style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>New patient registration</div>
            <button type="button" className="os-ghost-btn" style={{ padding: 6 }} onClick={() => setShowRegister(false)}>
              <X size={16} />
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {(
              [
                ['firstName', 'First name *'],
                ['middleName', 'Middle name'],
                ['lastName', 'Last name *'],
                ['dob', 'Date of birth'],
                ['phone', 'Phone *'],
                ['email', 'Email'],
                ['address', 'Address'],
                ['lga', 'LGA'],
                ['state', 'State'],
                ['occupation', 'Occupation'],
                ['emergencyContact', 'Emergency contact'],
                ['emergencyRelation', 'Relationship'],
                ['nhiaNumber', 'AKSHIA / NHIA no.'],
                ['nin', 'National NIN'],
                ['insuranceProvider', 'HMO / insurer'],
                ['insuranceId', 'Insurance ID'],
                ['bloodGroup', 'Blood group'],
                ['genotype', 'Genotype'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                {label}
                <input
                  className="os-search-input"
                  style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px' }}
                  type={key === 'dob' ? 'date' : key === 'email' ? 'email' : 'text'}
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  required={key === 'firstName' || key === 'lastName' || key === 'phone'}
                />
              </label>
            ))}
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
              Sex
              <select
                className="os-form-select"
                style={{ display: 'block', width: '100%', marginTop: 6 }}
                value={form.sex}
                onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value as FacilityPatient['sex'] }))}
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
              Category
              <select
                className="os-form-select"
                style={{ display: 'block', width: '100%', marginTop: 6 }}
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                <option>General</option>
                <option>Paediatric</option>
                <option>Antenatal</option>
                <option>Staff</option>
                <option>HMO</option>
                <option>Emergency</option>
              </select>
            </label>
          </div>
          <button type="submit" disabled={busy} className="os-primary-btn" style={{ marginTop: 16 }}>
            {busy ? 'Saving…' : 'Register & issue hospital number'}
          </button>
        </form>
      )}

      {/* List + card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div className="os-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', fontWeight: 800, fontSize: 13 }}>
            Facility patient list ({filtered.length})
          </div>
          {filtered.length === 0 ? (
            <div className="os-empty-state">
              <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
              <div style={{ fontWeight: 700, color: '#0A2540', marginBottom: 6 }}>No patients enrolled yet</div>
              Demo records are cleared. Click <strong>Register patient</strong> to create the first hospital number and digital card.
            </div>
          ) : (
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`os-mpi-list-item${selectedId === p.id ? ' is-selected' : ''}`}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 16px',
                    border: 'none',
                    borderBottom: '1px solid #F1F5F9',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0A2540' }}>{fullName(p)}</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                        {p.sex}
                        {p.dob ? ` · DOB ${p.dob}` : ''}
                        {p.lga ? ` · ${p.lga}` : ''} · {p.phone}
                      </div>
                      <div style={{ fontSize: 11, marginTop: 4, fontFamily: 'var(--os-font-mono)', color: '#0052D4', fontWeight: 700 }}>
                        {p.hospitalNumber}
                        {p.nhiaNumber ? ` · ${p.nhiaNumber}` : ''}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: '#059669',
                        background: '#ECFDF5',
                        padding: '4px 8px',
                        borderRadius: 999,
                        height: 'fit-content',
                      }}
                    >
                      Active
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="os-card" style={{ padding: 16 }}>
          {!selected ? (
            <div style={{ color: '#94A3B8', textAlign: 'center', padding: 28, fontSize: 13 }}>
              Select a patient or register a new one to view their digital card.
            </div>
          ) : (
            <>
              <div className="os-digital-card" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', opacity: 0.85 }}>
                  HOSPITAL DIGITAL HEALTH CARD
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8, letterSpacing: '-0.02em' }}>
                  {fullName(selected).toUpperCase()}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, fontSize: 11 }}>
                  <div>
                    <div style={{ opacity: 0.75 }}>Sex</div>
                    <div style={{ fontWeight: 700 }}>{selected.sex}</div>
                  </div>
                  <div>
                    <div style={{ opacity: 0.75 }}>DOB</div>
                    <div style={{ fontWeight: 700 }}>{selected.dob || '—'}</div>
                  </div>
                  <div>
                    <div style={{ opacity: 0.75 }}>Phone</div>
                    <div style={{ fontWeight: 700 }}>{selected.phone}</div>
                  </div>
                  <div>
                    <div style={{ opacity: 0.75 }}>LGA</div>
                    <div style={{ fontWeight: 700 }}>{selected.lga || '—'}</div>
                  </div>
                </div>
                <div style={{ marginTop: 14, fontFamily: 'var(--os-font-mono)', fontSize: 13, fontWeight: 800 }}>
                  {selected.hospitalNumber}
                </div>
                {selected.nhiaNumber && (
                  <div style={{ marginTop: 4, fontSize: 11, opacity: 0.9 }}>{selected.nhiaNumber}</div>
                )}
              </div>

              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, marginBottom: 12 }}>
                <div>
                  <strong>Facility:</strong> {selected.facilityName}
                </div>
                <div>
                  <strong>Registered:</strong> {selected.registeredAt.slice(0, 10)}
                </div>
                {selected.insuranceProvider && (
                  <div>
                    <strong>HMO:</strong> {selected.insuranceProvider} {selected.insuranceId || ''}
                  </div>
                )}
                {selected.nin && (
                  <div>
                    <strong>NIN:</strong> {selected.nin}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  className="os-ghost-btn"
                  onClick={() => {
                    navigator.clipboard?.writeText(selected.hospitalNumber);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  <Copy size={14} /> {copied ? 'Copied' : 'Copy hospital number'}
                </button>
                <button type="button" className="os-ghost-btn" onClick={() => window.print()}>
                  <Printer size={14} /> Print card
                </button>
                <button
                  type="button"
                  className="os-primary-btn"
                  onClick={() => {
                    const next = {
                      ...selected,
                      lastVisit: new Date().toISOString().slice(0, 10),
                    };
                    upsertPatient(next);
                    reload();
                    emitLiveAction(`Check-in · ${selected.hospitalNumber}`, { module: 'patient-card' });
                    flash(`Checked in ${fullName(selected)}`);
                  }}
                >
                  <CheckCircle2 size={14} /> Check in today
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DigitalPatientCard;
