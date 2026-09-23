'use client';

import React from 'react';
import Image from 'next/image';
import { 
  Search, 
  Bell, 
  Lock, 
  LogOut, 
  ChevronDown, 
  ShieldCheck, 
  Radio
} from 'lucide-react';
import type { MOHOfficerSession } from './MOHAuthScreen';

interface AdminTopBarProps {
  officerSession?: MOHOfficerSession | null;
  onLockScreen?: () => void;
  onLogout?: () => void;
  onSearch?: (query: string) => void;
  onShowAlerts?: () => void;
  alertCount?: number;
  liveClock?: string;
}

export const AdminTopBar: React.FC<AdminTopBarProps> = ({
  officerSession,
  onLockScreen,
  onLogout,
  onSearch,
  onShowAlerts,
  alertCount = 0,
  liveClock,
}) => {
  return (
    <header className="dash-top-bar">
      {/* Left: Official Akwa Ibom Crest + ARISE Logo + Title Block */}
      <div className="dash-top-left">
        <div className="dash-crest-block">
          <div className="dash-seal-img-wrap" title="Government of Akwa Ibom State">
            <Image 
              src="/ibmlogo.png" 
              alt="Government of Akwa Ibom State Official Crest" 
              width={46} 
              height={46} 
              className="dash-seal-img" 
              priority
            />
          </div>
          <div className="dash-crest-text">
            <span className="dash-crest-gov">GOVERNMENT OF</span>
            <span className="dash-crest-state">AKWA IBOM STATE</span>
            <span className="dash-crest-sub">MINISTRY OF HEALTH</span>
          </div>
        </div>

        <div className="dash-arise-brand" title="ARISE Agenda - Akwa Ibom State">
          <Image 
            src="/arise-logo.png" 
            alt="ARISE Agenda Logo" 
            width={74} 
            height={34} 
            className="dash-arise-img" 
            priority
          />
        </div>

        <div className="dash-title-divider" />

        <div className="dash-portal-title">
          <div className="dash-portal-name">
            <span className="dash-brand-med">MedCore </span>
            <span className="dash-brand-admin">Admin</span>
            <span className="dash-portal-badge">HQ COMMAND</span>
          </div>
          <div className="dash-portal-sub">National Health Command & Regulatory Oversight</div>
          <div className="dash-portal-motto">Healthier People &bull; Stronger Communities &bull; A Greater Akwa Ibom</div>
        </div>
      </div>

      {/* Center: Search Bar with Ctrl+K */}
      <div className="dash-top-center">
        <div className="dash-search-box">
          <Search size={15} className="dash-search-icon" />
          <input 
            type="text" 
            placeholder="Search hospitals, regions, alerts, or patient records..." 
            className="dash-search-input"
            onChange={(e) => onSearch && onSearch(e.target.value)}
          />
          <kbd className="dash-search-kbd">Ctrl + K</kbd>
        </div>
      </div>

      {/* Right: Notifications, Settings, Profile, Telemetry & Session Actions */}
      <div className="dash-top-right">
        {/* Notification Bell */}
        <button 
          type="button" 
          className="dash-icon-btn dash-bell-btn" 
          title="Active Regulatory Alerts"
          onClick={() => onShowAlerts?.()}
        >
          <Bell size={17} />
          <span className="dash-bell-badge">{alertCount || 0}</span>
        </button>

        {/* Commissioner Profile Chip */}
        <div className="dash-profile-chip">
          <div className="dash-avatar-circle">
            <span className="dash-avatar-initials">EU</span>
          </div>
          <div className="dash-profile-info">
            <div className="dash-profile-name">
              {officerSession?.name || 'Hon. Dr. Emmanuel Udoh'}
            </div>
            <div className="dash-profile-role">
              {officerSession?.role || 'Commissioner of Health'}
            </div>
          </div>
        </div>

        {/* Date / Time & System Online Badge */}
        <div className="dash-system-status-block">
          <div className="dash-date-string">{liveClock || new Date().toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          <div className="dash-online-pill">
            <span className="dash-online-dot" />
            <span>System Online</span>
          </div>
        </div>

        {/* Action icons: Lock / Logout Group (No overlap) */}
        <div className="dash-session-actions">
          {onLockScreen && (
            <button 
              type="button" 
              className="dash-icon-btn dash-lock-btn" 
              onClick={onLockScreen} 
              title="Lock Terminal"
            >
              <Lock size={15} />
            </button>
          )}
          {onLogout && (
            <button 
              type="button" 
              className="dash-icon-btn dash-logout-btn" 
              onClick={onLogout} 
              title="Sign Out"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
