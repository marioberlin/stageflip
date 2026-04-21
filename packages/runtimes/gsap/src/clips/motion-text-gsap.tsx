// packages/runtimes/gsap/src/clips/motion-text-gsap.tsx
// Canonical gsap-runtime demo: animates text in with either a slide-up or
// fade entrance. Scanned by check-determinism (file lives under
// src/clips/**). Uses gsap.timeline().from() exclusively; no wall-clock
// APIs, no Math.random, no timers.

import { type ReactElement, createElement } from 'react';

import { type GsapTimelineBuild, defineGsapClip } from '../index.js';

export interface MotionTextGsapProps {
  text: string;
  /** 'slide-up' (default) or 'fade'. */
  entrance?: 'slide-up' | 'fade';
  /** Entrance duration in seconds. Default 0.6. */
  durationSec?: number;
}

const TEXT_ATTR = 'data-motion-text';

const renderText = (props: MotionTextGsapProps): ReactElement =>
  createElement(
    'span',
    {
      [TEXT_ATTR]: '',
      style: {
        display: 'inline-block',
        fontSize: 96,
        fontWeight: 700,
        letterSpacing: '-0.04em',
        color: '#fff',
      },
    },
    props.text,
  );

const buildTimeline: GsapTimelineBuild<MotionTextGsapProps> = (props, timeline, container) => {
  const target = container.querySelector(`[${TEXT_ATTR}]`);
  if (target === null) return;
  const duration = props.durationSec ?? 0.6;
  const entrance = props.entrance ?? 'slide-up';
  if (entrance === 'fade') {
    timeline.from(target, { opacity: 0, duration, ease: 'power2.out' });
  } else {
    timeline.from(target, { y: 60, opacity: 0, duration, ease: 'power2.out' });
  }
};

/** Canonical gsap-runtime demo clip. */
export const motionTextGsap = defineGsapClip<MotionTextGsapProps>({
  kind: 'motion-text-gsap',
  render: renderText,
  build: buildTimeline,
});
