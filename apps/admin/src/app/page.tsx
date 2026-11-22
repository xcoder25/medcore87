'use client';

import React, { useEffect, useState } from 'react';
import { MOHSplashScreen } from '../components/MOHSplashScreen';
import { MOHAuthScreen, type MOHOfficerSession } from '../components/MOHAuthScreen';
import { MohShell } from '../components/moh/MohShell';

const MOH_SESSION_KEY = 'medcore_moh_session';
const TERMINAL_LOCK_KEY = 'medcore_moh_terminal_locked_v1';

function readPersistedLock(): boolean {
  try {
    return (
      localStorage.getItem(TERMINAL_LOCK_KEY) === 'locked' ||
      sessionStorage.getItem(TERMINAL_LOCK_KEY) === 'locked'
    );
  } catch {
    return false;
  }
}

export default function MOHAdminPage() {
  const [appState, setAppState] = useState<'splash' | 'auth' | 'app'>('splash');
  const [officerSession, setOfficerSession] = useState<MOHOfficerSession | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(() => readPersistedLock());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === TERMINAL_LOCK_KEY) {
        setIsLocked(e.newValue === 'locked');
      } else if (e.key === MOH_SESSION_KEY && !e.newValue) {
        setOfficerSession(null);
        setIsLocked(false);
        setAppState('auth');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleSplashComplete = () => {
    try {
      const saved = localStorage.getItem(MOH_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as MOHOfficerSession;
        if (parsed && parsed.id) {
          setOfficerSession(parsed);
          setIsLocked(readPersistedLock());
          setAppState('app');
          return;
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    setOfficerSession(null);
    setAppState('auth');
  };

  const handleLoginSuccess = (session: MOHOfficerSession) => {
    setOfficerSession(session);
    setIsLocked(readPersistedLock());
    setAppState('app');
  };

  const handleLockTerminal = () => {
    try {
      localStorage.setItem(TERMINAL_LOCK_KEY, 'locked');
      sessionStorage.setItem(TERMINAL_LOCK_KEY, 'locked');
    } catch {
      /* ignore */
    }
    setIsLocked(true);
  };

  const handleUnlockTerminal = () => {
    try {
      localStorage.removeItem(TERMINAL_LOCK_KEY);
      sessionStorage.removeItem(TERMINAL_LOCK_KEY);
    } catch {
      /* ignore */
    }
    setIsLocked(false);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(MOH_SESSION_KEY);
      localStorage.removeItem(TERMINAL_LOCK_KEY);
      sessionStorage.removeItem(TERMINAL_LOCK_KEY);
    } catch {
      /* ignore */
    }
    setIsLocked(false);
    setOfficerSession(null);
    setAppState('auth');
  };

  if (appState === 'splash') {
    return <MOHSplashScreen onComplete={handleSplashComplete} />;
  }

  if (appState === 'auth' || !officerSession) {
    return <MOHAuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <MohShell
      session={officerSession}
      isLocked={isLocked}
      onLockTerminal={handleLockTerminal}
      onUnlockTerminal={handleUnlockTerminal}
      onLogout={handleLogout}
    />
  );
}
