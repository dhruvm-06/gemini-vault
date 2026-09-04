import React from 'react';
import '../styles/presence.css';

export type VaultPresenceState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'reconnecting'
  | 'ended';

export type VaultPresenceSize = 'micro' | 'compact' | 'medium' | 'large' | 'hero';

export interface VaultPresenceProps {
  state?: VaultPresenceState;
  size?: VaultPresenceSize;
  audioReactivity?: number;
  className?: string;
  label?: string;
}

export const VaultPresence: React.FC<VaultPresenceProps> = ({
  state = 'idle',
  size = 'large',
  audioReactivity = 0,
  className = '',
  label,
}) => {
  const isMicro = size === 'micro';
  const ariaText = label || `Gemini Vault intelligence core: ${state}`;

  return (
    <div
      className={`vault-presence-container ${className}`}
      data-state={state}
      data-size={size}
      style={{
        '--gv-presence-reactivity': audioReactivity,
      } as React.CSSProperties}
      role="img"
      aria-label={ariaText}
    >
      {/* Diffused atmospheric aura */}
      <div className="vault-presence-aura" aria-hidden="true" />

      {/* Pure SVG Celestial Geometry */}
      <svg
        className="vault-presence-svg"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Radial Gradient for Core Focal Star */}
          <radialGradient
            id="gv-presence-core-gradient"
            cx="50%"
            cy="50%"
            r="50%"
            fx="50%"
            fy="50%"
          >
            <stop offset="0%" stopColor="var(--gv-presence-core)" stopOpacity="1" />
            <stop offset="45%" stopColor="var(--gv-presence-ring)" stopOpacity="0.75" />
            <stop offset="85%" stopColor="var(--gv-presence-ring)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--gv-presence-ring)" stopOpacity="0" />
          </radialGradient>

          {/* Glow Filter for Inner Astrolabe Node */}
          <radialGradient
            id="gv-presence-node-gradient"
            cx="50%"
            cy="50%"
            r="50%"
          >
            <stop offset="0%" stopColor="var(--gv-presence-core)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--gv-presence-core)" stopOpacity="0.2" />
          </radialGradient>
        </defs>

        {!isMicro && (
          <>
            {/* Celestial Outer Orbital Ring (Slow Organic Drift) */}
            <g className="vault-presence-orbital-ring">
              <circle
                cx="100"
                cy="100"
                r="88"
                stroke="var(--gv-presence-ring)"
                strokeWidth="1"
                strokeDasharray="3 9"
                strokeOpacity="0.4"
              />
              {/* Orbital Starlight Nodes */}
              <circle cx="100" cy="12" r="3" fill="var(--gv-presence-core)" fillOpacity="0.9" />
              <circle cx="188" cy="100" r="2" fill="var(--gv-presence-ring)" fillOpacity="0.6" />
              <circle cx="100" cy="188" r="2.5" fill="var(--gv-presence-core)" fillOpacity="0.75" />
              <circle cx="12" cy="100" r="2" fill="var(--gv-presence-ring)" fillOpacity="0.6" />
            </g>

            {/* Concentric Harmonic Resonator (Gentle Breathing Rhythm) */}
            <g className="vault-presence-resonator">
              <circle
                cx="100"
                cy="100"
                r="68"
                stroke="var(--gv-presence-ring)"
                strokeWidth="1.25"
                strokeOpacity="0.5"
              />
              <circle
                cx="100"
                cy="100"
                r="50"
                stroke="var(--gv-presence-core)"
                strokeWidth="1"
                strokeDasharray="4 6"
                strokeOpacity="0.6"
              />
            </g>

            {/* Celestial Petal Lattice (Inner Symmetrical Aperture) */}
            <g className="vault-presence-lattice">
              {/* Vertical Lens Petal */}
              <path
                d="M 100 48 C 128 72 128 128 100 152 C 72 128 72 72 100 48 Z"
                stroke="var(--gv-presence-ring)"
                strokeWidth="0.85"
                strokeOpacity="0.5"
                fill="none"
              />
              {/* Horizontal Lens Petal */}
              <path
                d="M 48 100 C 72 128 128 128 152 100 C 128 72 72 72 48 100 Z"
                stroke="var(--gv-presence-ring)"
                strokeWidth="0.85"
                strokeOpacity="0.5"
                fill="none"
              />
            </g>
          </>
        )}

        {/* Luminous Core Star */}
        <g className="vault-presence-core">
          {/* Diffused Core Halo */}
          <circle
            cx="100"
            cy="100"
            r={isMicro ? 36 : 28}
            fill="url(#gv-presence-core-gradient)"
          />
          {/* Concentric Inner Heart Ring */}
          <circle
            cx="100"
            cy="100"
            r={isMicro ? 18 : 14}
            stroke="var(--gv-presence-core)"
            strokeWidth="1.25"
            strokeOpacity="0.75"
            fill="url(#gv-presence-node-gradient)"
          />
          {/* Celestial Hearth Spark */}
          <circle
            cx="100"
            cy="100"
            r={isMicro ? 6 : 4.5}
            fill="#ffffff"
            fillOpacity="0.95"
          />
        </g>
      </svg>

      <span className="sr-only">{ariaText}</span>
    </div>
  );
};
