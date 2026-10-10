'use client';

import React, { useMemo, useState } from 'react';
import {
  checkAkshiaEligibility,
  requestAkshiaPreAuth,
  listTariff,
  computeCopay,
  type AkshiaEligibility,
} from '../../lib/akshiaGateway';
import {
  ensureUpi,
  createStatewideReferral,
  listStatewideReferrals,
  listAksFacilities,
  updateReferralStatus,
} from '../../lib/statewideUpi';
import { depositWallet, getWallet, listWalletTxns } from '../../lib/patientWalletStore';
import {
  buildAncPlan,
  buildNpiSchedule,
  getNpiGiven,
  markNpiGiven,
  sendReminderSms,
  type SmsLang,
} from '../../lib/ancNpiSms';
import {
  downloadDhis2Aggregate,
  downloadNhmisMonthly,
  downloadNdrLineList,
  autoSubmitDhis2,
} from '../../lib/dhis2Export';
import { runOfflineTabletCertification, certSummary } from '../../lib/offlineTabletCert';

type Tab = 'akshia' | 'upi' | 'wallet' | 'anc' | 'reports' | 'cert';

export const AkwaIbomStateSuite: React.FC<{ session?: any }> = ({ session }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const facilityName = session?.facility || 'Hospital';
  const [tab, setTab] = useState<Tab>('akshia');
  const [msg, setMsg] = useState('');

  // AKSHIA
  const [memberId, setMemberId] = useState('');
  const [elig, setElig] = useState<AkshiaEligibility | null>(null);
  const [gross, setGross] = useState(5000);

  // UPI / referral
  const [fn, setFn] = useState('');
  const [ln, setLn] = useState('');
  const [nin, setNin] = useState('');
  const [toFac, setToFac] = useState('IBOM-SPEC');
  const [upiOut, setUpiOut] = useState('');
  const facilities = listAksFacilities();
  const refs = listStatewideReferrals(facilityId);

  // Wallet
  const [wPid, setWPid] = useState('');
  const [wHn, setWHn] = useState('');
  const [wName, setWName] = useState('');
  const [wAmt, setWAmt] = useState(20000);
  const wallet = wPid ? getWallet(facilityId, wPid) : null;
  const wTxns = wPid ? listWalletTxns(facilityId, wPid).slice(0, 8) : [];

  // ANC / NPI
  const [lmp, setLmp] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [lang, setLang] = useState<SmsLang>('en');
  const [ancText, setAncText] = useState('');
  const [npiRows, setNpiRows] = useState<ReturnType<typeof buildNpiSchedule>>([]);

  // Cert
  const certs = useMemo(() => runOfflineTabletCertification(), [tab]);
  const summary = certSummary(certs);

  const card: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  };
  const btn: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg,#0066FF,#00D4A8)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
  };
  const input: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #E2E8F0',
    marginBottom: 8,
    fontSize: 14,
  };

  return (
    <div style={{ padding: 16, maxWidth: 960, margin: '0 auto' }} className="aks-state-suite">
      <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem', color: '#0F172A' }}>Akwa Ibom State readiness</h2>
      <p style={{ margin: '0 0 14px', color: '#64748B', fontSize: 13 }}>
        AKSHIA · Statewide UPI & referral · Patient wallet · ANC/NPI/SMS · DHIS2/NDR · Offline & tablet cert
      </p>
      {msg && (
        <div style={{ ...card, background: '#F0FDFA', borderColor: '#99F6E4', color: '#0F766E', fontSize: 13 }}>
          {msg}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {(
          [
            ['akshia', 'AKSHIA'],
            ['upi', 'UPI & referral'],
            ['wallet', 'Wallet'],
            ['anc', 'ANC / NPI / SMS'],
            ['reports', 'DHIS2 / NDR'],
            ['cert', 'Offline / tablet'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{
              ...btn,
              background: tab === k ? 'linear-gradient(135deg,#0066FF,#00D4A8)' : '#F1F5F9',
              color: tab === k ? '#fff' : '#334155',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'akshia' && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Eligibility, tariff & pre-auth</h3>
          <input style={input} placeholder="AKSHIA member ID (e.g. AKS-CS-001)" value={memberId} onChange={(e) => setMemberId(e.target.value)} />
          <button
            type="button"
            style={btn}
            onClick={async () => {
              const r = await checkAkshiaEligibility(memberId, facilityId);
              setElig(r);
              setMsg(r.message);
            }}
          >
            Check eligibility
          </button>
          {elig && (
            <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.5 }}>
              <div>
                <strong>{elig.planName}</strong> · {elig.status} · {elig.mode}
              </div>
              <div>
                Co-pay {elig.copayPercent}% · Capitation left ₦{(elig.capitationRemainingNgn ?? 0).toLocaleString()}
              </div>
              <div style={{ marginTop: 8 }}>
                Gross ₦{' '}
                <input
                  type="number"
                  value={gross}
                  onChange={(e) => setGross(Number(e.target.value))}
                  style={{ width: 100, padding: 6 }}
                />
                {elig.ok && (
                  <span style={{ marginLeft: 8 }}>
                    Patient ₦{computeCopay(elig, gross).patientNgn.toLocaleString()} · Insurer ₦
                    {computeCopay(elig, gross).insurerNgn.toLocaleString()}
                  </span>
                )}
              </div>
              <button
                type="button"
                style={{ ...btn, marginTop: 10 }}
                onClick={async () => {
                  const r = await requestAkshiaPreAuth({
                    facilityId,
                    memberId: elig.memberId,
                    patientName: session?.name || 'Patient',
                    serviceCodes: ['PROC-MINOR'],
                    clinicalJustification: 'Clinical need',
                    estimatedAmountNgn: gross,
                  });
                  setMsg(`${r.status}: ${r.authCode} — ${r.message}`);
                }}
              >
                Request pre-auth
              </button>
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <strong>Tariff ({listTariff().length} items)</strong>
            <ul style={{ fontSize: 12, color: '#475569', maxHeight: 160, overflow: 'auto' }}>
              {listTariff().map((t) => (
                <li key={t.code}>
                  {t.code} · {t.name} · ₦{t.amountNgn.toLocaleString()}
                  {t.requiresPreAuth ? ' · pre-auth' : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === 'upi' && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Statewide UPI + referral loop</h3>
          <input style={input} placeholder="First name" value={fn} onChange={(e) => setFn(e.target.value)} />
          <input style={input} placeholder="Last name" value={ln} onChange={(e) => setLn(e.target.value)} />
          <input style={input} placeholder="NIN (11 digits)" value={nin} onChange={(e) => setNin(e.target.value)} />
          <button
            type="button"
            style={btn}
            onClick={() => {
              const u = ensureUpi({
                facilityId,
                firstName: fn,
                lastName: ln,
                nin,
                homeLga: 'Eket',
              });
              setUpiOut(u.upi);
              setMsg(`UPI issued: ${u.upi}${u.nin ? ` linked to NIN ${u.nin}` : ''}`);
            }}
          >
            Issue / resolve UPI
          </button>
          {upiOut && <p style={{ fontSize: 13 }}>Active UPI: <code>{upiOut}</code></p>}
          <label style={{ fontSize: 12, color: '#64748B' }}>Refer to facility</label>
          <select style={input} value={toFac} onChange={(e) => setToFac(e.target.value)}>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.tier})
              </option>
            ))}
          </select>
          <button
            type="button"
            style={btn}
            onClick={() => {
              if (!upiOut) {
                setMsg('Issue UPI first');
                return;
              }
              const to = facilities.find((f) => f.id === toFac);
              const from = facilities.find((f) => f.id === facilityId);
              const r = createStatewideReferral({
                upi: upiOut,
                nin: nin || undefined,
                patientName: `${fn} ${ln}`.trim() || 'Patient',
                fromFacilityId: facilityId,
                fromFacilityName: from?.name || facilityName,
                toFacilityId: toFac,
                toFacilityName: to?.name || toFac,
                specialty: 'General / specialist',
                priority: 'urgent',
                clinicalSummary: 'Statewide referral from MedCore',
                createdBy: session?.name,
              });
              setMsg(`Referral ${r.id} sent → ${r.toFacilityName}`);
            }}
          >
            Send statewide referral
          </button>
          <ul style={{ fontSize: 12, marginTop: 12 }}>
            {refs.slice(0, 10).map((r) => (
              <li key={r.id} style={{ marginBottom: 6 }}>
                {r.id} · {r.patientName} · {r.fromFacilityName} → {r.toFacilityName} · <strong>{r.status}</strong>{' '}
                <button type="button" style={{ fontSize: 11 }} onClick={() => { updateReferralStatus(r.id, 'accepted'); setMsg(`Accepted ${r.id}`); }}>
                  Accept
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'wallet' && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Patient wallet (deposit → auto-deduct)</h3>
          <p style={{ fontSize: 12, color: '#64748B' }}>
            Lab/Rx bill lines auto-deduct when wallet has balance (wired in billing store).
          </p>
          <input style={input} placeholder="Patient ID" value={wPid} onChange={(e) => setWPid(e.target.value)} />
          <input style={input} placeholder="Hospital number" value={wHn} onChange={(e) => setWHn(e.target.value)} />
          <input style={input} placeholder="Patient name" value={wName} onChange={(e) => setWName(e.target.value)} />
          <input style={input} type="number" value={wAmt} onChange={(e) => setWAmt(Number(e.target.value))} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['cash', 'pos', 'transfer', 'moniepoint', 'opay'] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                style={btn}
                onClick={() => {
                  const r = depositWallet({
                    facilityId,
                    patientId: wPid || wHn,
                    hospitalNumber: wHn || wPid,
                    patientName: wName || 'Patient',
                    amountNgn: wAmt,
                    channel: ch,
                    actorName: session?.name,
                  });
                  setMsg(r.ok ? `Deposited ₦${wAmt.toLocaleString()} via ${ch}. Balance ₦${r.wallet?.balanceNgn.toLocaleString()}` : r.error || 'Failed');
                }}
              >
                Deposit {ch}
              </button>
            ))}
          </div>
          {wallet && (
            <p style={{ marginTop: 12, fontWeight: 700 }}>Balance: ₦{wallet.balanceNgn.toLocaleString()}</p>
          )}
          <ul style={{ fontSize: 12 }}>
            {wTxns.map((t) => (
              <li key={t.id}>
                {t.type} ₦{t.amountNgn.toLocaleString()} · bal ₦{t.balanceAfter.toLocaleString()} · {t.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'anc' && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>ANC schedule · NPI · SMS</h3>
          <input style={input} type="date" value={lmp} onChange={(e) => setLmp(e.target.value)} />
          <button
            type="button"
            style={btn}
            onClick={() => {
              if (!lmp) return setMsg('Set LMP');
              const plan = buildAncPlan({
                facilityId,
                patientId: wPid || 'ANC-PT',
                patientName: wName || 'ANC client',
                lmp,
              });
              setAncText(
                `EDD ${plan.edd} · GA@reg ${plan.gaWeeksAtReg}w · ${plan.visits.length} contacts\n` +
                  plan.visits.map((v) => `${v.dueDate} — ${v.label}`).join('\n')
              );
            }}
          >
            Build ANC calendar
          </button>
          {ancText && <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', background: '#F8FAFC', padding: 10, borderRadius: 8 }}>{ancText}</pre>}
          <input style={input} type="date" value={dob} onChange={(e) => setDob(e.target.value)} placeholder="Child DOB" />
          <button
            type="button"
            style={btn}
            onClick={() => {
              if (!dob) return setMsg('Set date of birth');
              const pid = wPid || 'CHILD-1';
              setNpiRows(buildNpiSchedule(dob, getNpiGiven(pid)));
            }}
          >
            Load NPI schedule
          </button>
          <ul style={{ fontSize: 12 }}>
            {npiRows.map((d) => (
              <li key={d.code}>
                {d.name} · due {d.dueDate} · {d.status}{' '}
                {d.status !== 'given' && (
                  <button
                    type="button"
                    onClick={() => {
                      const pid = wPid || 'CHILD-1';
                      markNpiGiven(pid, d.code);
                      setNpiRows(buildNpiSchedule(dob, getNpiGiven(pid)));
                    }}
                  >
                    Mark given
                  </button>
                )}
              </li>
            ))}
          </ul>
          <input style={input} placeholder="Phone +234…" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <select style={input} value={lang} onChange={(e) => setLang(e.target.value as SmsLang)}>
            <option value="en">English</option>
            <option value="pidgin">Pidgin</option>
            <option value="ibibio">Ibibio</option>
            <option value="annang">Annang</option>
            <option value="oron">Oron</option>
          </select>
          <button
            type="button"
            style={btn}
            onClick={async () => {
              const r = await sendReminderSms({
                phone,
                lang,
                kind: 'anc',
                patientName: wName || 'Client',
                when: lmp || 'your next visit',
                facilityName,
              });
              setMsg(`${r.mode}: ${r.message}\n${r.body}`);
            }}
          >
            Queue ANC SMS
          </button>
        </div>
      )}

      {tab === 'reports' && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>DHIS2 · NHMIS · NDR</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" style={btn} onClick={() => { downloadDhis2Aggregate(facilityId); setMsg('DHIS2 daily JSON downloaded'); }}>
              Download DHIS2 daily
            </button>
            <button type="button" style={btn} onClick={() => { downloadNhmisMonthly(facilityId); setMsg('NHMIS monthly JSON downloaded'); }}>
              Download NHMIS monthly
            </button>
            <button type="button" style={btn} onClick={() => { downloadNdrLineList(facilityId); setMsg('NDR line list downloaded'); }}>
              Download NDR line list
            </button>
            <button
              type="button"
              style={btn}
              onClick={async () => {
                const r = await autoSubmitDhis2(facilityId);
                setMsg(r.message);
              }}
            >
              Auto-submit DHIS2
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#64748B', marginTop: 12 }}>
            Live submit needs DHIS2_BASE_URL, DHIS2_USER, DHIS2_PASSWORD on the server.
          </p>
        </div>
      )}

      {tab === 'cert' && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Offline & tablet certification</h3>
          <p style={{ fontSize: 13 }}>
            Ready: <strong>{summary.ready ? 'YES' : 'NO'}</strong> · fails {summary.fails} · warns {summary.warns}
          </p>
          <ul style={{ fontSize: 13, lineHeight: 1.6 }}>
            {certs.map((c) => (
              <li key={c.id}>
                <span style={{ color: c.level === 'pass' ? '#059669' : c.level === 'warn' ? '#D97706' : '#DC2626' }}>
                  [{c.level}]
                </span>{' '}
                <strong>{c.label}</strong> — {c.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
