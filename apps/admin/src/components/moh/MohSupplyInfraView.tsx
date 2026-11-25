'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  Package,
  Plus,
  Stethoscope,
  ThermometerSnowflake,
  Wrench,
} from 'lucide-react';
import type { MohLiveSnapshot, MohSupplyEquipmentItem } from '../../lib/mohTypes';
import { forecastStatewideDrugDemandAndExpiry } from '../../lib/mohSupplyForecastEngine';

interface MohSupplyInfraViewProps {
  snapshot: MohLiveSnapshot;
  officerName: string;
  onSaveSupplyEquipment: (input: {
    domain: MohSupplyEquipmentItem['domain'];
    facilityId: string;
    facilityName?: string;
    lga?: string;
    itemName: string;
    category?: string;
    quantity?: number;
    reorderLevel?: number;
    unit?: string;
    coldChainTempC?: number | null;
    functionalStatus?: MohSupplyEquipmentItem['functionalStatus'];
    notes?: string;
    updatedBy?: string;
  }) => Promise<void>;
  onUpdateSupplyEquipment: (input: {
    id: string;
    quantity?: number;
    coldChainTempC?: number | null;
    functionalStatus?: MohSupplyEquipmentItem['functionalStatus'];
    notes?: string;
    updatedBy?: string;
  }) => Promise<void>;
}

function statusTone(status: MohSupplyEquipmentItem['functionalStatus']): string {
  if (status === 'in_stock' || status === 'operational' || status === 'adequate') return 'emerald';
  if (status === 'stock_out' || status === 'out_of_service' || status === 'critical') return 'danger';
  return 'amber';
}

export const MohSupplyInfraView: React.FC<MohSupplyInfraViewProps> = ({
  snapshot,
  officerName,
  onSaveSupplyEquipment,
  onUpdateSupplyEquipment,
}) => {
  const [domainTab, setDomainTab] = useState<MohSupplyEquipmentItem['domain']>('medicine_vaccine');
  const [facilityFilter, setFacilityFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [facilityId, setFacilityId] = useState(snapshot.facilities[0]?.facilityId || 'IGH-EKT');
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState<number>(50);
  const [reorderLevel, setReorderLevel] = useState<number>(20);
  const [unit, setUnit] = useState('packs');
  const [coldChainTempC, setColdChainTempC] = useState<string>('');
  const [functionalStatus, setFunctionalStatus] =
    useState<MohSupplyEquipmentItem['functionalStatus']>('in_stock');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const { supplyChain, facilities } = snapshot;

  const coldChainAlerts = useMemo(
    () =>
      supplyChain.items.filter(
        (i) => i.coldChainTempC !== null && (i.coldChainTempC < 2 || i.coldChainTempC > 8)
      ).length,
    [supplyChain.items]
  );

  const drugForecast = useMemo(() => forecastStatewideDrugDemandAndExpiry(snapshot), [snapshot]);

  const domainItems = useMemo(
    () =>
      supplyChain.items.filter((i) => {
        if (i.domain !== domainTab) return false;
        if (facilityFilter !== 'all' && i.facilityId !== facilityFilter) return false;
        return true;
      }),
    [supplyChain.items, domainTab, facilityFilter]
  );

  const handleTabSwitch = (next: MohSupplyEquipmentItem['domain']) => {
    setDomainTab(next);
    setFormOpen(false);
    if (next === 'medicine_vaccine') {
      setFunctionalStatus('in_stock');
      setUnit('doses/packs');
    } else if (next === 'equipment') {
      setFunctionalStatus('operational');
      setUnit('units');
    } else {
      setFunctionalStatus('adequate');
      setUnit('system');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityId || !itemName.trim()) return;
    const fac = facilities.find((f) => f.facilityId === facilityId);
    setBusy(true);
    try {
      await onSaveSupplyEquipment({
        domain: domainTab,
        facilityId,
        facilityName: fac?.facilityName,
        lga: fac?.lga,
        itemName: itemName.trim(),
        category: category.trim() || undefined,
        quantity: Number(quantity || 0),
        reorderLevel: Number(reorderLevel || 0),
        unit: unit.trim() || 'units',
        coldChainTempC: coldChainTempC !== '' ? Number(coldChainTempC) : null,
        functionalStatus,
        notes: notes.trim(),
        updatedBy: officerName,
      });
      setItemName('');
      setCategory('');
      setColdChainTempC('');
      setNotes('');
      setFormOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="moh-view-header">
        <div>
          <h1 className="moh-view-title">Supply Chain, Cold-Chain &amp; Infrastructure</h1>
          <p className="moh-view-sub">
            Real-time essential medicines &amp; vaccines, major medical equipment audit, and facility WASH/power &amp; renovation status.
          </p>
        </div>
        <button type="button" className="moh-btn-primary" onClick={() => setFormOpen((v) => !v)}>
          <Plus size={15} />
          <span>
            {domainTab === 'medicine_vaccine'
              ? 'Log Medicine / Vaccine Stock'
              : domainTab === 'equipment'
              ? 'Log Medical Equipment'
              : 'Log Infrastructure Audit'}
          </span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="moh-kpi-grid">
        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Low Stock Items</div>
          <div className="moh-kpi-val" style={{ color: supplyChain.lowStockCount > 0 ? '#D97706' : '#0F172A' }}>
            {supplyChain.lowStockCount}
          </div>
          <div className="moh-kpi-sub">At or below reorder threshold</div>
        </div>
        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Critical Stock-Outs</div>
          <div className="moh-kpi-val" style={{ color: supplyChain.stockOutCount > 0 ? '#DC2626' : '#065F46' }}>
            {supplyChain.stockOutCount}
          </div>
          <div className="moh-kpi-sub">Zero balance commodities</div>
        </div>
        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Cold-Chain Temp Alerts</div>
          <div className="moh-kpi-val" style={{ color: coldChainAlerts > 0 ? '#DC2626' : '#065F46' }}>
            {coldChainAlerts}
          </div>
          <div className="moh-kpi-sub">Outside 2°C – 8°C safe band</div>
        </div>
        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Faulty Major Equipment</div>
          <div className="moh-kpi-val" style={{ color: supplyChain.faultyEquipmentCount > 0 ? '#DC2626' : '#065F46' }}>
            {supplyChain.faultyEquipmentCount}
          </div>
          <div className="moh-kpi-sub">Ultrasound, X-ray, O₂ plant, generators</div>
        </div>
        <div className="moh-kpi-card">
          <div className="moh-kpi-label">Ongoing Renovations</div>
          <div className="moh-kpi-val">{supplyChain.activeRenovationsCount}</div>
          <div className="moh-kpi-sub">Tracked civil &amp; WASH upgrades</div>
        </div>
      </div>

      {/* Predictive Drug Demand, Stockout & Near-Expiry Loss Prevention (Medicine Tab) */}
      {domainTab === 'medicine_vaccine' && (
        <div className="moh-panel" style={{ borderColor: '#BAE6FD', background: '#F8FAFC' }}>
          <div className="moh-panel-head" style={{ marginBottom: 10 }}>
            <h2 className="moh-panel-title" style={{ color: '#0369A1' }}>
              <Activity size={17} color="#0284C7" />
              Predictive Drug Demand, Stockout &amp; Near-Expiry Prevention ({drugForecast.seasonLabel})
            </h2>
            <span className="moh-pill emerald">
              Antimalarial ×{drugForecast.antimalarialMultiplier} · Antibiotic ×{drugForecast.antibioticMultiplier} · Antihypertensive ×{drugForecast.antihypertensiveMultiplier}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0F172A', marginBottom: 6 }}>
                Predicted Stockout Runway ({drugForecast.stockoutRisks.length})
              </div>
              {drugForecast.stockoutRisks.length === 0 ? (
                <div style={{ fontSize: '0.76rem', color: '#059669' }}>
                  All monitored AKS clinics hold &gt;14-day seasonal buffer stock across antimalarials, antihypertensives, and antibiotics.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {drugForecast.stockoutRisks.slice(0, 4).map((r) => (
                    <div key={r.id} style={{ fontSize: '0.75rem', padding: '6px 8px', borderRadius: 8, background: r.urgency === 'critical' ? '#FEF2F2' : '#FFFBEB', border: '1px solid #E2E8F0' }}>
                      <strong style={{ color: '#0F172A' }}>{r.itemName}</strong> · {r.facilityName} ({r.lga})
                      <div style={{ color: r.urgency === 'critical' ? '#B91C1C' : '#B45309', fontWeight: 700 }}>
                        {r.projectedDaysSupply}d runway · Dispatch {r.recommendedDispatchQty} {r.unit}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0F172A', marginBottom: 6 }}>
                Near-Expiry &amp; Cold-Chain Loss Alerts ({drugForecast.nearExpiryRisks.length})
              </div>
              {drugForecast.nearExpiryRisks.length === 0 ? (
                <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
                  Zero short-dated batches (&le;90d) or cold-chain excursions reported. Tag batch expiry dates in supply notes to monitor.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {drugForecast.nearExpiryRisks.slice(0, 4).map((ne) => (
                    <div key={ne.id} style={{ fontSize: '0.75rem', padding: '6px 8px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                      <strong>{ne.itemName}</strong> · {ne.facilityName}
                      <div style={{ color: '#991B1B', fontWeight: 700 }}>{ne.detail}</div>
                      <div style={{ color: '#334155', marginTop: 2 }}>{ne.recommendedAction}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0F172A', marginBottom: 6 }}>
                Inter-LGA Redistribution Suggestions ({drugForecast.redistributionPairs.length})
              </div>
              {drugForecast.redistributionPairs.length === 0 ? (
                <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
                  No cross-facility surplus-to-deficit transfers required currently.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {drugForecast.redistributionPairs.slice(0, 4).map((rp, idx) => (
                    <div key={idx} style={{ fontSize: '0.75rem', padding: '6px 8px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                      <strong>Transfer {rp.suggestedTransferQty} {rp.unit} {rp.itemName}</strong>
                      <div style={{ color: '#166534' }}>
                        {rp.fromLga} &rarr; {rp.toLga} ({rp.toFacilityName})
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tabs + Facility Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={domainTab === 'medicine_vaccine' ? 'moh-btn-primary' : 'moh-btn-outline'}
            onClick={() => handleTabSwitch('medicine_vaccine')}
          >
            <Package size={14} />
            <span>Essential Medicines &amp; Vaccines ({supplyChain.items.filter((i) => i.domain === 'medicine_vaccine').length})</span>
          </button>
          <button
            type="button"
            className={domainTab === 'equipment' ? 'moh-btn-primary' : 'moh-btn-outline'}
            onClick={() => handleTabSwitch('equipment')}
          >
            <Stethoscope size={14} />
            <span>Medical Equipment Audit ({supplyChain.items.filter((i) => i.domain === 'equipment').length})</span>
          </button>
          <button
            type="button"
            className={domainTab === 'infrastructure' ? 'moh-btn-primary' : 'moh-btn-outline'}
            onClick={() => handleTabSwitch('infrastructure')}
          >
            <Wrench size={14} />
            <span>Facility Infrastructure ({supplyChain.items.filter((i) => i.domain === 'infrastructure').length})</span>
          </button>
        </div>

        <select
          className="moh-select"
          value={facilityFilter}
          onChange={(e) => setFacilityFilter(e.target.value)}
          aria-label="Filter supply records by facility"
        >
          <option value="all">All Facilities</option>
          {facilities.map((f) => (
            <option key={f.facilityId} value={f.facilityId}>
              {f.facilityName}
            </option>
          ))}
        </select>
      </div>

      {/* Add Form */}
      {formOpen && (
        <form onSubmit={handleSubmit} className="moh-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#0F172A' }}>
            {domainTab === 'medicine_vaccine'
              ? 'Record Essential Medicine / Vaccine Stock'
              : domainTab === 'equipment'
              ? 'Record Major Medical Equipment Status'
              : 'Record Facility Infrastructure / Renovation / WASH Audit'}
          </div>

          <div className="moh-two-col">
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Facility *
              <select className="moh-input" style={{ marginTop: 4 }} value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
                {facilities.map((f) => (
                  <option key={f.facilityId} value={f.facilityId}>
                    {f.facilityName} ({f.lga})
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              {domainTab === 'medicine_vaccine'
                ? 'Drug / Vaccine Name *'
                : domainTab === 'equipment'
                ? 'Equipment Asset Name *'
                : 'Infrastructure System / Project *'}
              <input
                className="moh-input"
                style={{ marginTop: 4 }}
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder={
                  domainTab === 'medicine_vaccine'
                    ? 'e.g. Artemether-Lumefantrine / Penta Vaccine'
                    : domainTab === 'equipment'
                    ? 'e.g. Ultrasound Scanner / 150kVA Generator / Oxygen Plant'
                    : 'e.g. Borehole & WASH / Solar Grid / Maternity Ward Renovation'
                }
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Category
              <input
                className="moh-input"
                style={{ marginTop: 4 }}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={
                  domainTab === 'medicine_vaccine'
                    ? 'Anti-Malarial / ARV / Vaccine'
                    : domainTab === 'equipment'
                    ? 'Imaging / Oxygen / Ambulance'
                    : 'WASH / Power / Renovation'
                }
              />
            </label>

            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Quantity
              <input
                type="number"
                className="moh-input"
                style={{ marginTop: 4 }}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>

            {domainTab === 'medicine_vaccine' && (
              <>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Reorder Threshold
                  <input
                    type="number"
                    className="moh-input"
                    style={{ marginTop: 4 }}
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(Number(e.target.value))}
                  />
                </label>
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Cold-Chain Temp (°C)
                  <input
                    type="number"
                    step="0.1"
                    className="moh-input"
                    style={{ marginTop: 4 }}
                    value={coldChainTempC}
                    onChange={(e) => setColdChainTempC(e.target.value)}
                    placeholder="e.g. 4.2"
                  />
                </label>
              </>
            )}

            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              Status
              <select
                className="moh-input"
                style={{ marginTop: 4 }}
                value={functionalStatus}
                onChange={(e) => setFunctionalStatus(e.target.value as MohSupplyEquipmentItem['functionalStatus'])}
              >
                {domainTab === 'medicine_vaccine' ? (
                  <>
                    <option value="in_stock">In Stock</option>
                    <option value="low_stock">Low Stock</option>
                    <option value="stock_out">Stock-Out</option>
                  </>
                ) : domainTab === 'equipment' ? (
                  <>
                    <option value="operational">Operational</option>
                    <option value="faulty">Faulty (Needs Repair)</option>
                    <option value="out_of_service">Out of Service</option>
                  </>
                ) : (
                  <>
                    <option value="adequate">Adequate</option>
                    <option value="intermittent">Intermittent Power / Water</option>
                    <option value="ongoing_renovation">Ongoing Renovation</option>
                    <option value="critical">Critical Defect</option>
                  </>
                )}
              </select>
            </label>
          </div>

          <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
            Inspection / Logistics Notes
            <input
              className="moh-input"
              style={{ marginTop: 4 }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Batch number, contractor milestone, or repair requisition..."
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="moh-btn-outline" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="moh-btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save Record'}
            </button>
          </div>
        </form>
      )}

      {/* Records Table */}
      <div className="moh-panel">
        <div className="moh-panel-head">
          <h2 className="moh-panel-title">
            <Building2 size={17} color="#065F46" />
            <span>
              {domainTab === 'medicine_vaccine'
                ? 'Essential Medicines, ARVs & Cold-Chain Vaccine Registry'
                : domainTab === 'equipment'
                ? 'Major Medical Equipment & Ambulance Audit'
                : 'Power, WASH & Renovation Tracker'}
            </span>
          </h2>
          <span className="moh-pill slate">{domainItems.length} record(s)</span>
        </div>

        <div className="moh-table-wrap">
          <table className="moh-table">
            <thead>
              <tr>
                <th>Facility &amp; LGA</th>
                <th>Item / Asset</th>
                <th>Category</th>
                <th>Qty / Reorder</th>
                {domainTab === 'medicine_vaccine' && <th>Cold-Chain</th>}
                <th>Status</th>
                <th>Quick Action</th>
              </tr>
            </thead>
            <tbody>
              {domainItems.map((item) => {
                const tempAlert =
                  item.coldChainTempC !== null && (item.coldChainTempC < 2 || item.coldChainTempC > 8);
                return (
                  <tr key={item.id}>
                    <td>
                      <strong style={{ color: '#0F172A' }}>{item.facilityName}</strong>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                        {item.lga} · <code style={{ color: '#065F46' }}>{item.facilityId}</code>
                      </div>
                    </td>
                    <td>
                      <strong>{item.itemName}</strong>
                      {item.notes && <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{item.notes}</div>}
                    </td>
                    <td>{item.category}</td>
                    <td>
                      <strong>{item.quantity}</strong> {item.unit}
                      {item.reorderLevel > 0 && (
                        <div style={{ fontSize: '0.71rem', color: '#64748B' }}>Min: {item.reorderLevel}</div>
                      )}
                    </td>
                    {domainTab === 'medicine_vaccine' && (
                      <td>
                        {item.coldChainTempC !== null ? (
                          <span className={`moh-pill ${tempAlert ? 'danger' : 'emerald'}`}>
                            <ThermometerSnowflake size={12} /> {item.coldChainTempC}°C
                          </span>
                        ) : (
                          'Ambient'
                        )}
                      </td>
                    )}
                    <td>
                      <span className={`moh-pill ${statusTone(item.functionalStatus)}`}>
                        {item.functionalStatus.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {domainTab === 'medicine_vaccine' && item.functionalStatus !== 'in_stock' && (
                          <button
                            type="button"
                            className="moh-btn-outline"
                            style={{ padding: '4px 9px', fontSize: '0.73rem' }}
                            onClick={() =>
                              void onUpdateSupplyEquipment({
                                id: item.id,
                                quantity: Math.max(item.quantity + 50, item.reorderLevel + 25),
                                functionalStatus: 'in_stock',
                                updatedBy: officerName,
                              })
                            }
                          >
                            Restock
                          </button>
                        )}
                        {domainTab === 'equipment' && (
                          <button
                            type="button"
                            className="moh-btn-outline"
                            style={{ padding: '4px 9px', fontSize: '0.73rem' }}
                            onClick={() =>
                              void onUpdateSupplyEquipment({
                                id: item.id,
                                functionalStatus: item.functionalStatus === 'operational' ? 'faulty' : 'operational',
                                updatedBy: officerName,
                              })
                            }
                          >
                            {item.functionalStatus === 'operational' ? (
                              <>
                                <AlertTriangle size={12} /> Flag Faulty
                              </>
                            ) : (
                              <>
                                <Activity size={12} /> Mark Restored
                              </>
                            )}
                          </button>
                        )}
                        {domainTab === 'infrastructure' && item.functionalStatus !== 'adequate' && (
                          <button
                            type="button"
                            className="moh-btn-outline"
                            style={{ padding: '4px 9px', fontSize: '0.73rem' }}
                            onClick={() =>
                              void onUpdateSupplyEquipment({
                                id: item.id,
                                functionalStatus: 'adequate',
                                updatedBy: officerName,
                              })
                            }
                          >
                            Mark Completed
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {domainItems.length === 0 && (
                <tr>
                  <td colSpan={domainTab === 'medicine_vaccine' ? 7 : 6} style={{ textAlign: 'center', padding: 28, color: '#64748B' }}>
                    No records logged for this category yet. Click the button above to record facility stock, equipment, or infrastructure state.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
