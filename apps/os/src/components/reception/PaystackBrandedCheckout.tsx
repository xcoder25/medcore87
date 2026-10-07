'use client';

/**
 * Digital payments only via Paystack:
 * - Card — Paystack Terminal (PIN/card on device, never on hospital PC)
 * - Transfer — bank transfer / USSD collection
 * PAID only after server verify.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  openPaystackCheckout,
  hasPaystackKey,
  makePaystackReference,
  transferExpiryMs,
  formatCountdown,
  verifyPaystackPayment,
  chargePaystackTerminal,
  getPaystackTerminalId,
  type PaystackSuccess,
} from '../../lib/paystackClient';
import { CreditCard, Building2, X, ShieldCheck, Loader2, Smartphone } from 'lucide-react';

export type PaystackCheckoutInput = {
  facilityId: string;
  facilityName: string;
  patientName: string;
  hospitalNumber: string;
  patientEmail?: string;
  amountNgn: number;
  purpose: string;
  cashierName?: string;
  /** card_terminal | transfer */
  mode?: 'card_terminal' | 'transfer';
};

type Props = {
  open: boolean;
  input: PaystackCheckoutInput | null;
  onClose: () => void;
  onPaid: (result: {
    reference: string;
    paystackRef: string;
    amountNgn: number;
    channel: string;
    raw?: PaystackSuccess | Record<string, unknown>;
  }) => void;
};

export const PaystackBrandedCheckout: React.FC<Props> = ({ open, input, onClose, onPaid }) => {
  const mode = input?.mode || 'transfer';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'ready' | 'waiting' | 'verifying' | 'success'>('ready');
  const [reference, setReference] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [clock, setClock] = useState('--:--');
  const [hint, setHint] = useState('');

  useEffect(() => {
    if (!open || !input) return;
    setError('');
    setBusy(false);
    setPhase('ready');
    setReference(makePaystackReference('MC'));
    setExpiresAt(0);
    setHint('');
  }, [open, input?.hospitalNumber, input?.amountNgn, input?.mode]);

  useEffect(() => {
    if (phase !== 'waiting' || !expiresAt) return;
    const tick = () => setClock(formatCountdown(expiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, expiresAt]);

  const confirmVerified = useCallback(
    async (ref: string, fallbackChannel: string, raw?: PaystackSuccess | Record<string, unknown>) => {
      if (!input) return;
      setPhase('verifying');
      setBusy(true);
      setError('');
      const v = await verifyPaystackPayment(ref);
      if (!v.verified) {
        setError(v.error || 'Payment not confirmed by Paystack yet. Wait for terminal/transfer to complete, then Verify again.');
        setPhase('waiting');
        setBusy(false);
        return;
      }
      setPhase('success');
      setBusy(false);
      onPaid({
        reference: ref,
        paystackRef: v.reference || ref,
        amountNgn: v.amountNgn || input.amountNgn,
        channel: v.channel || fallbackChannel,
        raw,
      });
    },
    [input, onPaid]
  );

  const startTerminal = useCallback(async () => {
    if (!input) return;
    setBusy(true);
    setError('');
    const ref = reference || makePaystackReference('MC');
    setReference(ref);
    const email =
      input.patientEmail?.trim() ||
      `${input.hospitalNumber.replace(/\W/g, '').toLowerCase() || 'patient'}@medcore.pay`;
    const terminalId = getPaystackTerminalId();
    if (!terminalId) {
      setError('Set Paystack Terminal device ID in Front Desk settings (POS Terminal ID). Card details are entered only on the terminal.');
      setBusy(false);
      return;
    }
    const res = await chargePaystackTerminal({
      amountNgn: input.amountNgn,
      email,
      reference: ref,
      deviceId: terminalId,
      metadata: {
        facilityId: input.facilityId,
        patientName: input.patientName,
        hospitalNumber: input.hospitalNumber,
        purpose: input.purpose,
        cashier: input.cashierName || '',
      },
    });
    if (!res.ok) {
      setError(res.error || 'Could not send charge to terminal');
      setBusy(false);
      return;
    }
    setHint(res.displayText || 'Patient should enter card and PIN on the Paystack Terminal only.');
    setPhase('waiting');
    setExpiresAt(transferExpiryMs(15));
    setBusy(false);
  }, [input, reference]);

  const startTransfer = useCallback(async () => {
    if (!input) return;
    if (!hasPaystackKey()) {
      setError('Add Paystack public key in Admin / Front Desk settings (public key only — never the secret).');
      return;
    }
    setBusy(true);
    setError('');
    const ref = reference || makePaystackReference('MC');
    setReference(ref);
    setExpiresAt(transferExpiryMs(30));
    setPhase('waiting');
    setHint('Patient pays via bank transfer or USSD. No card numbers on this computer.');
    const email =
      input.patientEmail?.trim() ||
      `${input.hospitalNumber.replace(/\W/g, '').toLowerCase() || 'patient'}@medcore.pay`;
    try {
      await openPaystackCheckout({
        email,
        amountNgn: input.amountNgn,
        reference: ref,
        channels: ['bank_transfer', 'ussd', 'bank'],
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
          void confirmVerified(res.reference || res.trans || ref, 'bank_transfer', res);
        },
        onClose: () => {
          setBusy(false);
        },
      });
    } catch (e: any) {
      setError(e?.message || 'Could not open transfer collection');
      setPhase('ready');
    }
    setBusy(false);
  }, [input, reference, confirmVerified]);

  if (!open || !input) return null;

  const isCard = mode === 'card_terminal';

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          borderRadius: 18,
          background: '#fff',
          border: '1px solid #E2E8F0',
          boxShadow: '0 24px 64px rgba(15,23,42,0.28)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            background: 'linear-gradient(135deg,#0B1220,#1E3A8A)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              {isCard ? 'Card — Paystack Terminal' : 'Transfer — Paystack'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              DIGITAL · no card data on hospital PC
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 13, color: '#334155', marginBottom: 12, lineHeight: 1.5 }}>
            <strong>{input.patientName}</strong>
            <span style={{ color: '#94A3B8' }}> · {input.hospitalNumber}</span>
            <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
              ₦{input.amountNgn.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: '#64748B' }}>{input.purpose}</div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 12,
              background: '#F0F9FF',
              border: '1px solid #BAE6FD',
              fontSize: 12,
              color: '#0C4A6E',
              marginBottom: 14,
              alignItems: 'flex-start',
            }}
          >
            <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              {isCard
                ? 'Patient enters card number and PIN only on the Paystack Terminal. This computer never sees card details.'
                : 'Patient pays by bank transfer or USSD via Paystack. Marked PAID only after Paystack verification.'}
            </div>
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 10, padding: '10px 12px', fontSize: 12, marginBottom: 12 }}>
              {error}
            </div>
          )}

          {phase === 'ready' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => (isCard ? startTerminal() : startTransfer())}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(90deg,#0052D4,#0D9488)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 14,
                cursor: busy ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {busy ? <Loader2 size={18} className="spin" /> : isCard ? <Smartphone size={18} /> : <Building2 size={18} />}
              {isCard ? 'Send charge to Terminal' : 'Open Transfer / USSD'}
            </button>
          )}

          {phase === 'waiting' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#334155', marginBottom: 8 }}>{hint}</div>
              {expiresAt > 0 && (
                <div style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 800, fontSize: 28, color: '#0F172A', marginBottom: 8 }}>
                  {clock}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 12 }}>Ref · {reference}</div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmVerified(reference, isCard ? 'card' : 'bank_transfer')}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#059669',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: busy ? 'wait' : 'pointer',
                }}
              >
                {busy ? 'Verifying…' : 'Verify payment with Paystack'}
              </button>
              <p style={{ fontSize: 11, color: '#64748B', marginTop: 10 }}>
                Receipt is generated only after successful verification.
              </p>
            </div>
          )}

          {phase === 'verifying' && (
            <div style={{ textAlign: 'center', padding: 16, color: '#64748B' }}>
              <Loader2 size={24} /> Verifying with Paystack…
            </div>
          )}

          {phase === 'success' && (
            <div style={{ textAlign: 'center', padding: 12, color: '#047857', fontWeight: 800 }}>
              Payment verified · receipt generating…
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
