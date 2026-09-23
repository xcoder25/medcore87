'use client';

import React, { useState } from 'react';
import {
  Package, AlertTriangle, CheckCircle2, Search, ArrowRight,
  TrendingDown, ShoppingCart, RefreshCw, Layers
} from 'lucide-react';
import type { InventoryItem } from '@medcore/types';

const INITIAL_INVENTORY: InventoryItem[] = [
  { id: 'INV-01', sku: 'CMS-SURG-GLV-75', itemName: 'Sterile Surgical Gloves (Size 7.5)', category: 'Surgical Consumables', stockOnHand: 450, reorderPoint: 500, unitCostNgn: 450, supplier: 'MedEquip West Africa Ltd', leadTimeDays: 3 },
  { id: 'INV-02', sku: 'CMS-IV-CANN-18', itemName: 'IV Cannula with Injection Port 18G Green', category: 'Surgical Consumables', stockOnHand: 1800, reorderPoint: 800, unitCostNgn: 220, supplier: 'B. Braun Medical Nigeria', leadTimeDays: 4 },
  { id: 'INV-03', sku: 'CMS-PPE-N95', itemName: 'N95 Particulate Respirator Masks (Box of 20)', category: 'PPE & Linen', stockOnHand: 85, reorderPoint: 150, unitCostNgn: 6500, supplier: '3M Nigeria Healthcare', leadTimeDays: 7 },
  { id: 'INV-04', sku: 'CMS-DRUG-ARTESUN', itemName: 'Artesunate 60mg Powder for Injection', category: 'Pharmaceuticals', stockOnHand: 920, reorderPoint: 400, unitCostNgn: 1400, supplier: 'Emzor Pharmaceuticals', leadTimeDays: 2 },
  { id: 'INV-05', sku: 'CMS-LAB-REAG-CBC', itemName: 'Sysmex Cellpack DCL Diluent (20L)', category: 'Lab Reagents', stockOnHand: 6, reorderPoint: 10, unitCostNgn: 48000, supplier: 'Sysmex West Africa', leadTimeDays: 5 },
];

export const SupplyChainInventorySuite: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [search, setSearch] = useState('');

  const reorderCount = items.filter(i => i.stockOnHand <= i.reorderPoint).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="os-card" style={{ borderLeft: '4px solid var(--ak-orange)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Central Medical Store SKUs</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ak-orange-light)' }}>2,840</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>Managed SKUs</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Value: ?184,200,000</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>SKUs Below Reorder Point</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>{reorderCount} Items</span>
            <span style={{ fontSize: '0.75rem', color: '#F87171' }}>PO Required</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Automated Vendor Restock Trigger</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Ward Requisitions Filled</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>98.8%</span>
            <span style={{ fontSize: '0.75rem', color: '#34D399' }}>Fill Rate</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>Zero Clinical Ward Stockouts</span>
        </div>

        <div className="os-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--os-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Active Purchase Orders</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>12 In Transit</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--os-text-dim)' }}>Delivery &lt; 48h</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--os-text-dim)' }}>GS1 Barcode Scanned at Receiving</span>
        </div>
      </div>

      {/* Main Inventory Table */}
      <div className="os-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--os-text-muted)', textTransform: 'uppercase' }}>
            Central Medical Store Master Inventory
          </span>
          <div className="os-search-wrap">
            <Search size={14} />
            <input
              className="os-search-input"
              placeholder="Search items, SKU, category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="os-table-wrap">
          <table className="os-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item Name</th>
                <th>Category</th>
                <th>Stock on Hand</th>
                <th>Reorder Point</th>
                <th>Unit Cost</th>
                <th>Supplier</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const isLow = item.stockOnHand <= item.reorderPoint;
                return (
                  <tr key={item.id}>
                    <td style={{ fontFamily: 'var(--os-font-mono)', fontSize: '0.72rem', color: 'var(--os-text-dim)' }}>{item.sku}</td>
                    <td style={{ fontWeight: 700, color: '#0A2540' }}>{item.itemName}</td>
                    <td>{item.category}</td>
                    <td style={{ fontWeight: 800, color: isLow ? '#EF4444' : '#34D399' }}>{item.stockOnHand.toLocaleString()}</td>
                    <td>{item.reorderPoint.toLocaleString()}</td>
                    <td style={{ fontWeight: 600 }}>?{item.unitCostNgn.toLocaleString()}</td>
                    <td style={{ fontSize: '0.76rem', color: 'var(--os-text-dim)' }}>{item.supplier}</td>
                    <td>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: isLow ? 'rgba(239,68,68,0.15)' : 'rgba(5,150,105,0.1)',
                        color: isLow ? '#F87171' : '#34D399',
                      }}>
                        {isLow ? 'REORDER NOW' : 'OPTIMAL'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
