'use client';

import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ArrowRightLeft, 
  CalendarDays, 
  Building2, 
  Activity, 
  Bed, 
  GitFork, 
  Truck, 
  Lock, 
  Building, 
  ShieldCheck, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown
} from 'lucide-react';

export type HospitalAdminTab = 
  | 'dashboard'
  | 'transfers'
  | 'staffing'
  | 'hospital-management'
  | 'command-centre'
  | 'bed-occupancy'
  | 'patient-flow'
  | 'ambulance'
  | 'access-control'
  | 'facilities'
  | 'compliance';

interface HospitalAdminSidebarProps {
  activeTab: HospitalAdminTab;
  onTabChange: (tab: HospitalAdminTab) => void;
  currentFacility?: string;
  onOpenProfile?: () => void;
}

export const HospitalAdminSidebar: React.FC<HospitalAdminSidebarProps> = ({
  activeTab,
  onTabChange,
  currentFacility = 'Immanuel General Hospital, Eket',
  onOpenProfile,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`ha-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Brand Header */}
      <div className="ha-sidebar-header">
        <div className="ha-logo-group">
          <div className="ha-logo-icon">M</div>
          {!isCollapsed && (
            <div className="ha-logo-text-wrap">
              <span className="ha-logo-title">MedCore</span>
              <span className="ha-logo-tag">ADMINISTRATOR</span>
            </div>
          )}
        </div>
        <button
          type="button"
          className="ha-collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav Menu */}
      <div className="ha-sidebar-nav">
        {/* Core Administrative Section */}
        <div className="ha-nav-group">
          <button
            type="button"
            className={`ha-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => onTabChange('dashboard')}
            title="Dashboard"
          >
            <LayoutDashboard size={18} className="ha-nav-item-icon" />
            {!isCollapsed && <span className="ha-nav-item-label">Dashboard</span>}
          </button>

          <button
            type="button"
            className={`ha-nav-item ${activeTab === 'transfers' ? 'active' : ''}`}
            onClick={() => onTabChange('transfers')}
            title="Hospital Staff Transfer"
          >
            <ArrowRightLeft size={18} className="ha-nav-item-icon" />
            {!isCollapsed && (
              <>
                <span className="ha-nav-item-label">Hospital Staff Transfer</span>
                <span className="ha-nav-item-badge">1</span>
              </>
            )}
          </button>

          <button
            type="button"
            className={`ha-nav-item ${activeTab === 'staffing' ? 'active' : ''}`}
            onClick={() => onTabChange('staffing')}
            title="Staffing & Rosters"
          >
            <CalendarDays size={18} className="ha-nav-item-icon" />
            {!isCollapsed && <span className="ha-nav-item-label">Staffing & Rosters</span>}
          </button>

          <button
            type="button"
            className={`ha-nav-item ${activeTab === 'hospital-management' ? 'active' : ''}`}
            onClick={() => onTabChange('hospital-management')}
            title="Hospital Management"
          >
            <Building2 size={18} className="ha-nav-item-icon" />
            {!isCollapsed && <span className="ha-nav-item-label">Hospital Management</span>}
          </button>
        </div>

        {/* OPERATIONS & BED MANAGEMENT */}
        <div className="ha-nav-group">
          {!isCollapsed && (
            <div className="ha-nav-section-title">OPERATIONS & BED MANAGEMENT</div>
          )}

          <button
            type="button"
            className={`ha-nav-item ${activeTab === 'command-centre' ? 'active' : ''}`}
            onClick={() => onTabChange('command-centre')}
            title="Hospital Command Centre"
          >
            <Activity size={18} className="ha-nav-item-icon" />
            {!isCollapsed && <span className="ha-nav-item-label">Hospital Command Centre</span>}
          </button>

          <button
            type="button"
            className={`ha-nav-item ${activeTab === 'bed-occupancy' ? 'active' : ''}`}
            onClick={() => onTabChange('bed-occupancy')}
            title="Bed & Ward Occupancy"
          >
            <Bed size={18} className="ha-nav-item-icon" />
            {!isCollapsed && <span className="ha-nav-item-label">Bed & Ward Occupancy</span>}
          </button>

          <button
            type="button"
            className={`ha-nav-item ${activeTab === 'patient-flow' ? 'active' : ''}`}
            onClick={() => onTabChange('patient-flow')}
            title="Patient Flow Visibility"
          >
            <GitFork size={18} className="ha-nav-item-icon" />
            {!isCollapsed && <span className="ha-nav-item-label">Patient Flow Visibility</span>}
          </button>

          <button
            type="button"
            className={`ha-nav-item ${activeTab === 'ambulance' ? 'active' : ''}`}
            onClick={() => onTabChange('ambulance')}
            title="Ambulance & Dispatch"
          >
            <Truck size={18} className="ha-nav-item-icon" />
            {!isCollapsed && <span className="ha-nav-item-label">Ambulance & Dispatch</span>}
          </button>
        </div>

        {/* IDENTITY, SECURITY & FINANCE */}
        <div className="ha-nav-group">
          {!isCollapsed && (
            <div className="ha-nav-section-title">IDENTITY, SECURITY & FINANCE</div>
          )}

          <button
            type="button"
            className={`ha-nav-item ${activeTab === 'access-control' ? 'active' : ''}`}
            onClick={() => onTabChange('access-control')}
            title="Staff Access Control"
          >
            <Lock size={18} className="ha-nav-item-icon" />
            {!isCollapsed && (
              <>
                <span className="ha-nav-item-label">Staff Access Control</span>
                <span className="ha-nav-item-badge" style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#EF4444' }}>3</span>
              </>
            )}
          </button>

          <button
            type="button"
            className={`ha-nav-item ${activeTab === 'facilities' ? 'active' : ''}`}
            onClick={() => onTabChange('facilities')}
            title="Hospital Facilities"
          >
            <Building size={18} className="ha-nav-item-icon" />
            {!isCollapsed && <span className="ha-nav-item-label">Hospital Facilities</span>}
          </button>

          <button
            type="button"
            className={`ha-nav-item ${activeTab === 'compliance' ? 'active' : ''}`}
            onClick={() => onTabChange('compliance')}
            title="Compliance & Audit"
          >
            <ShieldCheck size={18} className="ha-nav-item-icon" />
            {!isCollapsed && <span className="ha-nav-item-label">Compliance & Audit</span>}
          </button>
        </div>
      </div>

      {/* Footer Profile Card */}
      <div className="ha-sidebar-footer">
        <button
          type="button"
          className="ha-profile-card"
          onClick={onOpenProfile}
          title="Account profile"
        >
          <div className="ha-profile-avatar">HA</div>
          {!isCollapsed && (
            <>
              <div className="ha-profile-meta">
                <div className="ha-profile-name">Hospital Administrator</div>
                <div className="ha-profile-sub">{currentFacility}</div>
              </div>
              <ChevronRight size={16} color="#64748B" />
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
