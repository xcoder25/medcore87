'use client';

import React, { useState } from 'react';
import {
  Users, ShoppingBag, CheckCircle2, AlertTriangle,
  Fingerprint, FileText, Search, Clock
} from 'lucide-react';
import type { ProcurementOrder } from '@medcore/types';

const INITIAL_POS: ProcurementOrder[] = [
  { id: 'PO-01', poNumber: 'PO-2026-081', vendorName: 'MedEquip West Africa Ltd', itemSummary: 'Surgical Sutures & Gloves Restock', totalAmountNgn: 4500000, orderedAt: '2026-09-14', deliveryStatus: 'in_transit' },
  { id: 'PO-02', poNumber: 'PO-2026-082', vendorName: 'B. Braun Medical Nigeria', itemSummary: 'IV Cannulas & Infusion Giving Sets', totalAmountNgn: 2800000, orderedAt: '2026-09-15', deliveryStatus: 'approved' },
  { id: 'PO-03', poNumber: 'PO-2026-083', vendorName: 'Emzor Pharmaceuticals', itemSummary: 'IV Artesunate & Essential Antibiotics Batch', totalAmountNgn: 8200000, orderedAt: '2026-09-12', deliveryStatus: 'received_inspected' },
];

export const ProcurementHrSuite: React.FC = () => {
  const [pos, setPos] = useState<ProcurementOrder[]>(INITIAL_POS);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Clinical Staff on Duty (Clocked In)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>186 / 190</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>97.8% Turnout</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Biometric Clock-In Verified</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Active Procurement POs</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>?15.5M</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>3 Purchase Orders in Execution</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Shift & Hazard Allowances</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>100% Cleared</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Night Shift & Emergency Duty Auto-Computed</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #8B5CF6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Vendor Compliance Rating</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#A78BFA' }}>96.5%</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>On-time Delivery & Quality Checks Passed</span>
        </div>
      </div>

      {/* Procurement Table */}
      <div className="os-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--os-text-muted)', textTransform: 'uppercase' }}>
            Hospital Procurement & Purchase Order Registry
          </span>
          <button
            type="button"
            className="os-action-btn-primary"
            style={{ fontSize: '0.72rem' }}
            onClick={() => alert('New purchase requisition initiated.')}
          >
            Create Purchase Requisition
          </button>
        </div>

        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>PO #</th>
                <th>Supplier / Vendor</th>
                <th>Description</th>
                <th>Amount (NGN)</th>
                <th>Order Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pos.map(po => (
                <tr key={po.id}>
                  <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.74rem', color: 'var(--ak-orange-light)', fontWeight: 700 }}>
                    {po.poNumber}
                  </td>
                  <td style={{ fontWeight: 700, color: '#0A2540' }}>{po.vendorName}</td>
                  <td>{po.itemSummary}</td>
                  <td style={{ fontWeight: 800, color: '#0A2540' }}>?{po.totalAmountNgn.toLocaleString()}</td>
                  <td style={{ fontSize: '0.76rem', color: 'var(--os-text-dim)' }}>{po.orderedAt}</td>
                  <td>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: po.deliveryStatus === 'received_inspected' ? 'rgba(5,150,105,0.1)' : 'rgba(234,88,12,0.15)',
                      color: po.deliveryStatus === 'received_inspected' ? '#34D399' : 'var(--ak-orange-light)',
                    }}>
                      {po.deliveryStatus.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
