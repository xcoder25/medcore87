'use client';

/**
 * Closed clinical loop UI — place orders, post results, live list.
 */
import React, { useEffect, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  listOrders,
  placeOrder,
  postLabResult,
  updateOrderStatus,
  subscribeOrders,
  type ClinicalOrder,
  type ClinicalOrderType,
} from '../../lib/clinicalEventBus';
import { ORDER_SETS, previewOrderBpa, type BpaAlert } from '../../lib/clinicalIntelligenceEngine';
import { listPatients, type FacilityPatient } from '../../lib/patientRegistryStore';
import { appendAudit } from '../../lib/auditLogStore';
import { FlaskConical, Pill, Activity, CheckCircle2 } from 'lucide-react';
import { PatientChartBanner } from './PatientChartBanner';
import { setPatientContext } from '../../lib/patientContextStore';

interface Props {
  session: UserSession;
}

export const ClinicalOrdersPanel: React.FC<Props> = ({ session }) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const [orders, setOrders] = useState<ClinicalOrder[]>([]);
  const [patients, setPatients] = useState<FacilityPatient[]>([]);
  const [patientId, setPatientId] = useState('');
  const [type, setType] = useState<ClinicalOrderType>('lab');
  const [name, setName] = useState('FBC');
  const [code, setCode] = useState('LAB-FBC');
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [resultText, setResultText] = useState('');
  const [toast, setToast] = useState('');
  const [bpaAlerts, setBpaAlerts] = useState<BpaAlert[]>([]);
  const [orderSetId, setOrderSetId] = useState('');
  const [overrideBpa, setOverrideBpa] = useState(false);

  const reload = () => {
    setOrders(listOrders(facilityId));
    setPatients(listPatients(facilityId));
  };

  useEffect(() => {
    reload();
    return subscribeOrders(reload);
  }, [facilityId]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 3000);
  };

  const runBpaPreview = (pid: string, t = type, c = code, n = name, pr = priority) => {
    if (!pid) {
      setBpaAlerts([]);
      return;
    }
    setBpaAlerts(
      previewOrderBpa({
        facilityId,
        patientId: pid,
        type: t,
        code: c,
        name: n,
        priority: pr,
      })
    );
    setOverrideBpa(false);
  };

  const submitOrder = () => {
    const p = patients.find((x) => x.id === patientId);
    if (!p) {
      flash('Select a patient');
      return;
    }
    const alerts = previewOrderBpa({
      facilityId,
      patientId: p.id,
      type,
      code,
      name,
      priority,
    });
    setBpaAlerts(alerts);
    const hard = alerts.filter((a) => a.level === 'hard_stop');
    if (hard.length && !overrideBpa) {
      flash('Best-practice alert: review hard stops or tick override');
      return;
    }
    const o = placeOrder({
      facilityId,
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`,
      hospitalNumber: p.hospitalNumber,
      type,
      code,
      name,
      orderedBy: session.name,
      orderedByBadge: session.badgeId,
      priority,
    });
    appendAudit({
      facilityId,
      actor: session.name,
      actorBadge: session.badgeId,
      action: 'clinical_order_placed',
      entity: 'order',
      entityId: o.id,
      detail: `${type} ${name}${hard.length ? ' · BPA override' : ''}`,
    });
    reload();
    setBpaAlerts([]);
    setOverrideBpa(false);
    flash(`Order ${o.id} placed`);
  };

  const applyOrderSet = () => {
    const set = ORDER_SETS.find((s) => s.id === orderSetId);
    const p = patients.find((x) => x.id === patientId);
    if (!set || !p) {
      flash('Select patient and an order set');
      return;
    }
    let n = 0;
    for (const item of set.items) {
      placeOrder({
        facilityId,
        patientId: p.id,
        patientName: `${p.firstName} ${p.lastName}`,
        hospitalNumber: p.hospitalNumber,
        type: item.type,
        code: item.code,
        name: item.name,
        orderedBy: session.name,
        orderedByBadge: session.badgeId,
        priority: item.priority || 'routine',
      });
      n += 1;
    }
    appendAudit({
      facilityId,
      actor: session.name,
      actorBadge: session.badgeId,
      action: 'order_set_applied',
      entity: 'order_set',
      entityId: set.id,
      detail: `${set.label} · ${n} orders`,
    });
    reload();
    flash(`Order set “${set.label}” — ${n} orders on bus`);
  };

  const input: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #E2E8F0',
    fontSize: 14,
    boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#0F172A',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 12,
            zIndex: 50,
            fontWeight: 600,
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={18} color="#0052D4" /> Place order
        </div>
        {patients.find((x) => x.id === patientId) && (
          <div style={{ marginBottom: 12 }}>
            <PatientChartBanner patient={patients.find((x) => x.id === patientId)!} compact />
          </div>
        )}
        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Patient</label>
        <select style={{ ...input, marginBottom: 10 }} value={patientId} onChange={(e) => { const id = e.target.value; setPatientId(id); runBpaPreview(id); const p = patients.find(x => x.id === id); if (p) setPatientContext(p); }}>
          <option value="">Select…</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName} · {p.hospitalNumber}
            </option>
          ))}
        </select>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Type</label>
        <select
          style={{ ...input, marginBottom: 10 }}
          value={type}
          onChange={(e) => {
            const t = e.target.value as ClinicalOrderType;
            setType(t);
            if (t === 'lab') {
              setName('FBC');
              setCode('LAB-FBC');
            } else if (t === 'rx') {
              setName('Paracetamol 500mg');
              setCode('RX-PCM');
            } else if (t === 'imaging') {
              setName('Chest X-Ray');
              setCode('IMG-CXR');
            }
          }}
        >
          <option value="lab">Laboratory</option>
          <option value="rx">Prescription</option>
          <option value="imaging">Imaging</option>
          <option value="procedure">Procedure</option>
        </select>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Name</label>
        <input style={{ ...input, marginBottom: 10 }} value={name} onChange={(e) => setName(e.target.value)} />
        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Code</label>
        <input style={{ ...input, marginBottom: 10 }} value={code} onChange={(e) => setCode(e.target.value)} />
        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Priority</label>
        <select
          style={{ ...input, marginBottom: 12 }}
          value={priority}
          onChange={(e) => setPriority(e.target.value as typeof priority)}
        >
          <option value="routine">Routine</option>
          <option value="urgent">Urgent</option>
          <option value="stat">STAT</option>
        </select>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Order set (Cerner/Epic style)</label>
        <select
          style={{ ...input, marginBottom: 8 }}
          value={orderSetId}
          onChange={(e) => setOrderSetId(e.target.value)}
        >
          <option value="">Single order…</option>
          {ORDER_SETS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} · {s.specialty}
            </option>
          ))}
        </select>
        {orderSetId && (
          <button
            type="button"
            onClick={applyOrderSet}
            style={{
              width: '100%',
              marginBottom: 12,
              padding: 10,
              borderRadius: 10,
              border: '1px solid #A5B4FC',
              background: '#EEF2FF',
              color: '#3730A3',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Fire order set to bus
          </button>
        )}
        {bpaAlerts.length > 0 && (
          <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bpaAlerts.map((a) => (
              <div
                key={a.id}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  fontSize: 12,
                  border: `1px solid ${a.level === 'hard_stop' ? '#FECACA' : a.level === 'warning' ? '#FDE68A' : '#E2E8F0'}`,
                  background: a.level === 'hard_stop' ? '#FEF2F2' : a.level === 'warning' ? '#FFFBEB' : '#F8FAFC',
                }}
              >
                <div style={{ fontWeight: 800, color: a.level === 'hard_stop' ? '#B91C1C' : '#92400E' }}>
                  {a.level === 'hard_stop' ? 'Hard stop' : a.level === 'warning' ? 'Warning' : 'Info'} · {a.title}
                </div>
                <div style={{ color: '#475569', marginTop: 2 }}>{a.detail}</div>
              </div>
            ))}
            {bpaAlerts.some((a) => a.level === 'hard_stop') && (
              <label style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={overrideBpa} onChange={(e) => setOverrideBpa(e.target.checked)} />
                Clinician override (document reason in notes)
              </label>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            runBpaPreview(patientId);
            submitOrder();
          }}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 10,
            border: 'none',
            background: '#0052D4',
            color: '#fff',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Submit order to bus
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>Live orders · results bus</div>
        {orders.length === 0 && (
          <div style={{ color: '#64748B', padding: 16 }}>No orders yet — place one for a registered patient</div>
        )}
        {orders.map((o) => (
          <div
            key={o.id}
            style={{
              borderBottom: '1px solid #E2E8F0',
              padding: '12px 0',
              display: 'grid',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {o.type === 'lab' ? <FlaskConical size={14} /> : o.type === 'rx' ? <Pill size={14} /> : <Activity size={14} />}
                  {o.name}
                </div>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  {o.patientName} · {o.hospitalNumber} · {o.id} · {o.priority}
                </div>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  By {o.orderedBy} · {o.status}
                  {o.resultSummary ? ` · Result: ${o.resultSummary}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {o.status === 'ordered' && (
                  <button
                    type="button"
                    onClick={() => {
                      updateOrderStatus(o.id, 'in_progress');
                      reload();
                    }}
                    style={{ fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer' }}
                  >
                    Accept
                  </button>
                )}
                {(o.status === 'ordered' || o.status === 'in_progress' || o.status === 'accepted') && (
                  <button
                    type="button"
                    onClick={() => {
                      const summary =
                        resultText.trim() ||
                        (o.type === 'lab' ? 'Within reference ranges' : o.type === 'rx' ? 'Dispensed' : 'Completed');
                      postLabResult(o.id, summary, session.name);
                      appendAudit({
                        facilityId,
                        actor: session.name,
                        actorBadge: session.badgeId,
                        action: 'clinical_result_posted',
                        entity: 'order',
                        entityId: o.id,
                        detail: summary,
                      });
                      setResultText('');
                      reload();
                      flash('Result on bus — visible to ordering clinician');
                    }}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#0D9488',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <CheckCircle2 size={12} /> Post result
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        <input
          style={{ ...input, marginTop: 12 }}
          placeholder="Optional result text before Post result"
          value={resultText}
          onChange={(e) => setResultText(e.target.value)}
        />
      </div>
    </div>
  );
};

export default ClinicalOrdersPanel;
