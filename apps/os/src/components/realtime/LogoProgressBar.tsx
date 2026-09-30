'use client';

/**
 * Logo + progressive bar — shows while an action is processing after a button click.
 */
import React from 'react';

interface Props {
  active: boolean;
  label?: string;
  /** compact = inline under button; overlay = full card veil */
  variant?: 'inline' | 'overlay';
}

export const LogoProgressBar: React.FC<Props> = ({
  active,
  label = 'Processing…',
  variant = 'inline',
}) => {
  if (!active) return null;

  const bar = (
    <div className="os-logo-progress" role="status" aria-live="polite" aria-busy="true">
      <div className="os-logo-progress-brand">
        <img src="/medcore-logo.png" alt="" className="os-logo-progress-img" width={28} height={28} />
        <span className="os-logo-progress-label">{label}</span>
      </div>
      <div className="os-logo-progress-track">
        <div className="os-logo-progress-fill" />
      </div>
    </div>
  );

  if (variant === 'overlay') {
    return <div className="os-logo-progress-overlay">{bar}</div>;
  }
  return bar;
};

export default LogoProgressBar;
