'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export const ScrollToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      
      setIsVisible(scrollTop > 260);
      
      if (scrollHeight > 0) {
        setScrollPct(Math.min(100, Math.round((scrollTop / scrollHeight) * 100)));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) return null;

  return (
    <button
      type="button"
      className="dash-back-to-top-btn"
      onClick={scrollToTop}
      aria-label="Scroll back to top"
      title={`Scrolled ${scrollPct}% — Click to return to top`}
    >
      <div className="dash-btt-ring-wrap">
        <svg className="dash-btt-svg-ring" viewBox="0 0 36 36">
          <path
            className="dash-btt-ring-bg"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className="dash-btt-ring-fill"
            strokeDasharray={`${scrollPct}, 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <ArrowUp size={16} className="dash-btt-icon" />
      </div>
      <span className="dash-btt-text">Back to Top</span>
      <span className="dash-btt-pct">{scrollPct}%</span>
    </button>
  );
};
