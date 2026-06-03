'use client';

import React, { useEffect, useState } from 'react';
import { Smartphone, Tablet, Monitor, AlertCircle } from 'lucide-react';

export const MobileBlocker: React.FC = () => {
  const [shouldBlock, setShouldBlock] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    let timeoutId: NodeJS.Timeout;

    const applyBlockState = (isMobile: boolean) => {
      setShouldBlock(isMobile);
      if (isMobile) {
        document.body.classList.add('mobile-blocked');
      } else {
        document.body.classList.remove('mobile-blocked');
      }
    };

    const checkViewport = () => {
      applyBlockState(mediaQuery.matches);
    };

    // Detect if this is a mobile phone user agent (excludes iPad and desktop Mac/Windows)
    const isMobileUA = /iphone|ipod|mobile/i.test(navigator.userAgent);

    if (isMobileUA && mediaQuery.matches) {
      // If it is a mobile device and matches mobile query, block instantly
      applyBlockState(true);
    } else {
      // For desktops/tablets, debounce the initial check to filter out transient DevTools viewport sizes
      timeoutId = setTimeout(checkViewport, 150);
    }

    // High performance listener that fires ONLY when crossing the 768px boundary
    const handleChange = () => {
      clearTimeout(timeoutId);
      // Debounce the change event to filter out transient resizing/Inspect pane toggles
      timeoutId = setTimeout(checkViewport, 150);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      clearTimeout(timeoutId);
      mediaQuery.removeEventListener('change', handleChange);
      document.body.classList.remove('mobile-blocked');
    };
  }, []);

  if (!shouldBlock) {
    return null;
  }

  return (
    <div className="mobile-view-blocker">
      <div className="mobile-blocker-card">
        {/* Header Brand Info */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          <img src="/logo.png" alt="Shopbook Logo" style={{ height: '52px', width: 'auto' }} />
          <span style={{ fontWeight: 600, fontSize: '20px', color: '#0f172a', letterSpacing: '-0.3px' }}>Mini POS</span>
        </div>

        <div className="mobile-blocker-icon-container">
          <Smartphone size={36} />
          <div className="mobile-blocker-badge">
            <AlertCircle size={14} style={{ fill: '#dc2626', color: '#ffffff' }} />
          </div>
        </div>

        <h1 className="mobile-blocker-title">Mobile View Unavailable</h1>
        <p className="mobile-blocker-desc">
          To ensure a premium point-of-sale experience, the Shopbook web terminal is optimized exclusively for tablet and desktop viewports.
        </p>

        <div className="mobile-blocker-divider" />

        <div className="mobile-blocker-devices">
          <div className="mobile-blocker-device-item allowed">
            <div className="mobile-blocker-device-icon">
              <Monitor size={18} />
            </div>
            <div className="mobile-blocker-device-info">
              <span className="mobile-blocker-device-name">Desktop View</span>
              <span className="mobile-blocker-device-status">Supported / Optimized</span>
            </div>
          </div>

          <div className="mobile-blocker-device-item allowed">
            <div className="mobile-blocker-device-icon">
              <Tablet size={18} />
            </div>
            <div className="mobile-blocker-device-info">
              <span className="mobile-blocker-device-name">Tablet View</span>
              <span className="mobile-blocker-device-status">Supported / Optimized</span>
            </div>
          </div>

          <div className="mobile-blocker-device-item blocked">
            <div className="mobile-blocker-device-icon">
              <Smartphone size={18} />
            </div>
            <div className="mobile-blocker-device-info">
              <span className="mobile-blocker-device-name">Mobile View</span>
              <span className="mobile-blocker-device-status">Blocked (Please use Mobile App)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
