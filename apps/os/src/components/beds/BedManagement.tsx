'use client';

import React, { useEffect, useState } from 'react';
import {
  BedDouble, Search, CheckCircle2, Clock, AlertCircle, UserPlus, RefreshCw,
} from 'lucide-react';
import {
  listBeds,
  ensureDefaultBeds,
  admitToBed,
  dischargeBed,
  transferBedWard,
  setBedStatus,
  subscribeBeds,
  type BedRecord,
  type BedStatus,
} from '../../lib/bedBoardStore';
import { getActiveFacilityId } from '../../lib/adminRealtimeStore';
import { emitLiveAction } from '../../lib/liveActions';

const BED_STATUS_META: Record<BedStatus, { label: string; color: string }> = {
  occupied: { label: 'Occupied', color: '#EA580C' },
  available: { label: 'Available', color: '#22C55E' },
  maintenance: { label: 'Maintenance', color: '#F59E0B' },
  isolation: { label: 'Isolation', color: '#A855F7' },
};

export const BedManagement: React.FC = () => {
  const facilityId = (typeof window !== 'undefined' && getActiveFacilityId()) || 'IGH-EKT';
  const [bedsList, setBedsList] = useState<BedRecord[]>([]);
  const [filterWard, setFilterWard] = useState('All Wards');
  const [filterStatus, setFilterStatus] = useState<'all' | BedStatus>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<BedRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [admitPatientName, setAdmitPatientName] = useState('');
  const [admitDoctor, setAdmitDoctor] = useState('');
  const [admitDiagnosis, setAdmitDiagnosis] = useState('');

  const reload = () => {
    ensureDefaultBeds(facilityId);
    const beds = listBeds(facilityId);
    setBedsList(beds);
    if (selected) {
      setSelected(beds.find((b) => b.id === selected.id) || null);
    }
  };

  useEffect(() => {
    reload();
    return subscribeBeds(reload);
  }, [facilityId]);

  const showNotification = (msg: string) => {
    setNotice(msg);
    emitLiveAction(msg, { module: 'beds' });
    setTimeout(() => setNotice(null), 3500);
  };

  const wards = ['All Wards', ...Array.from(new Set(bedsList.map((b) => b.ward)))];

  const filtered = bedsList.filter((b) => {
    if (filterWard !== 'All Wards' && b.ward !== filterWard) return false;
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (
      search &&
      !b.bedNo.toLowerCase().includes(search.toLowerCase()) &&
      !b.patient?.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const counts = {
    occupied: bedsList.filter((b) => b.status === 'occupied').length,
    available: bedsList.filter((b) => b.status === 'available').length,
    maintenance: bedsList.filter((b) => b.status === 'maintenance').length,
    isolation: bedsList.filter((b) => b.status === 'isolation').length,
  };

  const handleDischarge = (bedId: string) => {
    dischargeBed(bedId);
    reload();
    showNotification(`Patient discharged · bed available`);
  };

  const handleTransfer = (bedId: string) => {
    const newWard = prompt('Target ward (e.g. ICU, Surgical, Female Medical):');
    if (!newWard) return;
    transferBedWard(bedId, newWard);
    reload();
    showNotification(`Transferred to ${newWard}`);
  };

  const handleAdmitToBed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !admitPatientName.trim()) return;
    admitToBed(selected.id, {
      patient: admitPatientName.trim(),
      doctor: admitDoctor.trim() || undefined,
      diagnosis: admitDiagnosis.trim() || undefined,
    });
    reload();
    setShowAdmitModal(false);
    setAdmitPatientName('');
    setAdmitDiagnosis('');
    showNotification(`${admitPatientName.trim()} admitted to ${selected.bedNo}`);
  };

  return (
    <div className="os-module-layout">
      {notice && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 99999,
            background: '#0F172A',
            color: '#fff',
            padding: '12px 18px',
            borderRadius: 12,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {notice}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Bed &amp; Ward Occupancy</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
            Live bed board — admit, discharge, transfer. Empty until you admit patients.
          </p>
        </div>
        <button type="button" className="os-ghost-btn mc-btn-live" onClick={reload}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {(
          [
            ['Occupied', counts.occupied, '#EA580C'],
            ['Available', counts.available, '#22C55E'],
            ['Maintenance', counts.maintenance, '#F59E0B'],
            ['Isolation', counts.isolation, '#A855F7'],
          ] as const
        ).map(([l, v, c]) => (
          <div
            key={l}
            style={{
              background: '#fff',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              padding: 14,
            }}
          >
            <div style={{ fontSize: 12, color: c, fontWeight: 700 }}>{l}</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className="os-search-wrap" style={{ flex: 1, minWidth: 200 }}>
          <Search size={14} />
          <input
            className="os-search-input"
            placeholder="Search bed or patient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterWard}
          onChange={(e) => setFilterWard(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #E2E8F0' }}
        >
          {wards.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #E2E8F0' }}
        >
          <option value="all">All statuses</option>
          {(Object.keys(BED_STATUS_META) as BedStatus[]).map((s) => (
            <option key={s} value={s}>
              {BED_STATUS_META[s].label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: 32, textAlign: 'center', color: '#64748B' }}>
              No beds match filters. Defaults load available beds for standard wards.
            </div>
          )}
          {filtered.map((b) => {
            const meta = BED_STATUS_META[b.status];
            return (
              <button
                key={b.id}
                type="button"
                className="mc-btn-live"
                onClick={() => setSelected(b)}
                style={{
                  textAlign: 'left',
                  padding: 14,
                  borderRadius: 14,
                  border: selected?.id === b.id ? `2px solid ${meta.color}` : '1px solid #E2E8F0',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <BedDouble size={16} color={meta.color} />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: meta.color,
                      background: `${meta.color}18`,
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div style={{ fontWeight: 800, marginTop: 8 }}>{b.bedNo}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{b.ward}</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, color: '#0F172A' }}>
                  {b.patient || '—'}
                </div>
              </button>
            );
          })}
        </div>

        {selected && (
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid #E2E8F0',
              padding: 18,
              height: 'fit-content',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 16 }}>{selected.bedNo}</div>
            <div style={{ fontSize: 13, color: '#64748B' }}>{selected.ward}</div>
            <div style={{ marginTop: 12, fontSize: 13 }}>
              <div>
                <strong>Status:</strong> {BED_STATUS_META[selected.status].label}
              </div>
              <div>
                <strong>Patient:</strong> {selected.patient || '—'}
              </div>
              <div>
                <strong>Doctor:</strong> {selected.doctor || '—'}
              </div>
              <div>
                <strong>Diagnosis:</strong> {selected.diagnosis || '—'}
              </div>
              <div>
                <strong>Admitted:</strong> {selected.admitDate || '—'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              {selected.status === 'available' && (
                <button
                  type="button"
                  className="os-action-btn-primary mc-btn-live"
                  onClick={() => setShowAdmitModal(true)}
                >
                  <UserPlus size={14} /> Admit patient
                </button>
              )}
              {selected.status === 'occupied' && (
                <>
                  <button
                    type="button"
                    className="mc-btn-live"
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: 'none',
                      background: '#ECFDF5',
                      color: '#047857',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    onClick={() => handleDischarge(selected.id)}
                  >
                    <CheckCircle2 size={14} /> Discharge
                  </button>
                  <button
                    type="button"
                    className="mc-btn-live"
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: '1px solid #E2E8F0',
                      background: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    onClick={() => handleTransfer(selected.id)}
                  >
                    Transfer ward
                  </button>
                </>
              )}
              <button
                type="button"
                className="mc-btn-live"
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  background: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  const next =
                    selected.status === 'maintenance'
                      ? 'available'
                      : selected.status === 'available'
                        ? 'maintenance'
                        : selected.status;
                  if (next !== selected.status) {
                    setBedStatus(selected.id, next as BedStatus);
                    reload();
                    showNotification(`Bed marked ${next}`);
                  }
                }}
              >
                <Clock size={14} /> Toggle maintenance
              </button>
            </div>
          </div>
        )}
      </div>

      {showAdmitModal && selected && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <form
            onSubmit={handleAdmitToBed}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 24,
              width: '100%',
              maxWidth: 420,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 16 }}>Admit to {selected.bedNo}</div>
            <label style={{ fontSize: 12, fontWeight: 600 }}>
              Patient name
              <input
                required
                value={admitPatientName}
                onChange={(e) => setAdmitPatientName(e.target.value)}
                placeholder="Full name"
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 4,
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                }}
              />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600 }}>
              Doctor
              <input
                value={admitDoctor}
                onChange={(e) => setAdmitDoctor(e.target.value)}
                placeholder="Attending doctor"
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 4,
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                }}
              />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600 }}>
              Diagnosis / note
              <input
                value={admitDiagnosis}
                onChange={(e) => setAdmitDiagnosis(e.target.value)}
                placeholder="Reason for admission"
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 4,
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                }}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="os-ghost-btn" onClick={() => setShowAdmitModal(false)}>
                Cancel
              </button>
              <button type="submit" className="os-action-btn-primary">
                Confirm admit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default BedManagement;
