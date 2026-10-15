'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, TrendingUp, CreditCard, Shield, Clock,
  FileText, CheckCircle2, AlertTriangle, ArrowUpRight, BarChart3, Filter
} from 'lucide-react';
import { listBillLines, subscribeBills, type PatientBillLine } from '../../lib/patientBillingStore';
import { listAccountsRequests, subscribeAccountsRequests, type FrontDeskAccountsRequest } from '../../lib/frontDeskAccountsBridge';
import type { UserSession } from '../auth/AuthScreen';

interface Props {
  session?: UserSession;
}

const formatNaira = (n: number) => `₦${(n || 0).toLocaleString('en-NG')}`;

export const AdminRevenueOverview: React.FC<Props> = ({ session }) => {
  const facilityId = session?.hospitalId || 'IGH-EKT';
  const [bills, setBills] = useState<PatientBillLine[]>([]);
  const [accountsReqs, setAccountsReqs] = useState<FrontDeskAccountsRequest[]>([]);
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');

  const reload = () => {
    setBills(listBillLines(facilityId));
    setAccountsReqs(listAccountsRequests(facilityId));
  };

  useEffect(() => {
    reload();
    const unsubBills = subscribeBills(reload);
    const unsubReqs = subscribeAccountsRequests(reload);
    return () => {
      unsubBills();
      unsubReqs();
    };
  }, [facilityId]);

  // Aggregate metrics
  const stats = useMemo(() => {
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalInsurance = 0;
    let totalWaived = 0;

    const sourceBreakdown: Record<string, number> = {
      consult: 0,
      pharmacy: 0,
      lab: 0,
      imaging: 0,
      opd: 0,
      other: 0,
    };

    const channelBreakdown: Record<string, number> = {
      cashier: 0,
      pharmacy: 0,
      hmo: 0,
      paystack: 0,
    };

    bills.forEach((b) => {
      const amt = Number(b.amountNgn) || 0;
      if (b.status === 'paid') {
        totalCollected += amt;
        const via = b.paidVia || 'cashier';
        channelBreakdown[via] = (channelBreakdown[via] || 0) + amt;
      } else if (b.status === 'unpaid' || b.status === 'partial') {
        totalOutstanding += amt;
      } else if (b.status === 'hmo') {
        totalInsurance += amt;
      } else if (b.status === 'waived') {
        totalWaived += amt;
      }

      const src = b.source || 'other';
      sourceBreakdown[src] = (sourceBreakdown[src] || 0) + amt;
    });

    // Also include front desk accounts requests if any
    accountsReqs.forEach((r) => {
      const amt = Number(r.amountNgn) || 0;
      if (r.status === 'paid') {
        totalCollected += amt;
      } else if (r.status === 'awaiting_payment' || r.status === 'partial') {
        totalOutstanding += amt;
      }
    });

    const totalBilled = totalCollected + totalOutstanding + totalInsurance + totalWaived;
    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100;

    return {
      totalCollected,
      totalOutstanding,
      totalInsurance,
      totalWaived,
      totalBilled,
      collectionRate,
      sourceBreakdown,
      channelBreakdown,
      transactionCount: bills.length + accountsReqs.length,
    };
  }, [bills, accountsReqs]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart3 size={24} color="#0284C7" />
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0F172A' }}>
              Hospital Revenue & Collections Executive Overview
            </h2>
          </div>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.85rem' }}>
            Financial health, departmental billing splits, insurance capitation, and receivables for {session?.facility || facilityId}.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {(['today', 'week', 'month', 'all'] as const).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setFilterPeriod(period)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '0.78rem',
                fontWeight: 700,
                border: filterPeriod === period ? '1px solid #0284C7' : '1px solid #E2E8F0',
                background: filterPeriod === period ? '#F0F9FF' : '#FFFFFF',
                color: filterPeriod === period ? '#0284C7' : '#64748B',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {period === 'all' ? 'All Time' : `This ${period}`}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 16,
            padding: '16px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#059669' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>TOTAL REVENUE COLLECTED</span>
            <ArrowUpRight size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0F172A', marginTop: 8 }}>
            {formatNaira(stats.totalCollected)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: 4, fontWeight: 600 }}>
            {stats.collectionRate}% Collection Rate
          </div>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 16,
            padding: '16px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#D97706' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>OUTSTANDING RECEIVABLES</span>
            <Clock size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0F172A', marginTop: 8 }}>
            {formatNaira(stats.totalOutstanding)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#D97706', marginTop: 4, fontWeight: 600 }}>
            Pending patient settlement
          </div>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 16,
            padding: '16px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#2563EB' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>AKSHIA / NHIA CLAIMS</span>
            <Shield size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0F172A', marginTop: 8 }}>
            {formatNaira(stats.totalInsurance)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#3B82F6', marginTop: 4, fontWeight: 600 }}>
            Public & Private Insurance Capitation
          </div>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 16,
            padding: '16px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#7C3AED' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>TOTAL TRANSACTIONS</span>
            <FileText size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0F172A', marginTop: 8 }}>
            {stats.transactionCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#8B5CF6', marginTop: 4, fontWeight: 600 }}>
            Audited billing events logged
          </div>
        </div>
      </div>

      {/* Grid: Departmental Source Breakdown + Channels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Department Revenue Streams */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
            Revenue by Service Stream
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { key: 'pharmacy', label: 'Pharmacy Dispensary', color: '#0284C7' },
              { key: 'lab', label: 'Laboratory Services', color: '#10B981' },
              { key: 'consult', label: 'Clinical Consultations & OPD', color: '#F59E0B' },
              { key: 'imaging', label: 'Radiology & Imaging', color: '#8B5CF6' },
              { key: 'other', label: 'Ward Nursing & Sundry Fees', color: '#64748B' },
            ].map((s) => {
              const val = stats.sourceBreakdown[s.key] || 0;
              const pct = stats.totalBilled > 0 ? Math.round((val / stats.totalBilled) * 100) : 0;
              return (
                <div key={s.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{s.label}</span>
                    <span style={{ fontWeight: 800, color: '#0F172A' }}>{formatNaira(val)} ({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 3, background: '#F1F5F9' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: s.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Channels & Reconciliation */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
            Collection Channel Distribution
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F8FAFC', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CreditCard size={18} color="#0284C7" />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>Central Hospital Cashier Till</div>
                  <div style={{ fontSize: '0.74rem', color: '#64748B' }}>Cash & POS Terminal</div>
                </div>
              </div>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A' }}>
                {formatNaira(stats.channelBreakdown.cashier)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F8FAFC', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shield size={18} color="#3B82F6" />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>Direct HMO / AKSHIA Settlements</div>
                  <div style={{ fontSize: '0.74rem', color: '#64748B' }}>State & Federal Health Insurance</div>
                </div>
              </div>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A' }}>
                {formatNaira(stats.totalInsurance)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F8FAFC', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <DollarSign size={18} color="#10B981" />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>Pharmacy Point-of-Dispense</div>
                  <div style={{ fontSize: '0.74rem', color: '#64748B' }}>Direct pharmacy desk receipts</div>
                </div>
              </div>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F172A' }}>
                {formatNaira(stats.channelBreakdown.pharmacy)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Audited Billing Ledger */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
            Hospital Audit Billing Ledger
          </h3>
          <span style={{ fontSize: '0.76rem', color: '#64748B' }}>Showing latest records</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '10px 16px', fontWeight: 700 }}>Patient</th>
                <th style={{ padding: '10px 16px', fontWeight: 700 }}>Service Stream</th>
                <th style={{ padding: '10px 16px', fontWeight: 700 }}>Amount</th>
                <th style={{ padding: '10px 16px', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '10px 16px', fontWeight: 700 }}>Channel</th>
                <th style={{ padding: '10px 16px', fontWeight: 700 }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>
                    No recorded billing transactions yet for this facility.
                  </td>
                </tr>
              ) : (
                bills.slice(0, 15).map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 700, color: '#0F172A' }}>
                      {b.patientName || 'Patient'}
                      <div style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'monospace' }}>
                        {b.hospitalNumber || b.patientId}
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', textTransform: 'capitalize', color: '#334155' }}>
                      {b.source} — {b.description}
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 700, color: '#0F172A' }}>
                      {formatNaira(b.amountNgn)}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          textTransform: 'uppercase',
                          background:
                            b.status === 'paid'
                              ? '#ECFDF5'
                              : b.status === 'unpaid'
                              ? '#FEF2F2'
                              : b.status === 'hmo'
                              ? '#EFF6FF'
                              : '#F8FAFC',
                          color:
                            b.status === 'paid'
                              ? '#059669'
                              : b.status === 'unpaid'
                              ? '#DC2626'
                              : b.status === 'hmo'
                              ? '#2563EB'
                              : '#64748B',
                        }}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#64748B', textTransform: 'capitalize' }}>
                      {b.paidVia || 'Pending'}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#94A3B8', fontSize: '0.75rem' }}>
                      {b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-GB') : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminRevenueOverview;
