import React from 'react';

interface LanternLogoProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

/**
 * Minecraft-style pixel lantern logo
 * Based on the in-game lantern item sprite
 */
const LanternLogo: React.FC<LanternLogoProps> = ({ size = 40, className = '', animate = true }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ imageRendering: 'pixelated' }}
    >
      {/* Glow effect */}
      {animate && (
        <defs>
          <filter id="lantern-glow">
            <feGaussianBlur stdDeviation="0.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <animate
            id="glow-pulse"
            attributeName="opacity"
            values="0.8;1;0.8"
            dur="2s"
            repeatCount="indefinite"
          />
        </defs>
      )}

      {/* Chain links at top */}
      <rect x="7" y="0" width="2" height="1" fill="#888888" />
      <rect x="7" y="1" width="2" height="1" fill="#aaaaaa" />

      {/* Top iron cap */}
      <rect x="5" y="2" width="6" height="1" fill="#5a5a5a" />
      <rect x="4" y="3" width="8" height="1" fill="#6e6e6e" />

      {/* Iron cage frame - top bar */}
      <rect x="3" y="4" width="10" height="1" fill="#7a7a7a" />

      {/* Flame core (inner glow) */}
      <rect x="6" y="5" width="4" height="5" fill="#ff9900" opacity="0.9" />
      <rect x="5" y="6" width="6" height="3" fill="#ffaa00" opacity="0.85" />

      {/* Flame center bright */}
      <rect x="7" y="6" width="2" height="2" fill="#ffffff" opacity="0.9" />
      <rect x="6" y="7" width="4" height="1" fill="#ffffaa" opacity="0.8" />

      {/* Iron cage sides */}
      <rect x="3" y="5" width="1" height="5" fill="#6e6e6e" />
      <rect x="12" y="5" width="1" height="5" fill="#6e6e6e" />

      {/* Iron cage vertical bars */}
      <rect x="5" y="5" width="1" height="5" fill="#5a5a5a" opacity="0.7" />
      <rect x="10" y="5" width="1" height="5" fill="#5a5a5a" opacity="0.7" />

      {/* Iron cage bottom bar */}
      <rect x="3" y="10" width="10" height="1" fill="#7a7a7a" />

      {/* Bottom cap */}
      <rect x="4" y="11" width="8" height="1" fill="#6e6e6e" />
      <rect x="5" y="12" width="6" height="1" fill="#5a5a5a" />

      {/* Bottom knob */}
      <rect x="6" y="13" width="4" height="1" fill="#444444" />
      <rect x="7" y="14" width="2" height="1" fill="#333333" />

      {/* Ambient glow overlay (animated) */}
      {animate && (
        <rect x="3" y="4" width="10" height="8" fill="#ffaa00" opacity="0" filter="url(#lantern-glow)">
          <animate attributeName="opacity" values="0.05;0.15;0.05" dur="2s" repeatCount="indefinite" />
        </rect>
      )}
    </svg>
  );
};

export default LanternLogo;
