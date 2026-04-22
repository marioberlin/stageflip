// apps/stageflip-slide/src/components/brand/logo.tsx
// StageFlip.Slide brand wordmark (T-134).

/**
 * A small SVG "flip" glyph + wordmark for the editor header and onboarding
 * surfaces. The mark is the word "SF" set in a rounded square with the
 * Abyssal Clarity primary gradient — small enough to read at 20–24 px and
 * distinct enough that users can scan for it in browser tabs once we wire
 * a favicon.
 *
 * Brand / mode split: the wordmark renders "StageFlip" and ".Slide" in
 * separate spans so CSS (or a consumer) can style the product name one
 * way and the mode suffix another without touching this component.
 *
 * Usage:
 *   <Logo />                 // default size, inline
 *   <Logo size={24} />       // override mark size
 *   <Logo className="..." /> // outer-element className hook
 */

'use client';

import type { CSSProperties, ReactElement } from 'react';

export interface LogoProps {
  /** SVG mark edge length in px. Defaults to 20. */
  size?: number;
  /** Forwarded to the outer span for layout hooks. */
  className?: string;
  /** Inline style overrides on the outer span. */
  style?: CSSProperties;
}

const GRADIENT_ID = 'stageflip-logo-gradient';

export function Logo({ size = 20, className, style }: LogoProps): ReactElement {
  return (
    <span
      data-testid="brand-logo"
      role="img"
      aria-label="StageFlip.Slide"
      className={className}
      style={{ ...rootStyle, ...(style ?? {}) }}
    >
      <svg
        data-testid="brand-logo-mark"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={GRADIENT_ID}
            x1="0"
            y1="0"
            x2="24"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#81aeff" />
            <stop offset="1" stopColor="#0072e5" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="22" height="22" rx="5" fill={`url(#${GRADIENT_ID})`} />
        <path
          d="M7.5 8.5 L13 8.5 M7.5 12 L11 12 M12.5 15.5 L16 12 L12.5 8.5"
          stroke="#ebf1fa"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {/*
       * The inner text spans mirror the `aria-label` on the outer element,
       * so we hide them from the accessibility tree to avoid the screen
       * reader announcing "StageFlip .Slide StageFlip.Slide".
       */}
      <span data-testid="brand-logo-brand" aria-hidden="true" style={brandStyle}>
        StageFlip
      </span>
      <span data-testid="brand-logo-mode" aria-hidden="true" style={modeStyle}>
        .Slide
      </span>
    </span>
  );
}

const rootStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: 0.01,
  color: '#ebf1fa',
};

const brandStyle: CSSProperties = {
  background: 'linear-gradient(135deg, #81aeff, #0072e5)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const modeStyle: CSSProperties = {
  color: '#5af8fb',
  fontWeight: 600,
};
