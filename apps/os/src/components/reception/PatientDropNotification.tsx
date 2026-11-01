'use client';

/**
 * PatientDropNotification — Zero-touch frontdesk patient check-in / "teleport" notification.
 *
 * Listens for incoming drops published via Firestore from the patient mobile app.
 * Renders an animated floating slide-in badge above the bottom toolbar.
 * Allows frontdesk staff to "Accept & Register" or "Dismiss".
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  subscribePatientDrop,
  clearPatientDrop,
  type PatientDropPayload,
} from '../../lib/frontdeskDrop';
import { UserCheck, X, Smartphone, ArrowRight, ShieldCheck } from 'lucide-react';
import { upsertPatient, generateHospitalNumber, type FacilityPatient } from '../../lib/patientRegistryStore';

interface PatientDropNotificationProps {
  facilityId?: string;
  deskId?: string;
  onPatientAccepted?: (patientId: string) => void;
}

export function PatientDropNotification({
  facilityId = 'LIGH',
  deskId = 'desk-1',
  onPatientAccepted,
}: PatientDropNotificationProps) {
  const [drop, setDrop] = useState<PatientDropPayload | null>(null);
  const [animatingOut, setAnimatingOut] = useState(false);

  useEffect(() => {
    const unsub = subscribePatientDrop(facilityId, deskId, (payload) => {
      if (payload) {
        setDrop(payload);
        setAnimatingOut(false);
      } else {
        setDrop(null);
      }
    });

    return () => unsub();
  }, [facilityId, deskId]);

  const handleDismiss = useCallback(async () => {
    setAnimatingOut(true);
    setTimeout(async () => {
      setDrop(null);
      setAnimatingOut(false);
      await clearPatientDrop(facilityId, deskId);
    }, 280);
  }, [facilityId, deskId]);

  const handleAccept = useCallback(async () => {
    if (!drop) return;
    try {
      const patientId = `PT-${Date.now().toString(36).toUpperCase()}`;
      upsertPatient({
        id: patientId,
        hospitalNumber: generateHospitalNumber(facilityId),
        firstName: drop.firstName,
        lastName: drop.lastName,
        dob: drop.dob,
        sex: 'Other',
        phone: drop.phone || '',
        email: drop.email || '',
        facilityId,
        facilityName: 'Hospital',
        status: 'active',
        registeredAt: new Date().toISOString(),
      });

      // Dispatch global toast
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('medcore-toast', {
            detail: {
              message: `Patient ${drop.firstName} ${drop.lastName} onboarded via Mobile Drop`,
            },
          })
        );
      }

      onPatientAccepted?.(patientId);
      await handleDismiss();
    } catch (e) {
      console.error('[PatientDrop] Failed to accept drop:', e);
      handleDismiss();
    }
  }, [drop, facilityId, deskId, handleDismiss, onPatientAccepted]);

  if (!drop) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 99998,
        maxWidth: 380,
        width: 'calc(100vw - 48px)',
        background: '#0F172A',
        color: '#F8FAFC',
        borderRadius: 16,
        boxShadow:
          '0 20px 40px -15px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1), 0 0 25px rgba(16, 185, 129, 0.25)',
        overflow: 'hidden',
        transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease',
        transform: animatingOut ? 'translateY(20px) scale(0.96)' : 'translateY(0) scale(1)',
        opacity: animatingOut ? 0 : 1,
        animation: 'slideInDrop 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes slideInDrop {
          from {
            transform: translateY(40px) scale(0.94);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>

      {/* Accent Emerald Strip */}
      <div
        style={{
          height: 4,
          background: 'linear-gradient(90deg, #10B981, #06B6D4, #6366F1)',
        }}
      />

      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34D399',
              }}
            >
              <Smartphone size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#F8FAFC' }}>
                  Mobile Teleport Arrived
                </span>
                <span
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#6EE7B7',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  Live
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>
                Patient dropped profile at Front Desk terminal
              </div>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>

        {/* Patient preview card */}
        <div
          style={{
            marginTop: 14,
            padding: '12px 14px',
            background: 'rgba(30, 41, 59, 0.7)',
            borderRadius: 10,
            border: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF' }}>
              {drop.firstName} {drop.lastName}
            </span>
            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
              DOB: {drop.dob}
            </span>
          </div>
          {drop.phone && (
            <div style={{ fontSize: '0.74rem', color: '#CBD5E1' }}>
              Tel: {drop.phone}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <ShieldCheck size={14} color="#34D399" />
            <span style={{ fontSize: '0.68rem', color: '#6EE7B7', fontFamily: 'monospace' }}>
              Token: {drop.temporaryToken.slice(0, 10)}...
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            onClick={handleDismiss}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(30, 41, 59, 0.5)',
              color: '#CBD5E1',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            style={{
              flex: 1.4,
              padding: '9px 14px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #10B981, #059669)',
              color: '#FFFFFF',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            <UserCheck size={15} />
            Accept & Admit
          </button>
        </div>
      </div>
    </div>
  );
}
export default PatientDropNotification;

