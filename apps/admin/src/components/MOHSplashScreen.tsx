'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  ShieldCheck,
  Database,
  Activity,
  CheckCircle2,
  ChevronRight,
  Landmark,
  Hospital,
  Wifi,
  Lock,
} from 'lucide-react';

interface MOHSplashScreenProps {
  onComplete: () => void;
}

interface BootStep {
  id: string;
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  duration: number;
}

const BOOT_STEPS: BootStep[] = [
  {
    id: 'sovereign',
    label: 'Akwa Ibom State Health Registry',
    detail: 'Connecting to State Health Headquarters, Idongesit Nkanga Secretariat, Uyo...',
    icon: Landmark,
    duration: 550,
  },
  {
    id: 'hospitals',
    label: 'State General Hospitals Network',
    detail: 'Polling census from general hospitals across Uyo, Ikot Ekpene, and Eket zones...',
    icon: Hospital,
    duration: 600,
  },
  {
    id: 'phc',
    label: 'Primary Healthcare & Immunization Hub',
    detail: 'Syncing maternal health clinics and cold-chain vaccine depots across 31 LGAs...',
    icon: Database,
    duration: 550,
  },
  {
    id: 'surveillance',
    label: 'State Disease Surveillance & Outbreak Response',
    detail: 'Checking epidemiological reports, cholera, lassa, and pediatric respiratory logs...',
    icon: Activity,
    duration: 650,
  },
  {
    id: 'telemetry',
    label: 'Live Hospital Telemetry & WebSocket Hub',
    detail: 'Activating real-time vital signs stream, bed board sync, and queue monitors...',
    icon: Wifi,
    duration: 500,
  },
  {
    id: 'security',
    label: 'Zero-Trust Security & Audit Ledger',
    detail: 'Verifying SHA-256 chained audit entries and ministerial access clearance...',
    icon: Lock,
    duration: 500,
  },
];

export const MOHSplashScreen: React.FC<MOHSplashScreenProps> = ({ onComplete }) => {
  // Phase 1: show full photo for 3s. Phase 2: slide in boot card and start steps.
  const [showCard, setShowCard] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  // Delay card by 3 seconds so adminsplash.png shows unobstructed
  useEffect(() => {
    const delay = setTimeout(() => setShowCard(true), 3000);
    return () => clearTimeout(delay);
  }, []);

  // Boot steps only start after card is visible
  useEffect(() => {
    if (!showCard) return;
    let timeoutId: NodeJS.Timeout;
    const currentStep = BOOT_STEPS[currentStepIndex];

    if (currentStep) {
      timeoutId = setTimeout(() => {
        setCompletedSteps((prev) => [...prev, currentStep.id]);
        const nextIndex = currentStepIndex + 1;
        const newProgress = Math.round((nextIndex / BOOT_STEPS.length) * 100);
        setProgress(newProgress);

        if (nextIndex < BOOT_STEPS.length) {
          setCurrentStepIndex(nextIndex);
        } else {
          setTimeout(() => onComplete(), 600);
        }
      }, currentStep.duration);
    }

    return () => clearTimeout(timeoutId);
  }, [showCard, currentStepIndex, onComplete]);

  return (
    <div className="moh-splash-fullscreen">
      {/* Full-bleed background — original Akwa Ibom state photo */}
      <div className="moh-splash-bg-layer">
        <Image
          src="/adminsplash.png"
          alt="Akwa Ibom State Government Headquarters"
          fill
          style={{ objectFit: 'cover', objectPosition: 'center' }}
          priority
          quality={90}
        />
      </div>

      {/* Emerald-gold fluid overlay (original colour theme) */}
      <div className="moh-splash-overlay" />

      {/* Skip button — always visible */}
      <button
        type="button"
        className="moh-splash-skip-btn"
        onClick={onComplete}
        aria-label="Skip to Ministry Portal"
      >
        <span>Skip to Ministry Portal</span>
        <ChevronRight size={14} />
      </button>

      {/* Boot card — slides in after 3s of full photo display */}
      {showCard && (
        <div className="moh-splash-boot-card">

          {/* Official crest row */}
          <div className="moh-splash-crest-row">
            <div className="moh-splash-seal-wrap">
              <Image
                src="/ibmlogo.png"
                alt="Government of Akwa Ibom State Official Crest"
                width={72}
                height={72}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <div className="moh-splash-crest-text">
              <span className="moh-splash-gov-line">GOVERNMENT OF</span>
              <span className="moh-splash-state-line">AKWA IBOM STATE</span>
              <span className="moh-splash-min-line">MINISTRY OF HEALTH</span>
            </div>
            <Image
              src="/arise-logo.png"
              alt="ARISE Agenda"
              width={80}
              height={36}
              style={{ objectFit: 'contain', marginLeft: 'auto' }}
              priority
            />
          </div>

          {/* Portal title */}
          <div className="moh-splash-title-block">
            <div className="moh-sovereign-tag">
              <ShieldCheck size={12} className="text-emerald-400" />
              <span>AKWA IBOM STATE GOVERNMENT</span>
              <span className="moh-tier-badge">MINISTRY OF HEALTH</span>
            </div>
            <h1 className="moh-splash-title">National Healthcare Command &amp; Regulatory Portal</h1>
            <p className="moh-splash-subtitle">
              Hospital Surveillance · Accreditation · Healthcare Financing · Outbreak Monitoring
            </p>
          </div>

          {/* Radar sweep banner */}
          <div className="moh-radar-sweep-bar">
            <div className="moh-radar-beam" />
            <span className="moh-radar-label">CONNECTING: IDONGESIT NKANGA SECRETARIAT COMPLEX, UYO</span>
          </div>

          {/* Progress bar */}
          <div className="moh-splash-progress-section">
            <div className="moh-progress-meta">
              <span>LOADING STATE HEALTH DIRECTORY ({Math.min(currentStepIndex + 1, BOOT_STEPS.length)}/{BOOT_STEPS.length})</span>
              <span className="moh-progress-pct">{progress}%</span>
            </div>
            <div className="moh-progress-track">
              <div className="moh-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Boot steps */}
          <div className="moh-splash-steps">
            {BOOT_STEPS.map((step, idx) => {
              const isDone = completedSteps.includes(step.id);
              const isCurrent = idx === currentStepIndex && !isDone;
              const StepIcon = step.icon;

              return (
                <div
                  key={step.id}
                  className={`moh-step-row ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                >
                  <div className="moh-step-icon">
                    {isDone ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : (
                      <StepIcon size={16} className={isCurrent ? 'text-amber-500' : 'text-slate-600'} />
                    )}
                  </div>
                  <div className="moh-step-body">
                    <div className="moh-step-label-line">
                      <span className="moh-step-name">{step.label}</span>
                      {isDone && <span className="moh-badge-verified">CONNECTED</span>}
                      {isCurrent && <span className="moh-badge-active">SYNCING...</span>}
                    </div>
                    {isCurrent && <p className="moh-step-desc">{step.detail}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="moh-splash-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="moh-status-dot pulse-amber" />
              <span>Akwa Ibom State Health Information System • MedCore v2.0</span>
            </div>
            <span>31 Local Government Areas</span>
          </div>
        </div>
      )}
    </div>
  );
};
