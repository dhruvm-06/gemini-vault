import React from 'react';

export type BrandMarkSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
export type BrandMarkVariant = 'gold' | 'monochrome' | 'currentColor';

interface VaultBrandMarkProps {
  size?: BrandMarkSize;
  variant?: BrandMarkVariant;
  animate?: boolean;
  className?: string;
  ariaLabel?: string;
}

const SIZE_MAP: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
  xs: 16,
  sm: 20,
  md: 28,
  lg: 36,
  xl: 48,
};

export const VaultBrandMark: React.FC<VaultBrandMarkProps> = ({
  size = 'md',
  variant = 'gold',
  animate = false,
  className = '',
  ariaLabel = 'Gemini Vault brand mark',
}) => {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 28;

  // Color resolutions by variant
  const isGold = variant === 'gold';
  const isCurrent = variant === 'currentColor';

  const ringStroke = isGold ? 'var(--gv-accent-gold, #fbbf24)' : isCurrent ? 'currentColor' : '#fafaf9';
  const petalStroke = isGold ? 'var(--gv-accent, #f59e0b)' : isCurrent ? 'currentColor' : '#fafaf9';
  const petalFill = isGold ? 'var(--gv-accent-muted, rgba(245, 158, 11, 0.14))' : 'transparent';
  const nodeFill = isGold ? 'var(--gv-accent-gold, #fbbf24)' : isCurrent ? 'currentColor' : '#fafaf9';
  const centerFill = isGold ? '#ffffff' : isCurrent ? 'currentColor' : '#0c0a09';

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`vault-brand-mark ${animate ? 'animate-pulse' : ''} ${className}`}
      role="img"
      aria-label={ariaLabel}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      {/* Outer Celestial Boundary Ring */}
      <circle
        cx="16"
        cy="16"
        r="13"
        stroke={ringStroke}
        strokeWidth="1.25"
        strokeOpacity={isGold ? 0.75 : 0.6}
      />

      {/* 4 Cardinal Orbital Nodes */}
      <circle cx="16" cy="3" r="0.9" fill={nodeFill} />
      <circle cx="29" cy="16" r="0.9" fill={nodeFill} />
      <circle cx="16" cy="29" r="0.9" fill={nodeFill} />
      <circle cx="3" cy="16" r="0.9" fill={nodeFill} />

      {/* Sacred Lens Aperture — Vertical Vesica Petal */}
      <path
        d="M 16 6 C 21.5 11, 21.5 21, 16 26 C 10.5 21, 10.5 11, 16 6 Z"
        stroke={petalStroke}
        strokeWidth="1.15"
        fill={petalFill}
      />

      {/* Sacred Lens Aperture — Horizontal Vesica Petal */}
      <path
        d="M 6 16 C 11 21.5, 21 21.5, 26 16 C 21 10.5, 11 10.5, 6 16 Z"
        stroke={petalStroke}
        strokeWidth="1.15"
        fill={petalFill}
      />

      {/* Radiant Focal Core Ring */}
      <circle
        cx="16"
        cy="16"
        r="3.2"
        stroke={petalStroke}
        strokeWidth="1"
        fill={isGold ? 'var(--gv-accent, #f59e0b)' : 'transparent'}
        fillOpacity={isGold ? 0.45 : 0}
      />

      {/* Central Hearth Spark */}
      <circle
        cx="16"
        cy="16"
        r="1.4"
        fill={centerFill}
      />
    </svg>
  );
};

export default VaultBrandMark;
