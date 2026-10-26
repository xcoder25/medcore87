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

/**
 * Facility cloud sync, session force-logout guard, and staff presence.
 */
export function useOsCloudSession(
  userSession: UserSession | null,
  onForceLogout: () => void
): void {
  // Same-hospital live cloud sync
  useEffect(() => {
    if (!userSession?.hospitalId) return;
    return startHospitalCloudSync(userSession.hospitalId);
  }, [userSession?.hospitalId]);

  // Force logout when Auth revoked / staff removed
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

  // Staff presence + network notifications
  useEffect(() => {
    const badgeId = userSession?.badgeId;
    const hospitalId = userSession?.hospitalId;
    if (!hospitalId || !badgeId) return;
    const stopHb = startStaffPresenceHeartbeat({
      badgeId,
      facilityId: hospitalId,
      name: userSession?.name || badgeId,
      roleKey: userSession?.roleKey || '',
      role: userSession?.role,
    });
    const stopListen = startFacilityPresenceListener(hospitalId);
    const stopNotif = startNetworkNotificationListener(hospitalId);
    return () => {
      stopHb();
      stopListen();
      stopNotif();
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
