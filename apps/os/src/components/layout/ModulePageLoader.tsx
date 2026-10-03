'use client';

import React from 'react';

/** Brief page-switch loader — logo progress + shimmer skeleton */
export const ModulePageLoader: React.FC<{ label?: string }> = ({ label = 'Loading workspace…' }) => {
  return (
    <div className="mc-page-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="mc-page-loader-inner">
        <div className="mc-page-loader-logo">
          <img src="/medcore-logo.png" alt="" />
        </div>
        <div className="mc-page-loader-bar">
          <span className="mc-page-loader-bar-fill" />
        </div>
        <div className="mc-page-loader-label">{label}</div>
      </div>
      <div className="mc-page-loader-skeletons" aria-hidden>
        <div className="mc-skel mc-skel-hero" />
        <div className="mc-skel-row">
          <div className="mc-skel mc-skel-kpi" />
          <div className="mc-skel mc-skel-kpi" />
          <div className="mc-skel mc-skel-kpi" />
          <div className="mc-skel mc-skel-kpi" />
        </div>
        <div className="mc-skel mc-skel-panel" />
      </div>
    </div>
  );
};

export default ModulePageLoader;
