'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import '../styles/os.css';


import {
  MODULE_COMPONENTS,
  MODULE_CLEARANCE,
  type ModuleKey,
  CommandCentreDashboard,
  RoleDashboard,
  M87AICopilotSuite,
  HospitalOnboardingWizard,
  RoleFirstRunGuide,
  AccountingWorkspace,
  DoctorPortal,
  ReceptionWorkspace,
  PosPaymentDesk,
  AkwaRemitRevenueSuite,
  resolveOnboardingMode,
} from '../os/moduleRegistry';
import { getRoleNavSections, type NavSection } from '../os/roleNav';
import { useOsBootstrap } from '../os/useOsBootstrap';
import { useOsCloudSession } from '../os/useOsCloudSession';
import { ROLE_THEMES } from '../os/roleThemes';

import { shouldShowRoleGuide } from '../lib/roleFirstRunGuide';
import { subscribeOnboarding } from '../lib/onboardingStore';
import { clearOsSessionStorage } from '../lib/sessionGuard';
import dynamic from 'next/dynamic';
import { ModuleErrorBoundary } from '../components/common/ModuleErrorBoundary';
import { authLog } from '../lib/authLog';

const AdminShell = dynamic(
  () => import('../components/dashboards/AdminShell').then((m) => m.AdminShell),
  { loading: () => <ModulePageLoader label="Opening Hospital Admin…" /> }
);
const ChangeCredentialsModal = dynamic(
  () => import('../components/auth/ChangeCredentialsModal').then((m) => m.ChangeCredentialsModal),
  { ssr: false }
);
const UserProfileModal = dynamic(
  () => import('../components/auth/UserProfileModal').then((m) => m.UserProfileModal),
  { ssr: false }
);
const KeyboardShortcutsHint = dynamic(
  () => import('../components/layout/KeyboardShortcutsHint').then((m) => m.KeyboardShortcutsHint),
  { ssr: false }
);
import { listPatients, hydratePatientRegistry } from '../lib/patientRegistryStore';
import { hydrateBedBoard } from '../lib/bedBoardStore';
import { normalizeStaffPin, firebaseSignInWithBadge } from '../lib/firebase';
import { enableEdgeCloudOnlyRuntime } from '../lib/edgeCloudOnly';
import { markStaffOffline } from '../lib/staffPresenceStore';
import { roleCanAccessModule, getModulesForRole } from '../lib/rolePermissionsStore';
import {
  inferRoleKey,
  isReceptionRole,
  defaultPermissionsForRole,
  listStaffCards,
  normalizeBadgeId,
  resolveStaffByBadge,
} from '../lib/staffCardStore';
import NotificationBell from '../components/realtime/NotificationBell';
import AlertBanner from '../components/realtime/AlertBanner';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';

// Cloud + in-memory only — no heavy localStorage / SW cache
enableEdgeCloudOnlyRuntime();

import { ModulePageLoader } from '../components/layout/ModulePageLoader';

// Splash & Auth — small, needed synchronously for first paint
import { SplashScreen } from '../components/splash/SplashScreen';
import { AuthScreen, UserSession, PRESET_STAFF } from '../components/auth/AuthScreen';

// Core & Specialty Modules — ALL lazy loaded via next/dynamic.
// The service worker pre-caches their chunks after first login so they open
// instantly on subsequent visits even on 2G / offline.
// Icons
import {
  Clock, Bell,
  Activity, Shield, Lock, Unlock, LogOut, ChevronLeft, ArrowLeft, ChevronRight,
  AlertTriangle, Building2, Users, BedDouble, RefreshCw, BarChart3, Settings,
  CreditCard, FileText, Stethoscope, Calendar, Heart, HeartPulse, Database, Brain, Sparkles, Flame,
  Pill, FlaskConical, Layers, Wind, Baby, Droplet, PhoneCall,
  Package, Wrench, Server, Gauge, Trash2, Cpu, FileCode, ShieldCheck, Landmark,
  Search, X, LayoutDashboard, MapPin, Ticket, HelpCircle, ChevronDown, CalendarDays, Zap, CheckCircle2, Globe, ArrowRight,
  Command, CornerDownLeft, IdCard, Key,
} from 'lucide-react';

const TopHudClock = React.memo(function TopHudClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="os-top-hud-datetime">
      <span className="os-top-hud-date">
        {new Date().toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </span>
      <span className="os-top-hud-time">{time || '—'}</span>
    </div>
  );
});

export default function OSPage() {
  useOsBootstrap();

  const [appState, setAppState] = useState<'splash' | 'auth' | 'app'>('splash');
  const [userSession, setUserSession] = useState<UserSession | null>(null);

  const forceLogout = useCallback(() => {
    setUserSession(null);
    setAppState('auth');
  }, []);
  useOsCloudSession(userSession, forceLogout);
  const [onboardTick, setOnboardTick] = useState(0);

  useEffect(() => {
    if (!userSession) return;
    const unsub = subscribeOnboarding(() => {
      setOnboardTick((t) => t + 1);
    }, userSession.hospitalId);
    return unsub;
  }, [userSession?.hospitalId, userSession?.badgeId]);

  const { criticalAlert, dismissCriticalAlert } = useRealtimeEvents({ app: 'MEDCORE_OS', facilityId: userSession?.facility });
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [moduleHistory, setModuleHistory] = useState<ModuleKey[]>([]);

  const navigateModule = useCallback((key: ModuleKey | string) => {
    const next = key as ModuleKey;
    setActiveModule((prev) => {
      if (prev === next) return prev;
      setModuleHistory((h) => (prev ? [...h.slice(-19), prev] : h));
      return next;
    });
  }, []);

  const goModuleBack = useCallback(() => {
    setModuleHistory((h) => {
      if (!h.length) {
        setActiveModule('dashboard');
        return h;
      }
      const prev = h[h.length - 1];
      setActiveModule(prev);
      return h.slice(0, -1);
    });
  }, []);


  // Celestia: open patient card module for a given patient
  useEffect(() => {
    const onOpen = (ev: Event) => {
      const d = (ev as CustomEvent).detail as {
        patientId?: string;
        hospitalNumber?: string;
      } | null;
      if (!d) return;
      try {
        if (d.patientId) sessionStorage.setItem('medcore_open_patient_id', d.patientId);
        if (d.hospitalNumber) sessionStorage.setItem('medcore_open_patient_hn', d.hospitalNumber);
      } catch {
        /* ignore */
      }
      navigateModule('patient-card');
    };
    window.addEventListener('medcore-celestia-open-patient', onOpen as EventListener);
    return () => window.removeEventListener('medcore-celestia-open-patient', onOpen as EventListener);
  }, []);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [globalToast, setGlobalToast] = useState<string | null>(null);
  const [moduleKey, setModuleKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockShake, setUnlockShake] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [activeEmergencyCode, setActiveEmergencyCode] = useState<string | null>(null);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [permTick, setPermTick] = useState(0);
  const [showFullDirectory, setShowFullDirectory] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showCredModal, setShowCredModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [gotoBuffer, setGotoBuffer] = useState('');
  const [cmdSearch, setCmdSearch] = useState('');
  const [wsConnected, setWsConnected] = useState(true);

  const isModulePermitted = (key: ModuleKey): boolean => {
    if (!userSession) return false;
    const rk = inferRoleKey(
      userSession.roleKey || userSession.role || userSession.title,
      userSession.badgeId
    );
    // Hospital admin / platform wildcard only
    if (rk === 'hospital_admin' || userSession.permissions?.includes('*')) return true;
    // Specialty lock: role matrix is the source of truth (not clearance level alone)
    if (roleCanAccessModule(rk, key)) return true;
    // Session permissions may include modules granted at enrol — still require matrix allow
    // (prevents radiologist with old broad permissions opening theatre via search)
    return false;
  };



  // If admin removes current module, send user home (must run before any early return)
  useEffect(() => {
    if (!userSession) return;
    if (activeModule === 'dashboard') return;
    if (!isModulePermitted(activeModule)) {
      setActiveModule('dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permTick, activeModule, userSession?.roleKey, userSession?.clearanceLevel]);

  // Live sidebar when admin ticks modules in role visibility matrix
  useEffect(() => {
    const bump = () => setPermTick((n) => n + 1);
    window.addEventListener('medcore-role-permissions', bump);
    window.addEventListener('medcore-admin-sync', bump);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'medcore_os_role_permissions_v3' || e.key === 'medcore_os_role_permissions_v2') bump();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('medcore-role-permissions', bump);
      window.removeEventListener('medcore-admin-sync', bump);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('medcore_os_session');
      if (saved) {
        const restored = JSON.parse(saved) as UserSession;
        const roleKey = inferRoleKey(
          restored.roleKey || restored.role || restored.title,
          restored.badgeId
        );
        const fixed = { ...restored, roleKey };
        setUserSession(fixed);
        setActiveModule('dashboard');
        void hydratePatientRegistry();
        void hydrateBedBoard();
        if (typeof window !== 'undefined' && sessionStorage.getItem('medcore_splash_done') === '1') {
          setAppState('app');
        }
        try {
          localStorage.setItem('medcore_os_session', JSON.stringify(fixed));
        } catch { /* ignore */ }
      }
    } catch {
      // ignore
    }

    // Optional hospital-hub WebSocket (only when configured or on localhost)
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let wsAttempts = 0;

    const resolvePageWs = (): string | null => {
      if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_WS_URL) {
        return process.env.NEXT_PUBLIC_WS_URL;
      }
      if (typeof window !== 'undefined') {
        const h = window.location.hostname;
        if (h === 'localhost' || h === '127.0.0.1') return 'ws://localhost:4000/ws';
      }
      return null;
    };

    const initWebSocket = () => {
      const url = resolvePageWs();
      if (!url) {
        setWsConnected(false);
        return;
      }
      if (wsAttempts > 6) return;
      try {
        ws = new WebSocket(url);
        ws.onopen = () => {
          wsAttempts = 0;
          setWsConnected(true);
        };
        ws.onmessage = () => {
          // Realtime events routed through event bus
        };
        ws.onclose = () => {
          setWsConnected(false);
          wsAttempts += 1;
          if (wsAttempts <= 6) {
            reconnectTimer = setTimeout(initWebSocket, 5000 * Math.min(wsAttempts, 4));
          }
        };
        ws.onerror = () => {
          setWsConnected(false);
          try { ws?.close(); } catch { /* ignore */ }
        };
      } catch {
        setWsConnected(false);
      }
    };

    initWebSocket();

    // Global keyboard shortcuts (Cmd+K / Ctrl+K and Escape)
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdPaletteOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setCmdPaletteOpen(false);
        setShortcutsOpen(false);
      }
      // G then letter navigation (Epic-style)
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        const k = e.key.toLowerCase();
        if (k === 'g') {
          setGotoBuffer('g');
          return;
        }
        setGotoBuffer((buf) => {
          if (buf !== 'g') return '';
          const map: Record<string, string> = {
            d: 'dashboard',
            p: 'patient-360',
            l: 'laboratory',
            r: 'pharmacy',
            q: 'patient-flow',
            e: 'emr',
          };
          const mod = map[k];
          if (mod) {
            e.preventDefault();
            handleModuleChange(mod as ModuleKey);
          }
          return '';
        });
      }
    };
    window.addEventListener('keydown', handleGlobalKey);

    return () => {
      window.removeEventListener('keydown', handleGlobalKey);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  const handleSplashComplete = () => {
    if (userSession) {
      setAppState('app');
    } else {
      setAppState('auth');
    }
  };

  const handleLoginSuccess = (session: UserSession) => {
    // Canonicalise role so reception never opens clinical desk
    const roleKey = inferRoleKey(
      session.roleKey || session.role || session.title,
      session.badgeId
    );
    const sessionPin = session.pin || (session as any).pin;
    const normalized: UserSession = {
      ...session,
      pin: sessionPin,
      roleKey,
      permissions:
        session.permissions && session.permissions.length > 0
          ? session.permissions
          : defaultPermissionsForRole(roleKey),
    };
    try {
      localStorage.setItem('medcore_os_session', JSON.stringify(normalized));
      if (sessionPin && typeof window !== 'undefined') {
        sessionStorage.setItem('medcore_session_pin', sessionPin);
      }
    } catch { /* ignore */ }
    setUserSession(normalized);
    setActiveModule('dashboard');
    setAppState('app');
    void hydratePatientRegistry();
    void hydrateBedBoard();

    // Signal the service worker to prefetch all Next.js chunks in the background.
    // This ensures every module the user clicks opens instantly (served from cache)
    // even on 2G after the first login — no per-click network wait.
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'PREFETCH_CHUNKS' });
    }
  };

  const handleLogout = () => {
    try {
      if (userSession?.badgeId && userSession?.hospitalId) {
        markStaffOffline(userSession.badgeId, userSession.hospitalId);
      }
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem('medcore_os_session');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('medcore_session_pin');
      }
    } catch {
      // ignore
    }
    setUserSession(null);
    setAppState('auth');
  };

  






const handleLockScreen = () => {
    setIsLocked(true);
    setUnlockPin('');
    setUnlockError('');
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = unlockPin.trim();
    if (!entered || unlockLoading) return;

    setUnlockLoading(true);
    setUnlockError('');

    try {
      const enteredNorm = normalizeStaffPin(entered);

      // 1. Gather all legitimate candidate PINs for this staff session
      const candidates: string[] = [];

      // A. Session in-memory PIN
      if (userSession?.pin) candidates.push(String(userSession.pin));
      if ((userSession as any)?.pin) candidates.push(String((userSession as any).pin));

      // B. Active browser sessionStorage
      if (typeof window !== 'undefined') {
        const storedPin = sessionStorage.getItem('medcore_session_pin');
        if (storedPin) candidates.push(storedPin);
      }

      const badgeRaw = userSession?.badgeId ? String(userSession.badgeId).trim() : '';
      const badge = badgeRaw ? normalizeBadgeId(badgeRaw) : '';

      if (badge) {
        // C. resolveStaffByBadge (checks live registry & cards)
        const resolved = resolveStaffByBadge(badge);
        if (resolved?.pin) candidates.push(String(resolved.pin));

        // D. Local staff registries (medcore_os_staff_registry, medcore_staff_registry)
        if (typeof window !== 'undefined') {
          for (const regKey of ['medcore_os_staff_registry', 'medcore_staff_registry']) {
            try {
              const raw = localStorage.getItem(regKey);
              if (raw) {
                const list = JSON.parse(raw);
                if (Array.isArray(list)) {
                  const hit = list.find((r: any) => normalizeBadgeId(r.badgeId || r.id) === badge);
                  if (hit?.pin) candidates.push(String(hit.pin));
                }
              }
            } catch { /* ignore */ }
          }
        }

        // E. Live staff cards list
        const card = listStaffCards().find((c) => normalizeBadgeId(c.badgeId) === badge);
        if ((card as any)?.pin) candidates.push(String((card as any).pin));

        // F. PRESET_STAFF presets
        const preset = PRESET_STAFF.find((p) => normalizeBadgeId(p.badgeId) === badge);
        if (preset?.pin) candidates.push(String(preset.pin));

      }

      // 2. Check if entered PIN matches ANY candidate
      let matched = candidates.some(
        (cand) =>
          cand &&
          (normalizeStaffPin(cand) === enteredNorm ||
            cand === entered ||
            cand.trim() === entered)
      );

      // 3. If still unmatched and we have a badge, try authenticating with Firebase Auth
      if (!matched && badgeRaw) {
        try {
          await firebaseSignInWithBadge(badgeRaw, enteredNorm);
          matched = true;
          // Cache verified PIN into sessionStorage for immediate subsequent unlocks
          try {
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('medcore_session_pin', entered);
            }
          } catch { /* ignore */ }
        } catch {
          matched = false;
        }
      }

      // 4. Strict check: ONLY unlock if matched is strictly true. NEVER unlock on empty or wrong PIN!
      if (matched) {
        setIsLocked(false);
        setUnlockPin('');
        setUnlockError('');
      } else {
        setUnlockError('Incorrect PIN. Try again.');
        setUnlockShake(true);
        window.setTimeout(() => setUnlockShake(false), 600);
        setUnlockPin('');
      }
    } finally {
      setUnlockLoading(false);
    }
  };

  useEffect(() => {
    const onToast = (e: Event) => {
      const msg = (e as CustomEvent).detail?.message;
      if (msg) {
        setGlobalToast(String(msg));
        window.setTimeout(() => setGlobalToast(null), 3200);
      }
    };
    window.addEventListener('medcore-toast', onToast);
    window.addEventListener('medcore-live-action', onToast as EventListener);
    return () => {
      window.removeEventListener('medcore-toast', onToast);
      window.removeEventListener('medcore-live-action', onToast as EventListener);
    };
  }, []);

  const handleModuleChange = (key: ModuleKey) => {
    if (key === activeModule) return;
    setModuleHistory((h) => [...h.slice(-19), activeModule]);
    setActiveModule(key);
    setModuleKey(prev => prev + 1);
    setModuleLoading(false);
  };

  const handleSwitchCadre = (staff: typeof PRESET_STAFF[0]) => {
    const newSession: UserSession = {
      id: staff.badgeId,
      name: staff.name,
      role: staff.role,
      title: staff.title,
      roleKey: staff.roleKey,
      badgeId: staff.badgeId,
      clearanceLevel: staff.clearanceLevel,
      clearanceLabel: staff.clearanceLabel,
      facility: staff.hospitalName || userSession?.facility || 'Lagos Island General Hospital',
      hospitalId: staff.hospitalId || userSession?.hospitalId || 'LIGH',
      department: staff.department,
      avatarInitials: staff.initials,
      authMethod: 'Admin switch',
      token: `AUTH-${Date.now().toString(36).toUpperCase()}`,
      loginTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      permissions: staff.permissions,
    };
    setUserSession(newSession);
    setActiveModule('dashboard');
    setModuleKey(prev => prev + 1);
    setShowRoleModal(false);
    try {
      localStorage.setItem('medcore_os_session', JSON.stringify(newSession));
    } catch {}
  };

  // ── Command Palette data (must be before early returns — Rules of Hooks) ──
  const allPaletteCommands = useMemo(() => {
    const list: { id: string; label: string; group: string; icon: any; action: () => void; badge?: string }[] = [];
    
    // Quick Actions
    list.push(
      {
        id: 'act-switch-role',
        label: 'View as another staff (admin only)',
        group: 'Quick Actions',
        icon: ShieldCheck,
        action: () => { setShowRoleModal(true); setCmdPaletteOpen(false); },
        badge: 'Admin'
      },
      {
        id: 'act-copilot',
        label: 'Open clinical assistant',
        group: 'Quick Actions',
        icon: Brain,
        action: () => { setAiDrawerOpen(true); setCmdPaletteOpen(false); },
        badge: 'AI'
      },
      {
        id: 'act-alert',
        label: 'Send hospital alert',
        group: 'Quick Actions',
        icon: AlertTriangle,
        action: () => {
          setActiveEmergencyCode('CODE RED — RESUSCITATION / TRAUMA ALERT');
          setCmdPaletteOpen(false);
        },
        badge: 'Emergency'
      },
      {
        id: 'act-lock',
        label: 'Lock Workstation Terminal Screen',
        group: 'Quick Actions',
        icon: Lock,
        action: () => { handleLockScreen(); setCmdPaletteOpen(false); },
        badge: 'Security'
      }
    );

    // Get all navigation sections from master directory
    const allSections = getRoleNavSections(null, true);
    allSections.forEach(sec => {
      sec.items.forEach(item => {
        // Specialty lock: hide modules this role cannot open (search cannot bypass sidebar)
        if (userSession && !isModulePermitted(item.key as ModuleKey)) return;
        list.push({
          id: `mod-${item.key}`,
          label: item.label,
          group: sec.label,
          icon: item.icon,
          badge: item.badge,
          action: () => {
            handleModuleChange(item.key as ModuleKey);
            setCmdPaletteOpen(false);
          }
        });
      });
    });

    
    try {
      const fid = userSession?.hospitalId || 'IGH-EKT';
      for (const p of listPatients(fid).slice(0, 40)) {
        list.push({
          id: `pt-${p.id}`,
          label: `${p.firstName} ${p.lastName} · ${p.hospitalNumber}`,
          group: 'Patients',
          icon: Users,
          badge: 'Chart',
          action: () => {
            try { sessionStorage.setItem('medcore_focus_patient', p.id); } catch {}
            handleModuleChange('patient-360' as ModuleKey);
            setCmdPaletteOpen(false);
          },
        });
      }
    } catch {}

    return list;
  }, [userSession?.hospitalId]);

  const filteredCommands = useMemo(() => {
    if (!cmdSearch.trim()) return allPaletteCommands;
    const q = cmdSearch.toLowerCase();
    return allPaletteCommands.filter(c => 
      c.label.toLowerCase().includes(q) || 
      c.group.toLowerCase().includes(q) ||
      (c.badge && c.badge.toLowerCase().includes(q))
    );
  }, [cmdSearch, allPaletteCommands]);

  if (appState === 'splash') {
    return (
      <SplashScreen
        onComplete={handleSplashComplete}
        title="IBOM HEALTH OS"
        subtitle="Akwa Ibom State Hospital Operations & Clinical Information System"
      />
    );
  }

  if (appState === 'auth') {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // First-login hospital / staff onboarding (admin facility setup or clinical workspace)
  if (userSession) {
    void onboardTick;
    const onboardMode = resolveOnboardingMode(userSession);
    if (onboardMode) {
      return (
        <HospitalOnboardingWizard
          session={userSession}
          mode={onboardMode}
          onComplete={() => {
            // Force re-render; flags already written to localStorage
            setUserSession({ ...userSession });
          }}
        />
      );
    }

    // Role-specific first-time use guide (once per badge + role)
    const guideRole = inferRoleKey(
      userSession.roleKey || userSession.role || userSession.title,
      userSession.badgeId
    );
    if (shouldShowRoleGuide(userSession.badgeId || '', guideRole)) {
      return (
        <RoleFirstRunGuide
          session={userSession}
          onComplete={({ openModule } = {}) => {
            if (openModule) {
              try {
                setActiveModule(openModule as any);
              } catch {
                /* ignore */
              }
            }
            setUserSession({ ...userSession });
          }}
        />
      );
    }
  }

  const receptionViews = ['dashboard', 'patient-flow', 'patient-card', 'appointments'] as const;
  const receptionUser = !!(
    userSession &&
    isReceptionRole(userSession.roleKey, userSession.role, userSession.title, userSession.badgeId)
  );
  const useReceptionCockpit =
    receptionUser &&
    receptionViews.includes(activeModule as (typeof receptionViews)[number]);
  const ActiveComponent = useReceptionCockpit
    ? ReceptionWorkspace
    : MODULE_COMPONENTS[activeModule] || CommandCentreDashboard;

  // Resolve active role theme
  const activeRoleKey = userSession
    ? inferRoleKey(userSession.roleKey || userSession.role || userSession.title, userSession.badgeId)
    : 'doctor';

  const currentRoleTheme = ROLE_THEMES[activeRoleKey] || ROLE_THEMES.doctor;
  const RoleIcon = currentRoleTheme.icon;

  const isLabStaff = activeRoleKey === 'lab' || userSession?.roleKey === 'lab';
  // Dynamically load tailored RBAC sidebar content
  const roleNavSections = getRoleNavSections(userSession, (receptionUser || isLabStaff) ? false : showFullDirectory);

  // Full admin chrome replaces the clinical OS shell
  if (userSession && (activeRoleKey === 'hospital_admin' || userSession.roleKey === 'hospital_admin')) {
    return (
      <AdminShell
        session={userSession}
        onLogout={handleLogout}
      />
    );
  }


  // Filtered Nav items based on search

  // permTick forces re-read of role matrix when admin toggles modules
  void permTick;
  const filteredSections = roleNavSections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => {
        if (!isModulePermitted(item.key as ModuleKey)) return false;
        const q = sidebarSearch.toLowerCase();
        if (!q) return true;
        return (
          item.label.toLowerCase().includes(q) ||
          (!!item.badge && item.badge.toLowerCase().includes(q))
        );
      }),
    }))
    .filter((sec) => sec.items.length > 0);


  return (
    <div className="os-workspace-shell">
      {globalToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            right: 28,
            zIndex: 99999,
            background: '#0F172A',
            color: '#fff',
            padding: '12px 18px',
            borderRadius: 12,
            fontWeight: 600,
            fontSize: 13,
            maxWidth: 360,
            boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          }}
        >
          {globalToast}
        </div>
      )}
      {/* ── Command Palette (⌘K / Ctrl+K Spotlight Modal) ── */}
      <KeyboardShortcutsHint open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {cmdPaletteOpen && (
        <div className="os-cmd-palette-backdrop" onClick={() => setCmdPaletteOpen(false)}>
          <div className="os-cmd-palette-modal" onClick={e => e.stopPropagation()}>
            <div className="os-cmd-search-header">
              <Search size={18} style={{ color: '#0052D4', flexShrink: 0 }} />
              <input
                autoFocus
                className="os-cmd-input"
                placeholder="Search modules, clinical pathways, patients, or actions..."
                value={cmdSearch}
                onChange={e => setCmdSearch(e.target.value)}
              />
              <span className="os-cmd-kbd">ESC</span>
            </div>
            <div className="os-cmd-results">
              {filteredCommands.length === 0 ? (
                <div style={{ padding: '28px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
                  No matching modules or actions found for "{cmdSearch}"
                </div>
              ) : (
                filteredCommands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <div
                      key={cmd.id}
                      className="os-cmd-item"
                      onClick={cmd.action}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: 'rgba(0, 82, 212, 0.08)',
                          color: '#0052D4',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Icon size={16} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.86rem' }}>{cmd.label}</span>
                          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{cmd.group}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {cmd.badge && (
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: '#F1F5F9',
                            color: '#475569'
                          }}>
                            {cmd.badge}
                          </span>
                        )}
                        <CornerDownLeft size={13} style={{ color: '#94A3B8' }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Quick RBAC Switcher Modal ── */}
      {showRoleModal && (
        <div className="os-lock-modal-backdrop" onClick={() => setShowRoleModal(false)}>
          <div
            className="os-lock-card"
            style={{ maxWidth: 640, textAlign: 'left', padding: '28px 32px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#F8FAFC', fontFamily: 'var(--os-font-heading)' }}>
                  Switch staff account (admin)
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
                  Select a clinical or operational role to test its dedicated dashboard and personalized sidebar navigation.
                </p>
              </div>
              <button
                type="button"
                className="os-ghost-btn"
                style={{ padding: 6 }}
                onClick={() => setShowRoleModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 16 }}>
              {(PRESET_STAFF.length ? PRESET_STAFF : []).map(staff => {
                const isCurrent = userSession?.badgeId === staff.badgeId;
                return (
                  <div
                    key={staff.badgeId}
                    onClick={() => handleSwitchCadre(staff)}
                    style={{
                      background: isCurrent ? 'linear-gradient(90deg, rgba(0,82,212,0.1) 0%, rgba(0,191,165,0.08) 100%)' : '#FFFFFF',
                      border: `1.5px solid ${isCurrent ? '#0052D4' : '#E2E8F0'}`,
                      borderRadius: 12,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: isCurrent ? 'linear-gradient(135deg, #0052D4, #00BFA5)' : `${staff.color || '#0052D4'}18`,
                        color: isCurrent ? '#FFFFFF' : (staff.color || '#0052D4'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        flexShrink: 0,
                      }}
                    >
                      {staff.initials}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0A2540', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {staff.name}
                        </span>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#0052D4', background: 'rgba(0,82,212,0.1)', padding: '1px 5px', borderRadius: 4 }}>
                          L{staff.clearanceLevel}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2 }}>
                        {staff.role.split('/')[0].trim()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Lock Screen Modal ── */}
      {isLocked && (
        <div className="os-lock-modal-backdrop">
          <style>{'@keyframes osLockShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-8px)}30%{transform:translateX(8px)}45%{transform:translateX(-6px)}60%{transform:translateX(6px)}75%{transform:translateX(-3px)}90%{transform:translateX(3px)}}'}</style>
          <div
            className="os-lock-card"
            style={unlockShake ? { animation: 'osLockShake 0.55s ease' } : {}}
          >
            <div className="os-lock-icon-wrap">
              <Lock size={30} />
            </div>
            <div style={{ marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(234,88,12,0.1)', border: '1px solid rgba(234,88,12,0.25)', borderRadius: 9999, padding: '3px 12px', fontSize: '0.7rem', fontWeight: 700, color: '#FB923C', letterSpacing: '0.05em' }}>
              IBOM HEALTH OS · TERMINAL SECURED
            </div>
            <h3 style={{ margin: '10px 0 6px 0', color: '#0A2540', fontFamily: 'var(--os-font-heading)', fontSize: '1.3rem' }}>Workstation Locked</h3>
            <p style={{ margin: '0 0 18px 0', fontSize: '0.82rem', color: '#94A3B8', lineHeight: 1.5 }}>
              Staff on Duty: <strong style={{ color: '#FB923C' }}>{userSession?.name}</strong><br />
              <span style={{ color: '#64748B', fontSize: '0.75rem' }}>Enter your PIN to resume session.</span>
            </p>
            <form onSubmit={handleUnlock}>
              <input
                type="password"
                className="os-form-input"
                placeholder="Enter PIN"
                value={unlockPin}
                disabled={unlockLoading}
                onChange={(e) => { setUnlockPin(e.target.value); if (unlockError) setUnlockError(''); }}
                autoFocus
                style={{
                  textAlign: 'center',
                  letterSpacing: '0.25em',
                  fontSize: '1.1rem',
                  marginBottom: unlockError ? 8 : 14,
                  borderColor: unlockError ? '#EF4444' : undefined,
                  outline: unlockError ? '2px solid rgba(239,68,68,0.25)' : undefined,
                  opacity: unlockLoading ? 0.7 : 1,
                }}
              />
              {unlockError && (
                <div style={{
                  marginBottom: 12,
                  fontSize: '0.78rem',
                  color: '#EF4444',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                }}>
                  <Key size={12} />
                  {unlockError}
                </div>
              )}
              <button
                type="submit"
                disabled={unlockLoading}
                className="os-login-submit-btn"
                style={{ margin: 0, opacity: unlockLoading ? 0.75 : 1 }}
              >
                <Unlock size={16} />
                <span>{unlockLoading ? 'Verifying PIN...' : 'Unlock Terminal'}</span>
              </button>
            </form>
            <div style={{ marginTop: 18, fontSize: '0.72rem', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span className="os-status-dot pulse-green" />
              <span>Session active · {userSession?.facility}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Celestia Assistant panel ── */}
      {aiDrawerOpen && (
        <div
          role="dialog"
          aria-label="Celestia Assistant"
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 'min(460px, 100vw)',
            zIndex: 9600,
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(165deg, #06061a 0%, #0c0a2e 50%, #12082a 100%)',
            backdropFilter: 'blur(20px)',
            borderLeft: '1px solid rgba(167, 139, 250, 0.25)',
            boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.65)',
            animation: 'osPremiumFade 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <M87AICopilotSuite
              session={userSession ?? undefined}
              inDrawer
              onClose={() => setAiDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Floating assistant launcher */}
      {!aiDrawerOpen && (
        <button
          type="button"
          className="os-ai-fab"
          onClick={() => setAiDrawerOpen(true)}
          title="Open Celestia Assistant"
          aria-label="Open Celestia Assistant"
        >
          <img
            src="/celestia-logo.png"
            alt=""
            className="os-ai-fab-logo"
          />
          <span className="os-ai-fab-pulse" />
        </button>
      )}

      {/* ── Left Navigation Sidebar (Bespoke Content per RBAC Role) ── */}
      <aside
        className={`os-sidebar${sidebarOpen ? '' : ' is-collapsed'}${activeRoleKey === 'midwife' ? ' theme-maternity' : ''}`}
        style={{ width: sidebarOpen ? 275 : 72 }}
        data-collapsed={sidebarOpen ? 'false' : 'true'}
      >
        <div className="os-sidebar-header">
          <div className="os-sidebar-brand">
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#FFFFFF',
              boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              flexShrink: 0,
            }}>
              <img
                src="/medcore-logo.png"
                alt="MedCore Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            {sidebarOpen && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="os-brand-text" style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>MedCore</span>
                <span style={{ display: 'block', fontSize: '0.65rem', color: 'rgba(148,163,184,0.95)', fontWeight: 600, marginTop: 2 }}>
                  {userSession?.roleKey === 'reception' ? 'Hospital Administration' : 'Hospital OS'}
                </span>
                <span style={{ fontSize: '0.66rem', color: currentRoleTheme.accent, fontWeight: 800, letterSpacing: '0.05em' }}>
                  {currentRoleTheme.badge}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="os-sidebar-toggle-btn"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSidebarOpen((v) => !v);
            }}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Quick Module Search Input — hidden for reception (short menu) */}
        {sidebarOpen && userSession?.roleKey !== 'reception' && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #1A2F4C' }}>
            <div className="os-search-wrap" style={{ minWidth: 'unset', width: '100%', padding: '6px 10px' }}>
              <Search size={12} />
              <input
                className="os-search-input"
                style={{ fontSize: '0.75rem' }}
                placeholder="Jump to suite or ward..."
                value={sidebarSearch}
                onChange={e => setSidebarSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        <nav className="os-sidebar-nav">
          {filteredSections.map((sec) => (
            <div key={sec.label} style={{ marginBottom: 14 }}>
              {sidebarOpen && (
                <div className="os-nav-section-label" style={{ fontSize: '0.66rem', color: '#94A3B8' }}>{sec.label}</div>
              )}
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.key;
                const permitted = isModulePermitted(item.key);
                const reqClearance = MODULE_CLEARANCE[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleModuleChange(item.key)}
                    className={`os-nav-item-btn ${isActive ? 'active' : ''}`}
                    title={!sidebarOpen ? `${item.label} (${reqClearance?.label || 'General'})` : undefined}
                    style={{
                      padding: sidebarOpen ? '8px 12px' : '10px 0',
                      justifyContent: sidebarOpen ? 'flex-start' : 'center',
                      opacity: permitted ? 1 : 0.65,
                      color: isActive ? '#FFFFFF' : '#E2E8F0',
                      background: isActive ? currentRoleTheme.activeBg : 'transparent',
                      borderLeft: sidebarOpen
                        ? (isActive ? `3.5px solid ${currentRoleTheme.accent}` : '3.5px solid transparent')
                        : (isActive ? `3px solid ${currentRoleTheme.accent}` : '3px solid transparent'),
                      fontWeight: isActive ? 700 : 500,
                      borderRadius: sidebarOpen ? '0 8px 8px 0' : 10,
                      marginRight: sidebarOpen ? 6 : 0,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={16} style={{ color: isActive ? currentRoleTheme.accent : '#94A3B8', flexShrink: 0 }} />
                    {sidebarOpen && <span style={{ fontSize: '0.78rem' }}>{item.label}</span>}
                    {sidebarOpen && !permitted && (
                      <Lock size={12} style={{ color: '#F87171', marginLeft: 'auto', flexShrink: 0 }} />
                    )}
                    {sidebarOpen && permitted && item.badge && (
                      <span className="os-nav-badge" style={{
                        fontSize: '0.62rem',
                        padding: '1px 6px',
                        background: isActive ? currentRoleTheme.accent : undefined,
                        color: isActive ? '#FFFFFF' : undefined,
                      }}>{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Directory Mode Switcher — privileged administrative roles only */}
          {sidebarOpen && ['sysadmin', 'hospital_admin', 'medical_director'].includes(userSession?.roleKey || '') && (
            <div style={{ padding: '10px 8px', borderTop: '1px solid #1A2F4C', marginTop: 12 }}>
              <button
                type="button"
                className="os-ghost-btn"
                style={{ width: '100%', justifyContent: 'center', fontSize: '0.72rem', padding: '6px 8px' }}
                onClick={() => setShowFullDirectory(!showFullDirectory)}
              >
                <Globe size={13} />
                <span>{showFullDirectory ? 'Show my menu only' : 'Show all menus'}</span>
              </button>
            </div>
          )}
        </nav>

        {/* Sidebar Footer User Info */}
        {sidebarOpen && userSession && (
          <div className="os-sidebar-footer">
            <div className="os-user-mini-card">
              <div className="os-user-mini-avatar">
                {userSession.avatarInitials}
              </div>
              <div className="os-user-mini-info">
                <span className="os-user-mini-name">{userSession.name}</span>
                <span className="os-user-mini-role">{(userSession.roleKey === 'reception' ? 'Receptionist' : userSession.role.split('/')[0])}</span>
              </div>
              {/* access level chip removed — keep header simple for staff */}
            </div>
          </div>
        )}
      </aside>

      {/* ── Main Operations Column (Desktop Fit) ── */}
      <div className="os-main-column">
        {/* Real-Time Critical Alert Banner */}
        <AlertBanner alert={criticalAlert} onDismiss={dismissCriticalAlert} />

        {/* Top Operations Header */}
        <header className="os-top-hud">
          <div className="os-top-hud-facility">
            <div className="os-top-hud-facility-icon">
              <Building2 size={16} color="#0284C7" />
            </div>
            <div className="os-top-hud-facility-meta">
              <span className="os-top-hud-facility-name">
                {userSession?.facility?.split(',')[0] || 'Main Branch'}
              </span>
              <span className="os-top-hud-facility-loc">
                {(userSession?.facility || '').includes(',')
                  ? userSession?.facility?.split(',').slice(1).join(',').trim()
                  : userSession?.roleKey === 'reception'
                    ? 'Reception'
                    : (userSession?.department || 'Clinical desk')}
              </span>
            </div>
            <ChevronDown size={14} color="#94A3B8" />
          </div>

          <button
            type="button"
            className="os-top-hud-search"
            onClick={() => setCmdPaletteOpen(true)}
            title="Search (⌘K)"
          >
            <Search size={15} color="#94A3B8" />
            <span className="os-top-hud-search-placeholder">
              Search patients, staff, ID, queue…
            </span>
            <span className="os-top-hud-kbd">⌘K</span>
          </button>

          <div className="os-top-hud-trail">
            <TopHudClock />

            
            <button
              type="button"
              className="os-top-hud-icon-btn"
              title="Back"
              aria-label="Go back"
              onClick={() => goModuleBack()}
              disabled={moduleHistory.length === 0 && activeModule === 'dashboard'}
              style={{
                opacity: moduleHistory.length === 0 && activeModule === 'dashboard' ? 0.35 : 1,
              }}
            >
              <ArrowLeft size={17} strokeWidth={2.25} />
            </button>
<span className="os-top-hud-live">
              <span className="os-top-hud-live-dot" />
              Live
            </span>

            <NotificationBell app="MEDCORE_OS" facilityId={userSession?.facility} session={userSession ?? undefined} />

            <button
              type="button"
              className="os-top-hud-icon-btn"
              title="Help"
              onClick={() => setAiDrawerOpen(true)}
            >
              <HelpCircle size={17} strokeWidth={2} />
            </button>

            <div
              className="os-top-hud-user"
              onClick={() => setShowProfileModal(true)}
              style={{ cursor: 'pointer' }}
              title="View Staff Profile & Identity Card"
            >
              <div className="os-top-hud-avatar">
                {(userSession?.avatarInitials ||
                  userSession?.name
                    ?.split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2) ||
                  'U'
                ).toUpperCase()}
              </div>
              <div className="os-top-hud-user-meta">
                <span className="os-top-hud-user-name">{userSession?.name || 'User'}</span>
                <span className="os-top-hud-user-role">
                  {userSession?.roleKey === 'reception'
                    ? 'Receptionist'
                    : (userSession?.role || 'User').split('/')[0]}
                </span>
              </div>
              <ChevronDown size={14} color="#94A3B8" />
            </div>

            <button
              type="button"
              className="os-top-hud-icon-btn"
              title="Lock"
              onClick={() => setIsLocked(true)}
            >
              <Lock size={15} />
            </button>
            <button
              type="button"
              className="os-top-hud-icon-btn"
              title="Sign out"
              onClick={handleLogout}
            >
              <LogOut size={15} />
            </button>
          </div>
          <span className="os-route-progress" aria-hidden>
            <i />
          </span>
        </header>

        {/* LIVE UPDATES ticker removed */}

        {/* Emergency Alert Banner */}
        {activeEmergencyCode && (
          <div className="os-emergency-active-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} />
              <span>HOSPITAL BROADCAST: {activeEmergencyCode} — Clinical Response Team deployed to Accident & Emergency</span>
            </div>
            <button
              type="button"
              className="os-clear-alert-btn"
              onClick={() => setActiveEmergencyCode(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content Viewport — Perfectly fitted for Desktop Screen */}
        <main className="os-viewport-content">
          {activeModule === 'command' && (
            <>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontFamily: 'var(--os-font-heading)', fontWeight: 800, color: '#F8FAFC' }}>
                  Hospital Operations & Inpatient Census Overview
                </h1>
                <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.88rem' }}>
                  Live hospital status across Inpatient Wards, Emergency Triage, ICU Beds, and Clinical Duty Staff.
                </p>
              </div>

              <section className="os-metrics-ribbon">
                <div className="metric-box">
                  <span className="metric-label">Hospital Bed Occupancy</span>
                  <span className="metric-val">482 / 520</span>
                  <span className="metric-sub">92.6% Occupancy • 38 Beds Available</span>
                </div>
                <div className="metric-box alert-yellow">
                  <span className="metric-label">Accident & Emergency (A&E)</span>
                  <span className="metric-val">28 mins</span>
                  <span className="metric-sub">14 Patients Waiting in Triage</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Intensive Care Unit (ICU)</span>
                  <span className="metric-val">44 / 48</span>
                  <span className="metric-sub">4 Ventilator Beds Ready</span>
                </div>
                <div className="metric-box alert-green">
                  <span className="metric-label">Staff on Duty</span>
                  <span className="metric-val">186 Staff</span>
                  <span className="metric-sub">34 Doctors • 112 Nurses • 40 Support</span>
                </div>
              </section>
            </>
          )}

          <div key={moduleKey} className={`os-active-module-wrap${moduleLoading ? '' : ' is-entering'}`}>
            <ModuleErrorBoundary moduleName={String(activeModule)} key={`eb-${moduleKey}`}>
            {moduleLoading ? (
              <ModulePageLoader label="Opening workspace…" />
            ) : isModulePermitted(activeModule) ? (
              activeModule === 'dashboard' && userSession && (userSession.roleKey === 'accountant' || userSession.roleKey === 'cashier') ? (
                <AccountingWorkspace
                  session={userSession}
                  onNavigate={(k) => handleModuleChange(k as ModuleKey)}
                  initialView="home"
                />
              ) : activeModule === 'cashier' && userSession && (userSession.roleKey === 'accountant' || userSession.roleKey === 'cashier') ? (
                <AccountingWorkspace
                  session={userSession}
                  onNavigate={(k) => handleModuleChange(k as ModuleKey)}
                  initialView="payment"
                />
              ) : activeModule === 'billing' && userSession && (userSession.roleKey === 'accountant' || userSession.roleKey === 'cashier') ? (
                <AccountingWorkspace
                  session={userSession}
                  onNavigate={(k) => handleModuleChange(k as ModuleKey)}
                  initialView="billing"
                />
              ) : activeModule === 'claims' && userSession && (userSession.roleKey === 'accountant' || userSession.roleKey === 'cashier') ? (
                <AccountingWorkspace
                  session={userSession}
                  onNavigate={(k) => handleModuleChange(k as ModuleKey)}
                  initialView="claims"
                />
              ) : activeModule === 'revenue-cycle' && userSession && (userSession.roleKey === 'accountant' || userSession.roleKey === 'cashier') ? (
                <AccountingWorkspace
                  session={userSession}
                  onNavigate={(k) => handleModuleChange(k as ModuleKey)}
                  initialView="ar"
                />
              ) : activeModule === 'akwaremit' && userSession ? (
                <AkwaRemitRevenueSuite session={userSession} />
              ) : activeModule === 'cashier' && userSession ? (
                <PosPaymentDesk session={userSession} onNavigate={(k) => handleModuleChange(k as ModuleKey)} />
              ) : activeModule === 'dashboard' && userSession && isReceptionRole(userSession.roleKey, userSession.role, userSession.title, userSession.badgeId) ? (
                <ReceptionWorkspace session={userSession} onNavigate={(k) => handleModuleChange(k as ModuleKey)} initialView="home" />
              ) : activeModule === 'dashboard' && userSession ? (
                <RoleDashboard session={userSession} onNavigate={handleModuleChange} />
              ) : activeModule === 'doctor-portal' && userSession ? (
                <DoctorPortal session={userSession} onNavigate={(k) => handleModuleChange(k as ModuleKey)} initialModule="consultation" />
              ) : activeModule === 'pharmacy' && userSession && (activeRoleKey === 'doctor' || activeRoleKey === 'surgeon') ? (
                <DoctorPortal session={userSession} onNavigate={(k) => handleModuleChange(k as ModuleKey)} initialModule="prescriptions" />
              ) : activeModule === 'laboratory' && userSession && (activeRoleKey === 'doctor' || activeRoleKey === 'surgeon') ? (
                <DoctorPortal session={userSession} onNavigate={(k) => handleModuleChange(k as ModuleKey)} initialModule="lab-orders" />
              ) : activeModule === 'radiology' && userSession && (activeRoleKey === 'doctor' || activeRoleKey === 'surgeon') ? (
                <DoctorPortal session={userSession} onNavigate={(k) => handleModuleChange(k as ModuleKey)} initialModule="radiology-orders" />
              ) : (
                <ActiveComponent
                  session={userSession!}
                  onNavigate={(k: string) => handleModuleChange(k as ModuleKey)}
                  {...(useReceptionCockpit
                    ? {
                        initialView:
                          activeModule === 'patient-flow'
                            ? 'queue'
                            : activeModule === 'patient-card'
                              ? 'register'
                              : activeModule === 'appointments'
                                ? 'appointments'
                                : 'home',
                      }
                    : {})}
                />
              )
            ) : (
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 16,
                  padding: '36px 28px',
                  maxWidth: 520,
                  margin: '48px auto',
                  textAlign: 'center',
                  boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0A2540', marginBottom: 8 }}>
                  This area is not on your desk
                </div>
                <p style={{ margin: '0 0 18px', fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>
                  Open a suite from your sidebar, or return to your home desk.
                </p>
                <button
                  type="button"
                  className="os-ghost-btn"
                  onClick={() => setActiveModule('dashboard')}
                  style={{ fontWeight: 700 }}
                >
                  Go to my desk
                </button>
              </div>
            )}
            </ModuleErrorBoundary>
          </div>
        </main>
      </div>

      {userSession && (
        <UserProfileModal
          session={userSession}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onOpenCredentials={() => setShowCredModal(true)}
          onLogout={handleLogout}
        />
      )}

      {userSession && (
        <ChangeCredentialsModal
          session={userSession}
          isOpen={showCredModal}
          onClose={() => setShowCredModal(false)}
        />
      )}
    </div>
  );
}
