'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  openPaystackCheckout,
  hasPaystackKey,
  makePaystackReference,
  transferExpiryMs,
  formatCountdown,
  type PaystackChannel,
  type PaystackSuccess,
} from '../../lib/paystackClient';
import { CreditCard, Building2, Smartphone, Landmark, X, Shield, Clock, CheckCircle2, Loader2 } from 'lucide-react';

export type PaystackCheckoutInput = {
  patientName: string;
  hospitalNumber: string;
  patientEmail?: string;
  amountNgn: number;
  purpose: string;
  facilityName: string;
  facilityId: string;
  cashierName?: string;
};

type Props = {
  open: boolean;
  input: PaystackCheckoutInput | null;
  onClose: () => void;
  /** Called after successful Paystack charge — parent records payment + receipt */
  onPaid: (result: {
    reference: string;
    paystackRef: string;
    amountNgn: number;
    channel: string;
    raw: PaystackSuccess;
  }) => void;
};

const CHANNELS: { id: PaystackChannel; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'bank_transfer', label: 'Bank transfer', icon: Building2 },
  { id: 'ussd', label: 'USSD', icon: Smartphone },
  { id: 'bank', label: 'Bank', icon: Landmark },
];

export const PaystackBrandedCheckout: React.FC<Props> = ({ open, input, onClose, onPaid }) => {
  const [channel, setChannel] = useState<PaystackChannel>('card');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'ready' | 'paystack' | 'transfer_wait' | 'success'>('ready');
  const [reference, setReference] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [clock, setClock] = useState('--:--');

  useEffect(() => {
    if (!open || !input) return;
    setError('');
    setBusy(false);
    setPhase('ready');
    setReference(makePaystackReference('MC'));
    setExpiresAt(0);
  }, [open, input?.hospitalNumber, input?.amountNgn]);

  useEffect(() => {
    if (phase !== 'transfer_wait' || !expiresAt) return;
    const tick = () => setClock(formatCountdown(expiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, expiresAt]);

  const startPay = useCallback(async () => {
    if (!input) return;
    if (!hasPaystackKey()) {
      setError('Add Paystack public key in Admin settings or NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY');
      return;
    }
    setBusy(true);
    setError('');
    setPhase('paystack');
    const ref = reference || makePaystackReference('MC');
    setReference(ref);
    if (channel === 'bank_transfer') {
      setExpiresAt(transferExpiryMs(30));
      setPhase('transfer_wait');
    }
    try {
      const email =
        input.patientEmail?.trim() ||
        `${input.hospitalNumber.replace(/\W/g, '').toLowerCase() || 'patient'}@medcore.pay`;
      await openPaystackCheckout({
        email,
        amountNgn: input.amountNgn,
        reference: ref,
        channels: [channel],
        label: input.facilityName || 'MedCore Hospital',
        metadata: {
          facilityId: input.facilityId,
          facilityName: input.facilityName,
          patientName: input.patientName,
          hospitalNumber: input.hospitalNumber,
          purpose: input.purpose,
          cashier: input.cashierName || '',
        },
        onSuccess: (res) => {
          setPhase('success');
          setBusy(false);
          onPaid({
            reference: ref,
            paystackRef: res.reference || res.trans || ref,
            amountNgn: input.amountNgn,
            channel,
            raw: res,
          });
        },
        onClose: () => {
          setBusy(false);
          if (phase !== 'success') setPhase(channel === 'bank_transfer' ? 'transfer_wait' : 'ready');
        },
      });
    } catch (e: any) {
      setError(e?.message || 'Could not open Paystack');
      setBusy(false);
      setPhase('ready');
    }
  }, [input, channel, reference, onPaid, phase]);

  if (!open || !input) return null;

  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'radial-gradient(ellipse at 20% 0%, #0B3D6E 0%, #061628 45%, #020b16 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
      }}
    >
      {/* soft orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', background: 'rgba(13,148,136,0.12)', top: -80, right: -60, filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', background: 'rgba(37,99,235,0.15)', bottom: -40, left: -40, filter: 'blur(40px)' }} />
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          borderRadius: 24,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, #F8FAFC 100%)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Brand header */}
        <div
          style={{
            padding: '20px 22px 16px',
            background: 'linear-gradient(135deg, #0A2540 0%, #0D4F8B 55%, #0D9488 100%)',
            color: '#fff',
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 36,
              height: 36,
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(0,0,0,0.2)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <img src="/medcore-logo.png" alt="MedCore" style={{ height: 40, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }} />
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.35)' }} />
            <img src="/arise-logo.png" alt="Arise" style={{ height: 36, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.75 }}>
            Secure hospital payment
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, letterSpacing: '-0.02em' }}>
            ₦{input.amountNgn.toLocaleString()}
          </div>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>{input.purpose}</div>
        </div>

        <div style={{ padding: '18px 22px 22px' }}>
          {/* Patient card */}
          <div
            style={{
              background: '#F1F5F9',
              borderRadius: 14,
              padding: '12px 14px',
              marginBottom: 16,
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Patient
            </div>
            <div style={{ fontWeight: 800, color: '#0A2540', fontSize: 16, marginTop: 2 }}>{input.patientName}</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
              {input.hospitalNumber} · {input.facilityName}
            </div>
            {reference && (
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6, fontFamily: 'ui-monospace, monospace' }}>
                Ref · {reference}
              </div>
            )}
          </div>

          {phase === 'success' ? (
            <div style={{ textAlign: 'center', padding: '24px 8px' }}>
              <CheckCircle2 size={48} color="#059669" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 800, fontSize: 18, color: '#065F46' }}>Payment successful</div>
              <div style={{ fontSize: 13, color: '#64748B', marginTop: 6 }}>Receipt is being prepared…</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 8 }}>Pay with</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {CHANNELS.map((c) => {
                  const Icon = c.icon;
                  const active = channel === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChannel(c.id)}
                      disabled={busy}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 12px',
                        borderRadius: 12,
                        border: active ? '2px solid #0D9488' : '1px solid #E2E8F0',
                        background: active ? '#F0FDFA' : '#fff',
                        cursor: busy ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        fontSize: 13,
                        color: active ? '#0F766E' : '#334155',
                      }}
                    >
                      <Icon size={16} />
                      {c.label}
                    </button>
                  );
                })}
              </div>

              {phase === 'transfer_wait' && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <Clock size={18} color="#B45309" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#92400E' }}>Bank transfer window</div>
                    <div style={{ fontSize: 12, color: '#A16207', marginTop: 2, lineHeight: 1.45 }}>
                      Complete the transfer in the Paystack sheet. Time remaining:{' '}
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{clock}</strong>
                      . Details (account / amount) appear on the Paystack panel.
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', color: '#B91C1C', fontSize: 12, fontWeight: 600 }}>
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={() => void startPay()}
                disabled={busy || input.amountNgn < 1}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: 'none',
                  background: busy
                    ? '#94A3B8'
                    : 'linear-gradient(135deg, #0D9488 0%, #0F766E 50%, #0A2540 100%)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: busy ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 8px 24px rgba(13,148,136,0.35)',
                }}
              >
                {busy ? <Loader2 size={18} className="spin" /> : <Shield size={18} />}
                {busy ? 'Opening Paystack…' : `Pay ₦${input.amountNgn.toLocaleString()} securely`}
              </button>

              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 11,
                  color: '#94A3B8',
                }}
              >
                <Shield size={12} />
                Powered by Paystack · Card · Transfer · USSD · Bank
              </div>
              <div style={{ marginTop: 6, textAlign: 'center', fontSize: 10, color: '#CBD5E1' }}>
                MedCore OS · Arise Health
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </div>
  );
};

export default PaystackBrandedCheckout;
