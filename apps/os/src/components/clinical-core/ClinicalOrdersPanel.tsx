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
import { listPatients, type FacilityPatient } from '../../lib/patientRegistryStore';
import { appendAudit } from '../../lib/auditLogStore';
import { FlaskConical, Pill, Activity, CheckCircle2 } from 'lucide-react';

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

  const submitOrder = () => {
    const p = patients.find((x) => x.id === patientId);
    if (!p) {
      flash('Select a patient');
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
      detail: `${type} ${name}`,
    });
    reload();
    flash(`Order ${o.id} placed`);
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
        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Patient</label>
        <select style={{ ...input, marginBottom: 10 }} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
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
        <button
          type="button"
          onClick={submitOrder}
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
