'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BedDouble, Search, CheckCircle2, AlertCircle, UserPlus, RefreshCw,
  Printer, Download, Plus, ClipboardList,
} from 'lucide-react';
import {
  listBeds,
  ensureDefaultBeds,
  admitToBed,
  dischargeBed,
  transferPatient,
  setBedStatus,
  setExpectedDischarge,
  createBeds,
  deleteBed,
  updateBedMeta,
  subscribeBeds,
  bedOccupancyAlerts,
  listBedAudit,
  losDays,
  exportCensusCsv,
  dailyCensus,
  availableBeds,
  type BedRecord,
  type BedStatus,
} from '../../lib/bedBoardStore';
import { getActiveFacilityId } from '../../lib/adminRealtimeStore';
import { emitLiveAction } from '../../lib/liveActions';
import { listPatients } from '../../lib/patientRegistryStore';

const BED_STATUS_META: Record<BedStatus, { label: string; color: string }> = {
  occupied: { label: 'Occupied', color: '#EA580C' },
  available: { label: 'Available', color: '#22C55E' },
  maintenance: { label: 'Maintenance', color: '#F59E0B' },
  isolation: { label: 'Isolation', color: '#A855F7' },
  reserved: { label: 'Reserved', color: '#3B82F6' },
  cleaning: { label: 'Cleaning', color: '#64748B' },
};

export const BedManagement: React.FC<{ session?: { name?: string; hospitalId?: string } }> = ({
  session,
}) => {
  const facilityId =
    session?.hospitalId ||
    (typeof window !== 'undefined' && getActiveFacilityId()) ||
    'IGH-EKT';
  const actor = session?.name || 'Bed manager';

  const [bedsList, setBedsList] = useState<BedRecord[]>([]);
  const [filterWard, setFilterWard] = useState('All Wards');
  const [filterStatus, setFilterStatus] = useState<'all' | BedStatus>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<BedRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [admitPatientName, setAdmitPatientName] = useState('');
  const [admitPatientId, setAdmitPatientId] = useState('');
  const [admitDoctor, setAdmitDoctor] = useState('');
  const [admitDiagnosis, setAdmitDiagnosis] = useState('');
  const [admitEdd, setAdmitEdd] = useState('');
  const [admitIsolation, setAdmitIsolation] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [newWard, setNewWard] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  const [newCount, setNewCount] = useState('4');

  const reload = () => {
    ensureDefaultBeds(facilityId);
    const beds = listBeds(facilityId);
    setBedsList(beds);
    if (selected) setSelected(beds.find((b) => b.id === selected.id) || null);
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

  const wards = useMemo(
    () => ['All Wards', ...Array.from(new Set(bedsList.map((b) => b.ward))).sort()],
    [bedsList]
  );

  const alerts = useMemo(() => bedOccupancyAlerts(facilityId), [bedsList, facilityId]);
  const audit = useMemo(() => listBedAudit(facilityId).slice(0, 40), [bedsList, facilityId, showAudit]);
  const census = useMemo(() => dailyCensus(facilityId), [bedsList, facilityId]);
  const patients = useMemo(() => listPatients(facilityId), [facilityId, showAdmitModal]);

  const filtered = bedsList.filter((b) => {
    if (filterWard !== 'All Wards' && b.ward !== filterWard) return false;
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (
      search &&
      !b.bedNo.toLowerCase().includes(search.toLowerCase()) &&
      !b.patient?.toLowerCase().includes(search.toLowerCase()) &&
      !b.ward.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const handleAdmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !admitPatientName.trim()) return;
    admitToBed(selected.id, {
      patient: admitPatientName.trim(),
      patientId: admitPatientId || undefined,
      doctor: admitDoctor.trim() || undefined,
      diagnosis: admitDiagnosis.trim() || undefined,
      expectedDischarge: admitEdd || undefined,
      isolation: admitIsolation,
      actor,
    });
    reload();
    setShowAdmitModal(false);
    setAdmitPatientName('');
    setAdmitDiagnosis('');
    setAdmitEdd('');
    setAdmitIsolation(false);
    showNotification(`${admitPatientName.trim()} admitted to ${selected.bedNo}`);
  };

  const printCensus = () => {
    const html = `<!DOCTYPE html><html><head><title>Daily census ${census.date}</title>
      <style>body{font-family:system-ui;padding:24px}table{border-collapse:collapse;width:100%;font-size:12px}
      th,td{border:1px solid #ccc;padding:6px;text-align:left}h1{font-size:18px}</style></head><body>
      <h1>Night report · Daily census · ${census.date}</h1>
      <p>Total ${census.total} · Occupied ${census.occupied} · Isolation ${census.isolation} · Available ${census.available} · Cleaning ${census.cleaning}</p>
      <table><thead><tr><th>Ward</th><th>Bed</th><th>Status</th><th>Patient</th><th>Doctor</th><th>Admitted</th><th>EDD</th><th>LOS</th></tr></thead>
      <tbody>${census.rows
        .map(
          (r) =>
            `<tr><td>${r.ward}</td><td>${r.bedNo}</td><td>${r.status}</td><td>${r.patient}</td><td>${r.doctor}</td><td>${r.admitDate}</td><td>${r.expectedDischarge}</td><td>${r.losDays ?? ''}</td></tr>`
        )
        .join('')}</tbody></table>
      <p style="margin-top:24px;font-size:11px;color:#666">MedCore Bed Board · shared bed IDs for Nursing / Theatre / Maternity</p>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const downloadCsv = () => {
    const csv = exportCensusCsv(facilityId);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `census-${census.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="os-module-layout" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {notice && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 99999,
            background: '#0F172A',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 12,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {notice}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BedDouble size={22} /> Bed & Ward Occupancy
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
            Authoritative bed IDs · Nursing e-MAR, Theatre PACU & Maternity use this same board
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="mc-btn-live" onClick={() => setShowCreate(true)} style={btn}>
            <Plus size={14} /> Add beds / ward
          </button>
          <button type="button" className="mc-btn-live" onClick={printCensus} style={btn}>
            <Printer size={14} /> Print census
          </button>
          <button type="button" className="mc-btn-live" onClick={downloadCsv} style={btn}>
            <Download size={14} /> Export CSV
          </button>
          <button type="button" className="mc-btn-live" onClick={() => setShowAudit((v) => !v)} style={btn}>
            <ClipboardList size={14} /> Audit
          </button>
          <button type="button" className="mc-btn-live" onClick={reload} style={btn}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10 }}>
        {[
          { l: 'Total', v: census.total, c: '#0F172A' },
          { l: 'Occupied', v: census.occupied, c: '#EA580C' },
          { l: 'Isolation', v: census.isolation, c: '#A855F7' },
          { l: 'Available', v: census.available, c: '#22C55E' },
          { l: 'Cleaning', v: census.cleaning, c: '#64748B' },
        ].map((k) => (
          <div key={k.l} style={card}>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{k.l}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alerts.map((a) => (
            <div
              key={a.id}
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                background: a.level === 'critical' ? '#FEF2F2' : '#FFFBEB',
                border: `1px solid ${a.level === 'critical' ? '#FECACA' : '#FDE68A'}`,
                color: a.level === 'critical' ? '#B91C1C' : '#92400E',
              }}
            >
              <AlertCircle size={14} style={{ display: 'inline', marginRight: 6 }} />
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94A3B8' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bed, patient, ward…"
            style={{ ...input, paddingLeft: 32 }}
          />
        </div>
        <select value={filterWard} onChange={(e) => setFilterWard(e.target.value)} style={input}>
          {wards.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | BedStatus)}
          style={input}
        >
          <option value="all">All statuses</option>
          {Object.keys(BED_STATUS_META).map((s) => (
            <option key={s} value={s}>
              {BED_STATUS_META[s as BedStatus].label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {filtered.map((b) => {
            const meta = BED_STATUS_META[b.status];
            const los = losDays(b);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelected(b)}
                style={{
                  textAlign: 'left',
                  border: selected?.id === b.id ? `2px solid ${meta.color}` : '1px solid #E2E8F0',
                  borderRadius: 14,
                  padding: 12,
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14 }}>{b.bedNo}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{b.ward}</div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 10,
                    fontWeight: 800,
                    color: meta.color,
                    textTransform: 'uppercase',
                  }}
                >
                  {meta.label}
                </div>
                {b.patient && (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600 }}>{b.patient}</div>
                )}
                {b.expectedDischarge && (
                  <div style={{ fontSize: 10, color: '#0369A1', marginTop: 4 }}>EDD {b.expectedDischarge}</div>
                )}
                {los != null && los > 0 && (
                  <div style={{ fontSize: 10, color: los >= 14 ? '#B91C1C' : '#64748B' }}>LOS {los}d</div>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ ...card, position: 'sticky', top: 12, alignSelf: 'start' }}>
          {!selected && (
            <div style={{ color: '#64748B', fontSize: 13 }}>Select a bed for admit / transfer / discharge</div>
          )}
          {selected && (
            <>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{selected.bedNo}</div>
              <div style={{ fontSize: 13, color: '#64748B' }}>{selected.ward}</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>
                Status:{' '}
                <strong style={{ color: BED_STATUS_META[selected.status].color }}>
                  {BED_STATUS_META[selected.status].label}
                </strong>
              </div>
              {selected.patient && (
                <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}>
                  <div>
                    <strong>Patient:</strong> {selected.patient}
                  </div>
                  <div>
                    <strong>Doctor:</strong> {selected.doctor || '—'}
                  </div>
                  <div>
                    <strong>Dx:</strong> {selected.diagnosis || '—'}
                  </div>
                  <div>
                    <strong>Admitted:</strong> {selected.admitDate || '—'}
                  </div>
                  <div>
                    <strong>LOS:</strong> {losDays(selected) ?? '—'} days
                  </div>
                  <div>
                    <strong>Expected discharge:</strong> {selected.expectedDischarge || '—'}
                  </div>
                </div>
              )}

              {(selected.status === 'occupied' || selected.status === 'isolation') && (
                <label style={{ display: 'block', marginTop: 12, fontSize: 12, fontWeight: 600 }}>
                  Set expected discharge
                  <input
                    type="date"
                    defaultValue={selected.expectedDischarge || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setExpectedDischarge(selected.id, e.target.value, actor);
                        reload();
                        showNotification(`EDD set for ${selected.bedNo}`);
                      }
                    }}
                    style={{ ...input, marginTop: 4 }}
                  />
                </label>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                {(selected.status === 'available' || selected.status === 'cleaning') && (
                  <button
                    type="button"
                    style={btnPrimary}
                    onClick={() => setShowAdmitModal(true)}
                  >
                    <UserPlus size={14} /> Admit patient
                  </button>
                )}
                {(selected.status === 'occupied' || selected.status === 'isolation') && (
                  <>
                    <select
                      value={transferTo}
                      onChange={(e) => setTransferTo(e.target.value)}
                      style={input}
                    >
                      <option value="">Transfer to bed…</option>
                      {availableBeds(facilityId)
                        .filter((b) => b.id !== selected.id)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.bedNo} · {b.ward}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      style={btn}
                      disabled={!transferTo}
                      onClick={() => {
                        const r = transferPatient(selected.id, transferTo, actor);
                        showNotification(r.message);
                        setTransferTo('');
                        reload();
                      }}
                    >
                      Transfer patient
                    </button>
                    <button
                      type="button"
                      style={{ ...btnPrimary, background: '#0F172A' }}
                      onClick={() => {
                        dischargeBed(selected.id, actor);
                        reload();
                        showNotification('Discharged · bed cleaning');
                      }}
                    >
                      Discharge
                    </button>
                  </>
                )}
                {selected.status === 'cleaning' && (
                  <button
                    type="button"
                    style={btnPrimary}
                    onClick={() => {
                      setBedStatus(selected.id, 'available', actor);
                      reload();
                      showNotification('Bed available');
                    }}
                  >
                    <CheckCircle2 size={14} /> Mark available
                  </button>
                )}
                <select
                  value={selected.status}
                  onChange={(e) => {
                    setBedStatus(selected.id, e.target.value as BedStatus, actor);
                    reload();
                  }}
                  style={input}
                >
                  {Object.entries(BED_STATUS_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      Status: {v.label}
                    </option>
                  ))}
                </select>
                {selected.status !== 'occupied' && selected.status !== 'isolation' && (
                  <button
                    type="button"
                    style={{ ...btn, color: '#B91C1C' }}
                    onClick={() => {
                      if (deleteBed(selected.id, actor)) {
                        setSelected(null);
                        reload();
                        showNotification('Bed deleted');
                      } else showNotification('Cannot delete occupied bed');
                    }}
                  >
                    Delete bed
                  </button>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 12 }}>ID: {selected.id}</div>
            </>
          )}
        </div>
      </div>

      {showAudit && (
        <div style={card}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Audit trail</div>
          {audit.length === 0 && <div style={{ fontSize: 13, color: '#64748B' }}>No movements yet</div>}
          {audit.map((a) => (
            <div key={a.id} style={{ fontSize: 12, padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
              <strong>{a.action}</strong> · {a.bedNo} · {a.detail}
              <div style={{ color: '#94A3B8' }}>
                {a.actor} · {a.at.slice(0, 19).replace('T', ' ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create beds modal */}
      {showCreate && (
        <div style={modalBg}>
          <form
            style={modalBox}
            onSubmit={(e) => {
              e.preventDefault();
              if (!newWard.trim() || !newPrefix.trim()) return;
              const created = createBeds({
                facilityId,
                ward: newWard.trim(),
                prefix: newPrefix.trim().toUpperCase(),
                count: Math.min(40, Math.max(1, Number(newCount) || 1)),
                actor,
              });
              setShowCreate(false);
              setNewWard('');
              setNewPrefix('');
              reload();
              showNotification(`Created ${created.length} bed(s)`);
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Add ward / beds</div>
            <label style={label}>
              Ward name
              <input value={newWard} onChange={(e) => setNewWard(e.target.value)} style={input} required placeholder="e.g. Male Surgical" />
            </label>
            <label style={label}>
              Bed prefix
              <input value={newPrefix} onChange={(e) => setNewPrefix(e.target.value)} style={input} required placeholder="e.g. MS" />
            </label>
            <label style={label}>
              Number of beds
              <input type="number" min={1} max={40} value={newCount} onChange={(e) => setNewCount(e.target.value)} style={input} />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="submit" style={btnPrimary}>
                Create
              </button>
              <button type="button" style={btn} onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admit modal */}
      {showAdmitModal && selected && (
        <div style={modalBg}>
          <form style={modalBox} onSubmit={handleAdmit}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Admit to {selected.bedNo}</div>
            <label style={label}>
              Patient from registry (optional)
              <select
                value={admitPatientId}
                onChange={(e) => {
                  const p = patients.find((x) => x.id === e.target.value);
                  setAdmitPatientId(e.target.value);
                  if (p) setAdmitPatientName(`${p.firstName} ${p.lastName}`);
                }}
                style={input}
              >
                <option value="">Manual name…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} · {p.hospitalNumber}
                  </option>
                ))}
              </select>
            </label>
            <label style={label}>
              Patient name
              <input value={admitPatientName} onChange={(e) => setAdmitPatientName(e.target.value)} style={input} required />
            </label>
            <label style={label}>
              Doctor
              <input value={admitDoctor} onChange={(e) => setAdmitDoctor(e.target.value)} style={input} />
            </label>
            <label style={label}>
              Diagnosis
              <input value={admitDiagnosis} onChange={(e) => setAdmitDiagnosis(e.target.value)} style={input} />
            </label>
            <label style={label}>
              Expected discharge
              <input type="date" value={admitEdd} onChange={(e) => setAdmitEdd(e.target.value)} style={input} />
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={admitIsolation} onChange={(e) => setAdmitIsolation(e.target.checked)} />
              Isolation bed
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="submit" style={btnPrimary}>
                Confirm admit
              </button>
              <button type="button" style={btn} onClick={() => setShowAdmitModal(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 14,
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 10,
  border: '1px solid #E2E8F0',
  fontSize: 13,
  boxSizing: 'border-box',
};
const btn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #E2E8F0',
  background: '#fff',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};
const btnPrimary: React.CSSProperties = {
  ...btn,
  border: 'none',
  background: 'linear-gradient(135deg,#2563EB,#0D9488)',
  color: '#fff',
};
const modalBg: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.45)',
  zIndex: 100000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};
const modalBox: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  padding: 20,
  width: '100%',
  maxWidth: 420,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};
const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 4 };

export default BedManagement;
