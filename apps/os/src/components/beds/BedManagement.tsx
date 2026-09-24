'use client';
import React, { useState, useEffect } from 'react';
import { BedDouble, Filter, Search, CheckCircle2, XCircle, Clock, AlertCircle, UserPlus, ArrowRight, Check } from 'lucide-react';

type BedStatus = 'occupied' | 'available' | 'maintenance' | 'isolation';

interface Bed {
  id: string;
  ward: string;
  bedNo: string;
  status: BedStatus;
  patient?: string;
  admitDate?: string;
  doctor?: string;
  diagnosis?: string;
}

const generateBeds = (): Bed[] => {
  const wards = [
    { name: 'Male Medical', prefix: 'MMW', count: 12 },
    { name: 'Female Medical', prefix: 'FMW', count: 12 },
    { name: 'Surgical', prefix: 'SRG', count: 10 },
    { name: 'Paediatric', prefix: 'PED', count: 10 },
    { name: 'O&G', prefix: 'OBG', count: 10 },
    { name: 'ICU', prefix: 'ICU', count: 8 },
  ];

  const patients = [
    ['Emeka Nwosu', 'Dr. Okafor', 'Typhoid Fever', '12 Sep'],
    ['Nneka Obi', 'Dr. Bassey', 'Hypertension + DM2', '13 Sep'],
    ['Akpan Sunday', 'Dr. Ekpo', 'Peptic Ulcer Disease', '14 Sep'],
    ['Grace Udoh', 'Dr. Nwachukwu', 'Pre-Eclampsia', '15 Sep'],
    ['James Effiong', 'Dr. Okafor', 'Malaria + Anaemia', '10 Sep'],
    ['Blessing Ime', 'Dr. Bassey', 'Sickle Cell Crisis', '11 Sep'],
  ];

  const statuses: BedStatus[] = ['occupied', 'occupied', 'occupied', 'available', 'occupied', 'maintenance', 'occupied', 'occupied', 'available', 'isolation'];
  const beds: Bed[] = [];

  wards.forEach(ward => {
    for (let i = 1; i <= ward.count; i++) {
      const statusIdx = (i - 1) % statuses.length;
      const status = statuses[statusIdx];
      const patIdx = (i - 1) % patients.length;
      beds.push({
        id: `${ward.prefix}-${String(i).padStart(2, '0')}`,
        ward: ward.name,
        bedNo: `${ward.prefix}-${String(i).padStart(2, '0')}`,
        status,
        patient: status === 'occupied' ? patients[patIdx][0] : undefined,
        doctor: status === 'occupied' ? patients[patIdx][1] : undefined,
        diagnosis: status === 'occupied' ? patients[patIdx][2] : undefined,
        admitDate: status === 'occupied' ? patients[patIdx][3] : undefined,
      });
    }
  });
  return beds;
};

const BED_STATUS_META: Record<BedStatus, { label: string; color: string; icon: React.ReactNode }> = {
  occupied: { label: 'Occupied', color: '#EA580C', icon: <BedDouble size={14} /> },
  available: { label: 'Available', color: '#22C55E', icon: <CheckCircle2 size={14} /> },
  maintenance: { label: 'Maintenance', color: '#F59E0B', icon: <Clock size={14} /> },
  isolation: { label: 'Isolation', color: '#A855F7', icon: <AlertCircle size={14} /> },
};

export const BedManagement: React.FC = () => {
  const [bedsList, setBedsList] = useState<Bed[]>(() => generateBeds());
  const [filterWard, setFilterWard] = useState('All Wards');
  const [filterStatus, setFilterStatus] = useState<'all' | BedStatus>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Bed | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Quick Admit Modal state
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [admitPatientName, setAdmitPatientName] = useState('');
  const [admitDoctor, setAdmitDoctor] = useState('Dr. Adewale Bello');
  const [admitDiagnosis, setAdmitDiagnosis] = useState('');

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const wards = ['All Wards', ...Array.from(new Set(bedsList.map(b => b.ward)))];

  const filtered = bedsList.filter(b => {
    if (filterWard !== 'All Wards' && b.ward !== filterWard) return false;
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (search && !b.bedNo.toLowerCase().includes(search.toLowerCase()) && !b.patient?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    occupied: bedsList.filter(b => b.status === 'occupied').length,
    available: bedsList.filter(b => b.status === 'available').length,
    maintenance: bedsList.filter(b => b.status === 'maintenance').length,
    isolation: bedsList.filter(b => b.status === 'isolation').length,
  };

  const handleDischarge = (bedId: string) => {
    const updated = bedsList.map(b => {
      if (b.id === bedId) {
        return {
          ...b,
          status: 'available' as BedStatus,
          patient: undefined,
          doctor: undefined,
          diagnosis: undefined,
          admitDate: undefined,
        };
      }
      return b;
    });
    setBedsList(updated);
    const updatedBed = updated.find(b => b.id === bedId) || null;
    setSelected(updatedBed);
    showNotification(`Patient discharged from Bed ${bedId}. Marked AVAILABLE.`);
  };

  const handleTransfer = (bedId: string) => {
    const newWard = prompt('Enter target Ward to transfer patient (e.g. ICU, Surgical, Female Medical):');
    if (!newWard) return;
    const updated = bedsList.map(b => {
      if (b.id === bedId) {
        return { ...b, ward: newWard.trim() };
      }
      return b;
    });
    setBedsList(updated);
    const updatedBed = updated.find(b => b.id === bedId) || null;
    setSelected(updatedBed);
    showNotification(`Patient transferred to ${newWard}. Bed ${bedId} updated.`);
  };

  const handleAdmitToBed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !admitPatientName.trim()) return;

    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const updated = bedsList.map(b => {
      if (b.id === selected.id) {
        return {
          ...b,
          status: 'occupied' as BedStatus,
          patient: admitPatientName.trim(),
          doctor: admitDoctor,
          diagnosis: admitDiagnosis.trim() || 'Admitted for Clinical Care',
          admitDate: today,
        };
      }
      return b;
    });
    setBedsList(updated);
    const updatedBed = updated.find(b => b.id === selected.id) || null;
    setSelected(updatedBed);
    setShowAdmitModal(false);
    setAdmitPatientName('');
    setAdmitDiagnosis('');
    showNotification(`${admitPatientName.trim()} admitted to Bed ${selected.bedNo}!`);
  };

  return (
    <div className="os-module-layout">
      {notice && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 99999,
          background: '#0F172A',
          border: '1px solid #16A34A',
          borderRadius: 12,
          padding: '14px 20px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#F1F5F9',
          fontSize: '0.88rem',
          fontWeight: 600,
        }}>
          <CheckCircle2 size={18} color="#4ADE80" />
          <span>{notice}</span>
        </div>
      )}

      <div className="os-metrics-ribbon">
        {(Object.keys(BED_STATUS_META) as BedStatus[]).map(st => (
          <div
            key={st}
            className="metric-box"
            style={{ cursor: 'pointer', borderColor: filterStatus === st ? BED_STATUS_META[st].color : undefined }}
            onClick={() => setFilterStatus(filterStatus === st ? 'all' : st)}
          >
            <span className="metric-label">{BED_STATUS_META[st].label} Beds</span>
            <span className="metric-val" style={{ color: BED_STATUS_META[st].color }}>{counts[st]}</span>
            <span className="metric-sub">{Math.round((counts[st] / bedsList.length) * 100)}% of {bedsList.length} total</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: 18 }}>
        <div>
          <div className="os-toolbar">
            <div className="os-search-wrap" style={{ flex: 1, minWidth: 220 }}>
              <Search size={14} />
              <input className="os-search-input" placeholder="Search bed or patient..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="os-form-select" value={filterWard} onChange={e => setFilterWard(e.target.value)}>
              {wards.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>

          <div className="os-bed-grid">
            {filtered.map(bed => {
              const meta = BED_STATUS_META[bed.status];
              const isSelected = selected?.id === bed.id;
              return (
                <div
                  key={bed.id}
                  className="os-card os-bed-tile"
                  onClick={() => setSelected(isSelected ? null : bed)}
                  style={{
                    borderColor: isSelected ? meta.color : `${meta.color}40`,
                    background: isSelected ? `${meta.color}14` : undefined,
                    boxShadow: isSelected ? `0 0 0 1px ${meta.color}50` : undefined,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', letterSpacing: '0.04em' }}>{bed.bedNo}</span>
                    <span style={{ color: meta.color }}>{meta.icon}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: meta.color, fontWeight: 700 }}>{meta.label}</div>
                  {bed.patient && (
                    <div style={{ fontSize: '0.72rem', color: '#334155', fontWeight: 600, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {bed.patient}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="os-card" style={{ padding: 20, alignSelf: 'flex-start', borderColor: BED_STATUS_META[selected.status].color }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0A2540' }}>Bed {selected.bedNo}</h3>
              <button className="os-ghost-btn" style={{ padding: 4 }} onClick={() => setSelected(null)}><XCircle size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748B', marginBottom: 4, fontWeight: 700 }}>CURRENT STATUS</div>
                <span style={{ background: `${BED_STATUS_META[selected.status].color}20`, color: BED_STATUS_META[selected.status].color, fontSize: '0.78rem', fontWeight: 800, padding: '4px 10px', borderRadius: 9999 }}>
                  {BED_STATUS_META[selected.status].label}
                </span>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748B', marginBottom: 2, fontWeight: 700 }}>WARD</div>
                <div style={{ fontSize: '0.88rem', color: '#0A2540', fontWeight: 700 }}>{selected.ward}</div>
              </div>
              {selected.patient ? (
                <>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginBottom: 2, fontWeight: 700 }}>CURRENT INPATIENT</div>
                    <div style={{ fontSize: '0.92rem', color: '#0A2540', fontWeight: 800 }}>{selected.patient}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginBottom: 2, fontWeight: 700 }}>CLINICAL DIAGNOSIS</div>
                    <div style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>{selected.diagnosis}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginBottom: 2, fontWeight: 700 }}>ATTENDING DOCTOR</div>
                    <div style={{ fontSize: '0.85rem', color: '#0D4F8B', fontWeight: 700 }}>{selected.doctor}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginBottom: 2, fontWeight: 700 }}>ADMITTED ON</div>
                    <div style={{ fontSize: '0.85rem', color: '#334155' }}>{selected.admitDate}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="os-action-btn-primary"
                      style={{ flex: 1, fontSize: '0.78rem' }}
                      onClick={() => handleTransfer(selected.id)}
                    >
                      Transfer
                    </button>
                    <button
                      type="button"
                      className="os-ghost-btn"
                      style={{ flex: 1, fontSize: '0.78rem', color: '#DC2626', borderColor: '#FCA5A5' }}
                      onClick={() => handleDischarge(selected.id)}
                    >
                      Discharge
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: 12 }}>
                    This bed is currently unassigned and ready for patient admission.
                  </div>
                  <button
                    type="button"
                    className="os-action-btn-primary"
                    style={{ width: '100%', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onClick={() => setShowAdmitModal(true)}
                  >
                    <UserPlus size={14} /> Admit Patient to Bed
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Admit Patient Modal */}
      {showAdmitModal && selected && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,25,41,0.7)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#FFF', borderRadius: 14, width: '100%', maxWidth: 440, padding: 24,
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0A2540' }}>
              Admit Patient to Bed {selected.bedNo} ({selected.ward})
            </h3>
            <form onSubmit={handleAdmitToBed} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Archibong"
                  value={admitPatientName}
                  onChange={e => setAdmitPatientName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Admitting Doctor *
                </label>
                <select
                  value={admitDoctor}
                  onChange={e => setAdmitDoctor(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', background: '#FFF' }}
                >
                  <option>Dr. Adewale Bello</option>
                  <option>Dr. Bassey</option>
                  <option>Dr. Okafor</option>
                  <option>Dr. Ekpo</option>
                  <option>Dr. Nwachukwu</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Diagnosis / Reason for Admission
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acute Appendicitis, Severe Malaria..."
                  value={admitDiagnosis}
                  onChange={e => setAdmitDiagnosis(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.86rem', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="os-ghost-btn" onClick={() => setShowAdmitModal(false)}>Cancel</button>
                <button type="submit" className="os-action-btn-primary">Confirm Admission</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
