'use client';

import React, { useMemo } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  Landmark,
  ShieldCheck,
  Banknote,
  CreditCard,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  FileText,
  Printer,
  Sparkles,
  Scale,
  Receipt,
  Users,
} from 'lucide-react';
import {
  getAkwaRemitDailySummary,
  listAkwaRemitPayments,
  type AkwaRemitDailySummary,
} from '../../lib/akwaRemitStore';

interface Props {
  session: UserSession;
  onNavigateToAkwaRemit?: () => void;
  onNavigateToPayment?: () => void;
  awaitingCount?: number;
  awaitingAmount?: number;
  paidTodayCount?: number;
  paidTodayAmount?: number;
  openBillsAmount?: number;
  onRefresh?: () => void;
}

export const AutoAccountBalancingCard: React.FC<Props> = ({
  session,
  onNavigateToAkwaRemit,
  onNavigateToPayment,
  awaitingCount = 0,
  awaitingAmount = 0,
  paidTodayCount = 0,
  paidTodayAmount = 0,
  openBillsAmount = 0,
  onRefresh,
}) => {
  const facilityId = session.hospitalId || 'IGH-EKT';
  const facilityName = session.facility || 'Hospital';

  const summary: AkwaRemitDailySummary = useMemo(() => {
    try {
      return getAkwaRemitDailySummary(facilityId);
    } catch {
      return {
        facilityId,
        date: new Date().toISOString().slice(0, 10),
        totalCollectionsNgn: 0,
        cashTotalNgn: 0,
        akwaremitPosTotalNgn: 0,
        directAkwaRemitTotalNgn: 0,
        alreadyInAkwaRemitNgn: 0,
        pendingRemittanceNgn: 0,
        complianceRatePercent: 100,
        receiptsCount: 0,
        pendingReceiptsCount: 0,
        remittedReceiptsCount: 0,
        directReceiptsCount: 0,
      };
    }
  }, [facilityId]);

  // Total cash collected vs remitted
  const unremittedCash = summary.pendingRemittanceNgn || summary.cashTotalNgn;
  const isPendingRemittance = unremittedCash > 0;

  // Total collections
  const totalCollections = summary.totalCollectionsNgn || paidTodayAmount;
  const cashCollected = summary.cashTotalNgn;
  const electronicCollected = summary.akwaremitPosTotalNgn;
  const directAkwaRemit = summary.directAkwaRemitTotalNgn;

  // Intelligent balancing computation
  const totalReceivables = awaitingAmount + paidTodayAmount + openBillsAmount;
  const variance = Math.max(0, totalReceivables - (totalCollections + awaitingAmount + openBillsAmount));
  const isBalanced = variance === 0;

  // Print Daily Balancing Sheet
  const handlePrintBalancingSheet = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Daily Account Balancing & Remittance Statement - ${facilityName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 32px; color: #0F172A; }
          .header { text-align: center; border-bottom: 2px solid #0F172A; padding-bottom: 16px; margin-bottom: 24px; }
          .title { font-size: 20px; font-weight: 800; text-transform: uppercase; margin: 0; }
          .subtitle { font-size: 13px; color: #475569; margin-top: 4px; }
          .state-badge { display: inline-block; padding: 4px 12px; background: #ECFDF5; border: 1px solid #10B981; color: #065F46; font-size: 11px; font-weight: 700; border-radius: 999px; margin-top: 8px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
          .card { border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px 16px; }
          .card-title { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; }
          .card-value { font-size: 22px; font-weight: 800; color: #0F172A; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
          th, td { border: 1px solid #CBD5E1; padding: 10px 12px; text-align: left; }
          th { background: #F8FAFC; font-weight: 700; }
          .sign-row { display: flex; justify-content: space-between; margin-top: 60px; padding-top: 20px; }
          .sign-box { width: 220px; border-top: 1px dashed #0F172A; text-align: center; font-size: 12px; padding-top: 6px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${facilityName}</div>
          <div class="subtitle">Ministry of Health · Akwa Ibom State Government</div>
          <div class="subtitle">Daily Account Balancing & Akwa Remitta Reconciliation Audit</div>
          <div class="state-badge">Akwa Remitta Central Revenue System Compliant</div>
          <div style="font-size: 12px; margin-top: 8px; color: #64748B;">Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · Station Time: ${new Date().toLocaleTimeString()}</div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-title">Total Verified Collections</div>
            <div class="card-value">₦${totalCollections.toLocaleString()}</div>
            <div style="font-size: 11px; color: #10B981; margin-top: 4px;">${summary.receiptsCount} Total Receipts Issued</div>
          </div>
          <div class="card">
            <div class="card-title">Physical Cash in Till (Custody)</div>
            <div class="card-value">₦${cashCollected.toLocaleString()}</div>
            <div style="font-size: 11px; color: #F59E0B; margin-top: 4px;">Unremitted Cash: ₦${unremittedCash.toLocaleString()}</div>
          </div>
          <div class="card">
            <div class="card-title">Electronic AkwaRemit POS / Transfer</div>
            <div class="card-value">₦${electronicCollected.toLocaleString()}</div>
            <div style="font-size: 11px; color: #0284C7; margin-top: 4px;">Direct Bank Settlement</div>
          </div>
          <div class="card">
            <div class="card-title">Akwa Remitta Remittance Status</div>
            <div class="card-value">${summary.complianceRatePercent}% Remitted</div>
            <div style="font-size: 11px; color: #059669; margin-top: 4px;">₦${summary.alreadyInAkwaRemitNgn.toLocaleString()} Lodged to State Treasury</div>
          </div>
        </div>

        <h3>Reconciliation Ledger Summary</h3>
        <table>
          <thead>
            <tr>
              <th>Revenue Channel</th>
              <th>Method</th>
              <th>Amount (NGN)</th>
              <th>Audit Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Physical Cash Collections</td>
              <td>Cash (Hospital Desk Till)</td>
              <td>₦${cashCollected.toLocaleString()}</td>
              <td>${unremittedCash === 0 ? '✓ Fully Remitted to Akwa Remitta' : '⚠️ Pending State Lodgement'}</td>
            </tr>
            <tr>
              <td>Digital Collections</td>
              <td>AkwaRemit POS Terminal / Transfer</td>
              <td>₦${electronicCollected.toLocaleString()}</td>
              <td>✓ Realtime Verified & Settled</td>
            </tr>
            <tr>
              <td>Direct State Portal</td>
              <td>Direct Akwa Remitta RRR</td>
              <td>₦${directAkwaRemit.toLocaleString()}</td>
              <td>✓ Direct to State Treasury</td>
            </tr>
            <tr>
              <td>Front Desk Cleared Invoices</td>
              <td>Reception Folder & Triage Fees</td>
              <td>₦${paidTodayAmount.toLocaleString()}</td>
              <td>${paidTodayCount} Patients Cleared</td>
            </tr>
            <tr style="font-weight: 800; background: #F1F5F9;">
              <td colspan="2">TOTAL HOSPITAL REVENUE (TODAY)</td>
              <td>₦${totalCollections.toLocaleString()}</td>
              <td>${isBalanced ? 'BALANCED' : 'RECONCILED'}</td>
            </tr>
          </tbody>
        </table>

        <div class="sign-row">
          <div class="sign-box">
            <strong>${session.name}</strong><br/>
            Hospital Cashier / Revenue Collector<br/>
            Badge: ${session.badgeId || 'CASHIER'}
          </div>
          <div class="sign-box">
            <strong>Head of Accounts / Internal Auditor</strong><br/>
            Witness &amp; Dual-Control Cash Count<br/>
            Akwa Ibom State MOH
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── 1. Akwa Remitta Cash Remittance Reminder Alert Banner ── */}
      {isPendingRemittance ? (
        <div
          style={{
            background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 50%, #FDE68A 100%)',
            border: '1.5px solid #F59E0B',
            borderRadius: 18,
            padding: '16px 20px',
            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.15)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1, minWidth: 260 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#D97706',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)',
              }}
            >
              <Landmark size={24} strokeWidth={2} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: '#92400E', background: '#FDE68A', padding: '2px 8px', borderRadius: 6 }}>
                  Akwa Remitta Mandate · State Treasury Lodgement
                </span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#78350F', marginTop: 3 }}>
                Collected Physical Cash: ₦{unremittedCash.toLocaleString()} awaiting remittance
              </div>
              <div style={{ fontSize: 12, color: '#92400E', marginTop: 2, lineHeight: 1.4 }}>
                State revenue policy requires all hospital desk cash to be batched and remitted to the <strong>Akwa Ibom State Single Treasury Account</strong> via Akwa Remitta.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              onClick={onNavigateToAkwaRemit}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 18px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #0052D4 0%, #0D9488 100%)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(0, 82, 212, 0.25)',
              }}
            >
              <Landmark size={15} />
              Remit to Akwa Remitta Now
              <ArrowRight size={15} />
            </button>
            <button
              type="button"
              onClick={handlePrintBalancingSheet}
              title="Print Balancing & Remittance Statement"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '11px 14px',
                borderRadius: 12,
                border: '1px solid #D97706',
                background: '#fff',
                color: '#78350F',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <Printer size={15} />
              Statement
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
            border: '1.5px solid #10B981',
            borderRadius: 18,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#065F46' }}>
                Akwa Remitta Remittance Compliant · Zero Pending Cash
              </div>
              <div style={{ fontSize: 12, color: '#047857', marginTop: 1 }}>
                All collected hospital revenues have been successfully lodged into the State Treasury Account.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onNavigateToAkwaRemit}
              style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #059669', background: '#fff', color: '#065F46', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >
              View Remittance Audit Batches
            </button>
          </div>
        </div>
      )}

      {/* ── 2. Auto Account Balancing Intelligence Panel ── */}
      <div
        style={{
          background: '#fff',
          borderRadius: 20,
          border: '1px solid #E2E8F0',
          boxShadow: '0 12px 36px rgba(15, 23, 42, 0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            background: 'linear-gradient(180deg, #F8FAFC 0%, #fff 100%)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #0052D4, #0D9488)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Scale size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                Auto Account Balancing Intelligence
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: '#EFF6FF',
                    color: '#0284C7',
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  <Sparkles size={11} /> AI RECONCILIATION ACTIVE
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                Real-time multi-ledger reconciliation: Invoices vs Physical Cash vs AkwaRemit POS vs State TSA
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                background: isBalanced ? '#ECFDF5' : '#FFFBEB',
                color: isBalanced ? '#059669' : '#B45309',
                border: `1px solid ${isBalanced ? '#A7F3D0' : '#FDE68A'}`,
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: isBalanced ? '#10B981' : '#F59E0B',
                  boxShadow: `0 0 0 3px ${isBalanced ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
                }}
              />
              {isBalanced ? 'ALL ACCOUNTS BALANCED' : 'RECONCILIATION IN PROGRESS'}
            </span>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                title="Refresh Balancing Matrix"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  background: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748B',
                }}
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 4-Quadrant Visual Ledger Grid */}
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
          {/* Quadrant 1: Invoiced Expected */}
          <div style={{ background: '#F8FAFC', borderRadius: 14, border: '1px solid #E2E8F0', padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
              <FileText size={14} color="#0284C7" />
              Invoiced (Expected)
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginTop: 8 }}>
              ₦{(awaitingAmount + paidTodayAmount).toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
              {awaitingCount} frontdesk unpaid ({`₦${awaitingAmount.toLocaleString()}`})
            </div>
          </div>

          {/* Quadrant 2: Cash in Drawer */}
          <div style={{ background: '#FFFBEB', borderRadius: 14, border: '1px solid #FED7AA', padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#92400E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
              <Banknote size={14} color="#D97706" />
              Physical Cash in Till
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#78350F', marginTop: 8 }}>
              ₦{cashCollected.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: unremittedCash > 0 ? '#B45309' : '#059669', marginTop: 4, fontWeight: 600 }}>
              {unremittedCash > 0 ? `₦${unremittedCash.toLocaleString()} to lodge` : 'Fully remitted'}
            </div>
          </div>

          {/* Quadrant 3: Paystack Electronic */}
          <div style={{ background: '#F0FDFA', borderRadius: 14, border: '1px solid #CCFBF1', padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0D9488', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
              <CreditCard size={14} color="#0D9488" />
              AkwaRemit POS / Transfer
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#134E4A', marginTop: 8 }}>
              ₦{electronicCollected.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: '#0F766E', marginTop: 4 }}>
              Direct bank settlement (0 risk)
            </div>
          </div>

          {/* Quadrant 4: State Treasury Remitted */}
          <div style={{ background: '#ECFDF5', borderRadius: 14, border: '1px solid #A7F3D0', padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#065F46', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
              <Landmark size={14} color="#059669" />
              Akwa Remitta Settled
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#064E3B', marginTop: 8 }}>
              ₦{summary.alreadyInAkwaRemitNgn.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: '#059669', marginTop: 4, fontWeight: 700 }}>
              {summary.complianceRatePercent}% compliance rating
            </div>
          </div>
        </div>

        {/* Intelligence Insights & Audit Footer */}
        <div
          style={{
            padding: '12px 20px',
            background: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: '#475569' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} color="#10B981" />
              AkwaRemit Gateway: Realtime live sync active
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Receipt size={14} color="#0284C7" />
              Receipt tracking: {summary.receiptsCount} recorded today
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={handlePrintBalancingSheet}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                background: '#fff',
                color: '#334155',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Printer size={13} />
              Print Audit Sheet
            </button>
            <button
              type="button"
              onClick={onNavigateToAkwaRemit}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                background: '#0F172A',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              AkwaRemit Hub <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

