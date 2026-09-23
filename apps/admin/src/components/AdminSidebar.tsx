'use client';

import React from 'react';
import { 
  Home,
  Activity, 
  CreditCard, 
  Building2, 
  Radio, 
  FileCheck2, 
  Users2, 
  Scale, 
  Bot, 
  ShieldCheck, 
  MapPin, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import type { AdminTab } from './AdminHeader';

export type ExtendedAdminTab = 
  | AdminTab 
  | 'vital-stats' 
  | 'financial' 
  | 'security';

interface AdminSidebarProps {
  activeTab: ExtendedAdminTab;
  onTabChange: (tab: ExtendedAdminTab) => void;
  selectedRegion: string;
  onRegionChange: (region: string) => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onTabChange,
  selectedRegion,
  onRegionChange,
}) => {
  const navItems = [
    { id: 'hud', label: 'Command Centre', icon: Home },
    { id: 'vital-stats', label: 'Vital Statistics & Mortality', icon: Activity },
    { id: 'financial', label: 'Financial & Revenue', icon: CreditCard },
    { id: 'facilities', label: 'Facility Surveillance', icon: Building2 },
    { id: 'epidemiology', label: 'Epidemiological Surveillance', icon: Radio },
    { id: 'licensing', label: 'Licensing & Accreditation', icon: FileCheck2 },
    { id: 'workforce', label: 'Workforce Surveillance', icon: Users2 },
    { id: 'directives', label: 'Regulatory Directives', icon: Scale },
    { id: 'ai', label: 'Health AI Assistant', icon: Bot, badge: 'AI' },
    { id: 'security', label: 'Security & Audit Ledger', icon: ShieldCheck },
  ];

  const regions = [
    'Uyo Region',
    'Eket Region',
    'Ikot Ekpene Region',
    'Oruk Anam Region',
    'Other Regions',
  ];

  return (
    <aside className="dash-sidebar">
      {/* Primary Module Navigation */}
      <div className="dash-sidebar-nav-section">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`dash-sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(item.id as ExtendedAdminTab)}
            >
              <Icon size={16} className="dash-item-icon" />
              <span className="dash-item-label">{item.label}</span>
              {item.badge && (
                <span className="dash-item-badge">{item.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Regional Views Header & List */}
      <div className="dash-sidebar-regions-section">
        <div className="dash-sidebar-section-title">REGIONAL VIEWS</div>
        {regions.map((region) => {
          const isSelected = selectedRegion === region;
          return (
            <button
              key={region}
              type="button"
              className={`dash-region-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onRegionChange(region)}
            >
              <MapPin size={14} className="dash-region-icon" />
              <span>{region}</span>
            </button>
          );
        })}
      </div>

      {/* Akwa Ibom State Map Graphic Widget */}
      <div className="dash-sidebar-map-widget">
        <div className="dash-map-svg-wrap">
          {/* Akwa Ibom stylized outline */}
          <svg viewBox="0 0 100 90" className="dash-map-outline-svg">
            <path
              d="M 35 15 C 45 10, 60 12, 70 20 C 78 28, 85 45, 80 60 C 75 75, 60 85, 45 82 C 30 80, 18 70, 20 50 C 22 35, 25 20, 35 15 Z"
              fill="rgba(16, 185, 129, 0.08)"
              stroke="#10B981"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
            {/* Regional Pin Dots */}
            <circle cx="48" cy="36" r="3" fill="#10B981" />
            <circle cx="62" cy="52" r="3" fill="#F59E0B" />
            <circle cx="34" cy="56" r="3" fill="#EF4444" />
          </svg>
        </div>
        <div className="dash-map-info">
          <div className="dash-map-title">Akwa Ibom State</div>
          <div className="dash-map-status">
            <span className="dash-map-dot" />
            <span>Health System Connected</span>
          </div>
        </div>
      </div>

      {/* Footer System Credits */}
      <div className="dash-sidebar-footer">
        <div className="dash-ver-text">MedCore v2.7.0 &bull; Ministry of Health, Akwa Ibom State</div>
        <div className="dash-sec-text">Secure &bull; Encrypted &bull; Compliant</div>
      </div>
    </aside>
  );
};
