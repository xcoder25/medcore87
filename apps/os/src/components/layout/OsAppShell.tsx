'use client';

/**
 * Unified premium shell — same nav/chrome design as Reception & Administrator.
 * Used for every clinical / ops role so the OS feels one product.
 */
import React, { useEffect, useState } from 'react';
import type { UserSession } from '../auth/AuthScreen';
import {
  Building2, Search, LogOut, ChevronLeft, Lock, Brain, AlertTriangle,
} from 'lucide-react';
import NotificationBell from '../realtime/NotificationBell';
import { GlobalPatientContextBar } from '../clinical-core/GlobalPatientContextBar';

export type ShellNavItem = {
  key: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
};

export type ShellNavSection = {
  label?: string;
  items: ShellNavItem[];
};

interface Props {
  session: UserSession;
  sections: ShellNavSection[];
  activeModule: string;
  onNavigate: (key: string) => void;
  onLogout: () => void;
  onLock?: () => void;
  onOpenAssistant?: () => void;
  onOpenSearch?: () => void;
  onAlert?: () => void;
  roleBadge?: string;
  children: React.ReactNode;
}

function formatNow(): string {
  try {
    return new Date().toLocaleString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

export const OsAppShell: React.FC<Props> = ({
  session,
  sections,
  activeModule,
  onNavigate,
  onLogout,
  onLock,
  onOpenAssistant,
  onOpenSearch,
  onAlert,
  roleBadge,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [clock, setClock] = useState(formatNow);
  const [online, setOnline] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const id = setInterval(() => setClock(formatNow()), 1000);
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    window.addEventListener('online', onOn);
    window.addEventListener('offline', onOff);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', onOn);
      window.removeEventListener('offline', onOff);
    };
  }, []);

  const facility = session.facility || 'Hospital';
  const initials = session.avatarInitials || 'ST';
  const badge =
    roleBadge ||
    (session.roleKey === 'reception'
      ? 'RECEPTION'
      : (session.role || session.title || 'STAFF').split('/')[0].toUpperCase().slice(0, 18));

  const filteredSections = sections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((it) => {
        if (!search.trim()) return true;
        return it.label.toLowerCase().includes(search.trim().toLowerCase());
      }),
    }))
    .filter((sec) => sec.items.length > 0);

  return (
    <div className={`admin-shell${collapsed ? ' is-nav-collapsed' : ''}`}>
      <aside className={`admin-shell-sidebar${collapsed ? ' is-collapsed' : ''}`}>
        <div className="admin-shell-brand">
          <div className="admin-shell-logo">
            <img src="/medcore-logo.png" alt="MedCore" />
          </div>
          {!collapsed && (
            <div className="admin-shell-brand-text">
              <span className="name">MedCore</span>
              <span className="role">{badge}</span>
            </div>
          )}
          <button
            type="button"
            className="admin-shell-collapse"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          >
            <ChevronLeft size={16} style={{ transform: collapsed ? 'rotate(180deg)' : undefined }} />
          </button>
        </div>

        <nav className="admin-shell-nav">
          {filteredSections.map((sec, si) => (
            <div key={si} className="admin-shell-nav-sec">
              {sec.label && !collapsed && <div className="admin-shell-nav-label">{sec.label}</div>}
              {sec.items.map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`admin-shell-nav-item${active ? ' is-active' : ''}`}
                    onClick={() => onNavigate(item.key)}
                    title={item.label}
                  >
                    <Icon size={18} />
                    {!collapsed && (
                      <>
                        <span>{item.label}</span>
                        {item.badge ? <span className="admin-shell-nav-badge">{item.badge}</span> : null}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="admin-shell-user">
          <div className="admin-shell-avatar">{initials}</div>
          {!collapsed && (
            <div className="admin-shell-user-meta">
              <div className="admin-shell-user-name">{session.name || 'Staff'}</div>
              <div className="admin-shell-user-fac">{facility}</div>
            </div>
          )}
        </div>
      </aside>

      <div className="admin-shell-main">
        <header className="admin-shell-top">
          <div className="admin-shell-top-left">
            <div className="admin-shell-facility">
              <Building2 size={14} />
              <span>{facility}</span>
            </div>
            <div className="admin-shell-online">
              <span className={`dot${online ? '' : ' is-off'}`} />
              {online ? 'Online' : 'Offline'}
            </div>
            <div className="admin-shell-clock">{clock}</div>
          </div>

          <div className="admin-shell-top-right">
            <div className="admin-shell-search">
              <Search size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => onOpenSearch?.()}
                placeholder="Search modules, patients…"
                aria-label="Search"
              />
              <kbd>⌘K</kbd>
            </div>
            <NotificationBell app="MEDCORE_OS" facilityId={session.facility || session.hospitalId} />
            {onOpenAssistant && (
              <button type="button" className="admin-shell-icon-btn" onClick={onOpenAssistant} title="Assistant">
                <Brain size={16} />
              </button>
            )}
            {onAlert && (
              <button type="button" className="admin-shell-icon-btn" onClick={onAlert} title="Hospital alert">
                <AlertTriangle size={16} />
              </button>
            )}
            {onLock && (
              <button type="button" className="admin-shell-icon-btn" onClick={onLock} title="Lock screen">
                <Lock size={16} />
              </button>
            )}
            <div className="admin-shell-profile">
              <div className="admin-shell-avatar sm">{initials}</div>
              <span>{(session.role || 'Staff').split('/')[0]}</span>
            </div>
            <button type="button" className="admin-shell-icon-btn" onClick={onLogout} title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="admin-shell-content"><>
          <GlobalPatientContextBar onOpen360={() => onNavigate('patient-360')} />
          {children}
        </></main>
      </div>
    </div>
  );
};

export default OsAppShell;
