'use client';

import React, { useState, useEffect } from 'react';
import {
  type FacilityPatient,
  type PatientSex,
  upsertPatient,
} from '../../lib/patientRegistryStore';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  Shield,
  Heart,
  Save,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  patient: FacilityPatient | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updated: FacilityPatient) => void;
}

export const EditPatientModal: React.FC<Props> = ({
  patient,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [hospitalNumber, setHospitalNumber] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState<PatientSex>('Other');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('');
  const [lga, setLga] = useState('');
  const [nin, setNin] = useState('');
  const [nhiaNumber, setNhiaNumber] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [genotype, setGenotype] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [occupation, setOccupation] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (patient) {
      setFirstName(patient.firstName || '');
      setMiddleName(patient.middleName || '');
      setLastName(patient.lastName || '');
      setHospitalNumber(patient.hospitalNumber || '');
      setDob(patient.dob || '');
      setSex(patient.sex || 'Other');
      setPhone(patient.phone || '');
      setEmail(patient.email || '');
      setAddress(patient.address || '');
      setState(patient.state || '');
      setLga(patient.lga || '');
      setNin(patient.nin || '');
      setNhiaNumber(patient.nhiaNumber || '');
      setBloodGroup(patient.bloodGroup || '');
      setGenotype(patient.genotype || '');
      setEmergencyContact(patient.emergencyContact || '');
      setEmergencyRelation(patient.emergencyRelation || '');
      setOccupation(patient.occupation || '');
      setError('');
      setSuccess(false);
    }
  }, [patient]);

  if (!isOpen || !patient) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const updated: FacilityPatient = {
        ...patient,
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        hospitalNumber: hospitalNumber.trim() || patient.hospitalNumber,
        dob: dob || patient.dob,
        sex,
        phone: phone.trim() || patient.phone,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        state: state.trim() || undefined,
        lga: lga.trim() || undefined,
        nin: nin.trim() || undefined,
        nhiaNumber: nhiaNumber.trim() || undefined,
        bloodGroup: bloodGroup.trim() || undefined,
        genotype: genotype.trim() || undefined,
        emergencyContact: emergencyContact.trim() || undefined,
        emergencyRelation: emergencyRelation.trim() || undefined,
        occupation: occupation.trim() || undefined,
      };

      upsertPatient(updated);
      setSuccess(true);
      onSaved?.(updated);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err?.message || 'Failed to save changes. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="os-card"
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          borderRadius: 20,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: '#0284C7',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
              }}
            >
              <User size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>
                Edit Patient Demographics (HIM Records)
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
                Master Patient Index · {patient.hospitalNumber || patient.id}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="os-ghost-btn"
            style={{ padding: 6, borderRadius: 8 }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#059669',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircle2 size={16} /> Demographics updated and saved to Aurora PostgreSQL.
            </div>
          )}

          {/* Section 1: Names */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                First Name *
              </label>
              <input
                className="os-search-input"
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Middle Name
              </label>
              <input
                className="os-search-input"
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Last Name *
              </label>
              <input
                className="os-search-input"
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Section 2: Folder Number, Sex, DOB */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Hospital / Folder Number
              </label>
              <input
                className="os-search-input"
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                value={hospitalNumber}
                onChange={(e) => setHospitalNumber(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Date of Birth
              </label>
              <input
                type="date"
                className="os-search-input"
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Gender / Sex
              </label>
              <select
                className="os-form-select"
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                value={sex}
                onChange={(e) => setSex(e.target.value as PatientSex)}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Section 3: Contact */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Phone Number
              </label>
              <input
                className="os-search-input"
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Email Address
              </label>
              <input
                type="email"
                className="os-search-input"
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Section 4: Address, State, LGA */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Residential Address
              </label>
              <input
                className="os-search-input"
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                State of Residence
              </label>
              <input
                className="os-search-input"
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                LGA
              </label>
              <input
                className="os-search-input"
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                value={lga}
                onChange={(e) => setLga(e.target.value)}
              />
            </div>
          </div>

          {/* Section 5: Identification (NIN & NHIA) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                National ID Number (NIN - 11 digits)
              </label>
              <input
                className="os-search-input"
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                value={nin}
                maxLength={11}
                placeholder="e.g. 12345678901"
                onChange={(e) => setNin(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                NHIA / State Health Insurance ID
              </label>
              <input
                className="os-search-input"
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                value={nhiaNumber}
                placeholder="e.g. AKSHIA-XXXX"
                onChange={(e) => setNhiaNumber(e.target.value)}
              />
            </div>
          </div>

          {/* Section 6: Clinical Vitals / Emergency Contact */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Blood Group
              </label>
              <select
                className="os-form-select"
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
              >
                <option value="">Unknown</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Genotype
              </label>
              <select
                className="os-form-select"
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                value={genotype}
                onChange={(e) => setGenotype(e.target.value)}
              >
                <option value="">Unknown</option>
                <option value="AA">AA</option>
                <option value="AS">AS</option>
                <option value="SS">SS</option>
                <option value="AC">AC</option>
                <option value="SC">SC</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Emergency Contact (Name & Phone)
              </label>
              <input
                className="os-search-input"
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem' }}
                value={emergencyContact}
                placeholder="e.g. Mary Okon (0803-000-0000)"
                onChange={(e) => setEmergencyContact(e.target.value)}
              />
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              paddingTop: 12,
              borderTop: '1px solid #E2E8F0',
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="os-ghost-btn"
              style={{ padding: '8px 18px', fontSize: '0.82rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="os-primary-btn"
              style={{ padding: '8px 22px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Save size={15} />
              {busy ? 'Saving Demographics…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

