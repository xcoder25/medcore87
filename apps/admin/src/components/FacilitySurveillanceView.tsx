'use client';

import React, { useState, useMemo } from 'react';
import type { RegionalFacilityOverview, FacilityTier } from '@medcore/types';
import { 
  Search, 
  Filter, 
  Building2, 
  Bed, 
  Activity, 
  SlidersHorizontal, 
  ArrowUpDown, 
  Radio, 
  ShieldCheck, 
  ChevronRight,
  Download
} from 'lucide-react';

interface FacilitySurveillanceViewProps {
  facilities: RegionalFacilityOverview[];
  onSelectFacility: (facility: RegionalFacilityOverview) => void;
  selectedRegion: string;
}

export const FacilitySurveillanceView: React.FC<FacilitySurveillanceViewProps> = ({
  facilities,
  onSelectFacility,
  selectedRegion,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'beds' | 'occupancy' | 'compliance'>('occupancy');

  const filteredFacilities = useMemo(() => {
    return facilities.filter((fac) => {
      // Region filter
      if (selectedRegion !== 'All National Jurisdictions' && fac.region !== selectedRegion) {
        return false;
      }
      // Tier filter
      if (selectedTier !== 'all' && fac.tier !== selectedTier) {
        return false;
      }
      // Status filter
      if (selectedStatus !== 'all' && fac.emergencyStatus !== selectedStatus) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          fac.facilityName.toLowerCase().includes(q) ||
          fac.licenseNumber.toLowerCase().includes(q) ||
          fac.region.toLowerCase().includes(q)
        );
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') return a.facilityName.localeCompare(b.facilityName);
      if (sortBy === 'beds') return b.totalBeds - a.totalBeds;
      if (sortBy === 'occupancy') {
        const occA = a.occupiedBeds / a.totalBeds;
        const occB = b.occupiedBeds / b.totalBeds;
        return occB - occA;
      }
      if (sortBy === 'compliance') return b.complianceScore - a.complianceScore;
      return 0;
    });
  }, [facilities, selectedRegion, selectedTier, selectedStatus, searchQuery, sortBy]);

  const totalFilteredBeds = filteredFacilities.reduce((sum, f) => sum + f.totalBeds, 0);
  const totalFilteredOcc = filteredFacilities.reduce((sum, f) => sum + f.occupiedBeds, 0);
  const avgFilteredOccPercent = totalFilteredBeds > 0 
    ? Math.round((totalFilteredOcc / totalFilteredBeds) * 100) 
    : 0;

  return (
    <div className="moh-facilities-view">
      {/* Control Bar: Search & Dynamic Filters */}
      <div className="moh-control-card">
        <div className="search-bar-row">
          <div className="search-input-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search facilities by name, license number, or municipality..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button 
                type="button" 
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                Clear
              </button>
            )}
          </div>

          <div className="export-action-group">
            <button 
              type="button" 
              className="action-btn-secondary"
              onClick={() => alert('Exporting facility surveillance dataset to CSV/XLSX...')}
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="filter-pills-row">
          <div className="filter-group">
            <span className="filter-label"><Filter size={13} /> Facility Tier:</span>
            <div className="pill-options">
              {[
                { id: 'all', label: 'All Tiers' },
                { id: 'national_referral', label: 'National Referral' },
                { id: 'regional_general', label: 'Regional General' },
                { id: 'specialized_center', label: 'Specialized Centers' },
                { id: 'district_hospital', label: 'District Hospitals' },
              ].map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  className={`filter-pill ${selectedTier === tier.id ? 'active' : ''}`}
                  onClick={() => setSelectedTier(tier.id)}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label"><SlidersHorizontal size={13} /> Emergency Status:</span>
            <div className="pill-options">
              {[
                { id: 'all', label: 'All Statuses' },
                { id: 'normal', label: 'Normal' },
                { id: 'surge_code_yellow', label: 'Surge Yellow' },
                { id: 'critical_code_red', label: 'Critical Red' },
                { id: 'diversion', label: 'Ambulance Diversion' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  className={`filter-pill ${selectedStatus === st.id ? 'active' : ''}`}
                  onClick={() => setSelectedStatus(st.id)}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate Strip for Current Filter */}
      <div className="filter-summary-strip">
        <div className="summary-stat">
          <span className="summary-stat-label">Matching Facilities</span>
          <span className="summary-stat-val">{filteredFacilities.length} of {facilities.length}</span>
        </div>
        <div className="summary-stat">
          <span className="summary-stat-label">Aggregated Bed Load</span>
          <span className="summary-stat-val">
            {totalFilteredOcc.toLocaleString()} / {totalFilteredBeds.toLocaleString()} ({avgFilteredOccPercent}%)
          </span>
        </div>
        <div className="summary-stat">
          <span className="summary-stat-label">Telemetry Heartbeat</span>
          <span className="summary-stat-val text-good">● 100% Streaming live</span>
        </div>
        <div className="summary-stat sort-dropdown-group">
          <span className="summary-stat-label"><ArrowUpDown size={12} /> Sort By:</span>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
            className="mini-sort-select"
          >
            <option value="occupancy">Highest Occupancy %</option>
            <option value="beds">Bed Capacity (Desc)</option>
            <option value="compliance">Compliance Score</option>
            <option value="name">Facility Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Primary Facility Data Table */}
      <div className="moh-panel no-padding">
        <div className="table-responsive">
          <table className="moh-data-table full-width">
            <thead>
              <tr>
                <th>Facility & License</th>
                <th>Tier & Jurisdiction</th>
                <th>Total Bed Occupancy</th>
                <th>ICU / Critical</th>
                <th>Ventilators</th>
                <th>Staff On Duty</th>
                <th>Compliance</th>
                <th>Surge Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFacilities.map((fac) => {
                const bedPercent = Math.round((fac.occupiedBeds / fac.totalBeds) * 100);
                const icuPercent = Math.round((fac.icuBedsOccupied / fac.icuBedsTotal) * 100);

                return (
                  <tr 
                    key={fac.facilityId} 
                    className="clickable-row"
                    onClick={() => onSelectFacility(fac)}
                  >
                    <td>
                      <div className="fac-name-block">
                        <strong>{fac.facilityName}</strong>
                        <div className="table-sub-detail">{fac.licenseNumber}</div>
                      </div>
                    </td>
                    <td>
                      <div className="tier-tag-pill">{fac.tier.replace(/_/g, ' ')}</div>
                      <div className="table-sub-detail">{fac.region}</div>
                    </td>
                    <td>
                      <div className="occupancy-gauge-cell">
                        <div className="occ-text-row">
                          <span>{fac.occupiedBeds} / {fac.totalBeds}</span>
                          <strong className={bedPercent > 90 ? 'text-red' : bedPercent > 80 ? 'text-amber' : 'text-good'}>
                            {bedPercent}%
                          </strong>
                        </div>
                        <div className="progress-bar-track small">
                          <div 
                            className={`progress-bar-fill ${bedPercent > 90 ? 'critical' : bedPercent > 80 ? 'warning' : 'optimal'}`}
                            style={{ width: `${Math.min(bedPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="occupancy-gauge-cell">
                        <div className="occ-text-row">
                          <span>{fac.icuBedsOccupied} / {fac.icuBedsTotal}</span>
                          <strong className={icuPercent > 85 ? 'text-red' : 'text-good'}>
                            {icuPercent}%
                          </strong>
                        </div>
                        <div className="progress-bar-track small">
                          <div 
                            className={`progress-bar-fill ${icuPercent > 85 ? 'critical' : 'optimal'}`}
                            style={{ width: `${Math.min(icuPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="vent-counter">
                        <strong>{fac.ventilatorsAvailable}</strong> Standby
                      </span>
                    </td>
                    <td>
                      <div className="staff-count-cell">
                        <span>{fac.staffOnDuty} Clinical</span>
                      </div>
                    </td>
                    <td>
                      <div className="compliance-cell">
                        <span className={`score-chip ${fac.complianceScore >= 95 ? 'score-high' : 'score-med'}`}>
                          {fac.complianceScore}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${fac.emergencyStatus}`}>
                        {fac.emergencyStatus.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <button 
                        type="button" 
                        className="inspect-btn-pill"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectFacility(fac);
                        }}
                      >
                        <span>Telemetry</span>
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredFacilities.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-table-cell">
                    No hospital facilities found matching the specified filters. Try resetting the tier or search query.
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
