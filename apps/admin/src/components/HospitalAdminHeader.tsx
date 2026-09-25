'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ChevronDown, 
  Search, 
  Bell, 
  Lock, 
  LogOut, 
  Calendar, 
  Check, 
  ShieldCheck 
} from 'lucide-react';

interface HospitalAdminHeaderProps {
  currentFacility: string;
  onFacilityChange: (facility: string) => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount?: number;
  onLockScreen?: () => void;
  onLogout?: () => void;
  administratorName?: string;
}

export const HospitalAdminHeader: React.FC<HospitalAdminHeaderProps> = ({
  currentFacility,
  onFacilityChange,
  onOpenSearch,
  onOpenNotifications,
  unreadNotificationsCount = 5,
  onLockScreen,
  onLogout,
  administratorName = 'Admin',
}) => {
  const [liveClock, setLiveClock] = useState(() => {
    return new Date().toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ' | ' + new Date().toLocaleTimeString('en-GB', { hour12: false });
  });

  const [isFacilityDropdownOpen, setIsFacilityDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveClock(
        new Date().toLocaleDateString('en-GB', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) + ' | ' + new Date().toLocaleTimeString('en-GB', { hour12: false })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const facilityOptions = [
    'Immanuel General Hospital, Eket',
    'General Hospital, Uyo',
    'General Hospital, Ikot Ekpene',
    'General Hospital, Oruk Anam',
    'St. Luke’s Hospital, Anua',
    'University College Hospital (UCH)',
    'Lagos University Teaching Hospital (LUTH)',
  ];

  return (
    <header className="ha-topbar">
      {/* Left: Facility Selector + Online Status */}
      <div className="ha-topbar-left">
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="ha-hospital-select-btn"
            onClick={() => setIsFacilityDropdownOpen(!isFacilityDropdownOpen)}
          >
            <Building2 size={16} color="#38BDF8" />
            <span>{currentFacility}</span>
            <ChevronDown size={14} color="#94A3B8" />
          </button>

          {isFacilityDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                width: 290,
                background: '#0D1730',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 12,
                boxShadow: '0 15px 35px rgba(0, 0, 0, 0.5)',
                padding: '8px',
                zIndex: 60,
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <div style={{ padding: '6px 10px', fontSize: '0.68rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Select Active Hospital
              </div>
              {facilityOptions.map((fac) => (
                <button
                  key={fac}
                  type="button"
                  onClick={() => {
                    onFacilityChange(fac);
                    setIsFacilityDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: currentFacility === fac ? 'rgba(0, 102, 255, 0.15)' : 'transparent',
                    border: 'none',
                    color: currentFacility === fac ? '#38BDF8' : '#F8FAFC',
                    fontSize: '0.82rem',
                    fontWeight: currentFacility === fac ? 600 : 400,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span>{fac}</span>
                  {currentFacility === fac && <Check size={14} color="#38BDF8" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ha-status-badge-online">
          <div className="ha-status-dot-pulse" />
          <span>Online</span>
        </div>
      </div>

      {/* Center: Live Date & Clock */}
      <div className="ha-topbar-center">
        <Calendar size={14} color="#38BDF8" />
        <span>{liveClock}</span>
      </div>

      {/* Right: Search, Notifications, Profile */}
      <div className="ha-topbar-right">
        {/* Global Search trigger ⌘K */}
        <button
          type="button"
          className="ha-search-trigger"
          onClick={onOpenSearch}
          title="Search anything (Press Ctrl+K or ⌘K)"
        >
          <Search size={15} color="#94A3B8" />
          <span>Search anything...</span>
          <kbd className="ha-kbd-badge">⌘K</kbd>
        </button>

        {/* Notifications Icon Button */}
        <button
          type="button"
          className="ha-icon-button"
          onClick={onOpenNotifications}
          title="View Notifications"
        >
          <Bell size={18} />
          {unreadNotificationsCount > 0 && (
            <span className="ha-badge-counter">{unreadNotificationsCount}</span>
          )}
        </button>

        {/* Profile Pill */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="ha-topbar-profile-btn"
            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
          >
            <div style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0066FF, #00D4A8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFF',
              fontWeight: 700,
              fontSize: '0.74rem'
            }}>
              HA
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FFFFFF' }}>{administratorName}</span>
            <ChevronDown size={14} color="#94A3B8" />
          </button>

          {isProfileDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 220,
                background: '#0D1730',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 12,
                boxShadow: '0 15px 35px rgba(0, 0, 0, 0.5)',
                padding: '8px',
                zIndex: 60,
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFFFFF' }}>Hospital Administrator</div>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{currentFacility}</div>
              </div>

              {onLockScreen && (
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    onLockScreen();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'transparent',
                    border: 'none',
                    color: '#F8FAFC',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <Lock size={15} color="#F59E0B" />
                  <span>Lock Terminal</span>
                </button>
              )}

              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    onLogout();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'transparent',
                    border: 'none',
                    color: '#EF4444',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <LogOut size={15} color="#EF4444" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
