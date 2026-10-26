'use client';

import { useEffect } from 'react';
import type { UserSession } from '../components/auth/AuthScreen';
import { startHospitalCloudSync } from '../lib/facilityCloudSync';
import { startSessionGuard, clearOsSessionStorage } from '../lib/sessionGuard';
import {
  startStaffPresenceHeartbeat,
  startFacilityPresenceListener,
  markStaffOffline,
} from '../lib/staffPresenceStore';
import { startNetworkNotificationListener } from '../lib/notificationEngine';

const PRESENCE_DEFER_MS = 1500;
const CLOUD_SYNC_DEFER_MS = 800;

/**
 * Facility cloud sync, session force-logout guard, and staff presence.
 * Presence + network notifications are deferred so home desk paints first.
 */
export function useOsCloudSession(
  userSession: UserSession | null,
  onForceLogout: () => void
): void {
  // Session guard immediately (security) — lightweight
  useEffect(() => {
    if (!userSession?.badgeId || !userSession?.hospitalId) return;
    const stop = startSessionGuard(userSession, (reason) => {
      const msg =
        reason === 'auth_deleted' || reason === 'token_invalid'
          ? 'Your portal access credentials were deactivated. You have been signed out.'
          : reason === 'auth_disabled'
            ? 'Your account was disabled. You have been signed out.'
            : reason === 'removed_from_directory'
              ? 'Your staff record was removed from this facility. You have been signed out.'
              : 'Your staff account was revoked by an administrator. You have been signed out.';
      try {
        sessionStorage.setItem('medcore_auth_notice', msg);
      } catch {
        /* ignore */
      }
      try {
        clearOsSessionStorage();
      } catch {
        /* ignore */
      }
      onForceLogout();
    });
    return () => stop();
  }, [userSession?.badgeId, userSession?.hospitalId, onForceLogout]);

  // Facility cloud sync — slight defer so first paint wins
  useEffect(() => {
    if (!userSession?.hospitalId) return;
    let stop: (() => void) | undefined;
    const t = window.setTimeout(() => {
      stop = startHospitalCloudSync(userSession.hospitalId);
    }, CLOUD_SYNC_DEFER_MS);
    return () => {
      window.clearTimeout(t);
      try {
        stop?.();
      } catch {
        /* */
      }
    };
  }, [userSession?.hospitalId]);

  // Staff presence + network notifications — after home desk paints
  useEffect(() => {
    const badgeId = userSession?.badgeId;
    const hospitalId = userSession?.hospitalId;
    if (!hospitalId || !badgeId) return;

    let stopHb: (() => void) | undefined;
    let stopListen: (() => void) | undefined;
    let stopNotif: (() => void) | undefined;
    let cancelled = false;

    const t = window.setTimeout(() => {
      if (cancelled) return;
      stopHb = startStaffPresenceHeartbeat({
        badgeId,
        facilityId: hospitalId,
        name: userSession?.name || badgeId,
        roleKey: userSession?.roleKey || '',
        role: userSession?.role,
      });
      stopListen = startFacilityPresenceListener(hospitalId);
      stopNotif = startNetworkNotificationListener(hospitalId);
    }, PRESENCE_DEFER_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      try {
        stopHb?.();
        stopListen?.();
        stopNotif?.();
      } catch {
        /* */
      }
      try {
        markStaffOffline(badgeId, hospitalId);
      } catch {
        /* ignore */
      }
    };
  }, [
    userSession?.badgeId,
    userSession?.hospitalId,
    userSession?.name,
    userSession?.roleKey,
    userSession?.role,
  ]);
}
