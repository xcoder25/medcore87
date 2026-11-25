'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, Copy, Printer, AlertCircle, Globe } from 'lucide-react';
import type { PatientClinicalBrief } from '../../app/api/ai/patient-brief/route';
import { listVitals } from '../../lib/nursingVitalsStore';
import { listOrders } from '../../lib/clinicalEventBus';
import { getPatient } from '../../lib/patientRegistryStore';

interface Props {
  facilityId: string;
  patientId: string;
  patientName: string;
  diagnosis?: string;
  vitals?: Record<string, string | number>;
}

export const PatientClinicalBriefCard: React.FC<Props> = ({
  facilityId,
  patientId,
  patientName,
  diagnosis,
  vitals,
}) => {
  const [brief, setBrief] = useState<PatientClinicalBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDischarge, setShowDischarge] = useState(false);
  const [lang, setLang] = useState<'english' | 'pidgin' | 'ibibio'>('english');
  const [toast, setToast] = useState('');

  const fetchBrief = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const reg = getPatient(patientId);
      const vitalHist = listVitals(facilityId, patientId).slice(0, 6);
      const ordHist = listOrders(facilityId, { patientId }).slice(0, 12);

      const res = await fetch('/api/ai/patient-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient: {
            id: patientId,
            name: patientName,
            dob: reg?.dob,
            sex: reg?.sex,
            allergies: reg?.allergies,
            chronicConditions: reg?.chronicConditions,
            currentMedications: reg?.currentMedications,
            genotype: reg?.genotype,
            bloodGroup: reg?.bloodGroup,
            vitals,
          },
          vitals: vitalHist,
          orders: ordHist,
          diagnosis,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        brief?: PatientClinicalBrief;
      };
      if (res.ok && json.ok && json.brief) {
        setBrief(json.brief);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBrief();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, patientId]);

  if (!brief && !loading) return null;

  const copyDischarge = () => {
    if (!brief) return;
    const text = `${patientName} — Take-Home Summary (${lang.toUpperCase()}):\n${brief.dischargePacket[lang]}\n\nReturn immediately if:\n- ${brief.dischargePacket.returnPrecautions.join('\n- ')}`;
    void navigator.clipboard?.writeText(text);
    setToast('Copied for WhatsApp / SMS');
    window.setTimeout(() => setToast(''), 2500);
  };

  const printDischarge = () => {
    if (!brief || typeof window === 'undefined') return;
    const w = window.open('', '_blank', 'width=640,height=720');
    if (!w) return;
    w.document.write(
      `<html><head><title>Patient Take-Home Summary</title></head><body style="font-family:sans-serif;padding:24px;line-height:1.6;">
        <h2>${patientName} (${patientId})</h2>
        <p><strong>Clinical Focus:</strong> ${brief.activeProblems.join(', ')}</p>
        <hr/>
        <h3>Instructions (${lang.toUpperCase()})</h3>
        <p>${brief.dischargePacket[lang]}</p>
        <h4>Medications</h4>
        <ul>${brief.medicationSummary.map((m) => `<li>${m}</li>`).join('')}</ul>
        <h4>Emergency Return Warning Signs</h4>
        <ul>${brief.dischargePacket.returnPrecautions.map((r) => `<li>${r}</li>`).join('')}</ul>
      </body></html>`
    );
    w.document.close();
    w.print();
  };

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #F0F9FF 0%, #FFFFFF 100%)',
        border: '1px solid #BAE6FD',
        borderRadius: 14,
        padding: 14,
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
        <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0369A1', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={14} /> 30-Second Patient Brief
        </span>
        <button
          type="button"
          onClick={() => void fetchBrief()}
          disabled={loading}
          title="Refresh brief"
          style={{ border: 'none', background: 'transparent', color: '#0284C7', cursor: 'pointer', padding: 2 }}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {loading && !brief ? (
        <div style={{ fontSize: 11.5, color: '#64748B' }}>Summarizing chart trends…</div>
      ) : brief ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.75rem', color: '#1E293B' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {brief.activeProblems.map((p, i) => (
              <span key={i} style={{ background: '#DBEAFE', color: '#1E40AF', padding: '2px 7px', borderRadius: 999, fontWeight: 700, fontSize: 10.5 }}>
                {p}
              </span>
            ))}
          </div>

          <div>
            <strong style={{ color: '#475569', fontSize: 10.5, textTransform: 'uppercase' }}>Vitals &amp; Labs</strong>
            <div style={{ marginTop: 2 }}>{brief.vitalTrends[0]}</div>
            <div style={{ marginTop: 2, color: '#475569' }}>{brief.labTrends[0]}</div>
          </div>

          {brief.careGaps.length > 0 && (
            <div style={{ padding: '6px 8px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
              <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                <AlertCircle size={12} /> Care Gaps &amp; Safety Alerts
              </div>
              {brief.careGaps.slice(0, 2).map((g, i) => (
                <div key={i} style={{ marginTop: 2 }}>• {g}</div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowDischarge((v) => !v)}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #7DD3FC',
              background: '#FFFFFF',
              color: '#0369A1',
              fontWeight: 800,
              fontSize: 11.5,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Globe size={13} /> {showDischarge ? 'Hide Discharge Packet' : 'Bilingual Discharge Packet'}
          </button>

          {showDischarge && (
            <div style={{ padding: 9, borderRadius: 10, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {(['english', 'pidgin', 'ibibio'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    style={{
                      flex: 1,
                      padding: '3px 6px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      background: lang === l ? '#0284C7' : '#F8FAFC',
                      color: lang === l ? '#FFFFFF' : '#475569',
                      fontSize: 10.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.45, color: '#0F172A', marginBottom: 8 }}>
                {brief.dischargePacket[lang]}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={copyDischarge}
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 7, border: '1px solid #CBD5E1', background: '#F8FAFC', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                >
                  <Copy size={11} /> {toast || 'Copy WhatsApp'}
                </button>
                <button
                  type="button"
                  onClick={printDischarge}
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 7, border: 'none', background: '#0F172A', color: '#FFFFFF', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                >
                  <Printer size={11} /> Print Sheet
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default PatientClinicalBriefCard;
