// packages/runtimes/frame-runtime-bridge/src/clips/click-overlay.test.tsx
// T-202 — ClickOverlay clip behaviour + propsSchema + clipDefinition shape.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ClickOverlay,
  type ClickOverlayProps,
  clickOverlayClip,
  clickOverlayPropsSchema,
} from './click-overlay.js';

afterEach(cleanup);

function renderOverlay(props: ClickOverlayProps) {
  return render(
    <FrameProvider frame={0} config={{ width: 300, height: 250, fps: 24, durationInFrames: 360 }}>
      <ClickOverlay {...props} />
    </FrameProvider>,
  );
}

describe('<ClickOverlay>', () => {
  it('renders a full-canvas anchor with the supplied clickTag', () => {
    renderOverlay({ clickTag: 'https://example.com', ariaLabel: 'Visit example' });
    const el = screen.getByTestId('click-overlay-clip') as HTMLAnchorElement;
    expect(el.tagName).toBe('A');
    expect(el.getAttribute('href')).toBe('https://example.com');
    expect(el.style.inset).toBe('0');
    expect(el.style.position).toBe('absolute');
  });

  it('falls back to the IAB click macro when no clickTag is supplied', () => {
    renderOverlay({ ariaLabel: 'Click here' });
    const el = screen.getByTestId('click-overlay-clip');
    expect(el.getAttribute('href')).toBe('%%CLICK_URL_UNESC%%%%DEST_URL%%');
    expect(el.getAttribute('data-click-tag')).toBe('%%CLICK_URL_UNESC%%%%DEST_URL%%');
  });

  it('defaults to target=_blank with rel=noopener noreferrer', () => {
    renderOverlay({ ariaLabel: 'Click here' });
    const el = screen.getByTestId('click-overlay-clip');
    expect(el.getAttribute('target')).toBe('_blank');
    expect(el.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('omits rel when target is not _blank', () => {
    renderOverlay({ target: '_self', ariaLabel: 'Click here' });
    const el = screen.getByTestId('click-overlay-clip');
    expect(el.getAttribute('target')).toBe('_self');
    expect(el.getAttribute('rel')).toBeNull();
  });

  it('exposes the aria-label for screen readers', () => {
    renderOverlay({ ariaLabel: 'Buy now from Acme' });
    const el = screen.getByTestId('click-overlay-clip');
    expect(el.getAttribute('aria-label')).toBe('Buy now from Acme');
  });
});

describe('clickOverlayPropsSchema', () => {
  it('requires ariaLabel', () => {
    const result = clickOverlayPropsSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty ariaLabel', () => {
    const result = clickOverlayPropsSchema.safeParse({ ariaLabel: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty clickTag when the field is provided', () => {
    const result = clickOverlayPropsSchema.safeParse({ ariaLabel: 'x', clickTag: '' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown target values', () => {
    const result = clickOverlayPropsSchema.safeParse({ ariaLabel: 'x', target: 'new' });
    expect(result.success).toBe(false);
  });

  it('accepts a complete config', () => {
    const result = clickOverlayPropsSchema.safeParse({
      clickTag: 'https://example.com',
      target: '_blank',
      ariaLabel: 'Buy now',
    });
    expect(result.success).toBe(true);
  });
});

describe('clickOverlayClip', () => {
  it('declares the kind', () => {
    expect(clickOverlayClip.kind).toBe('click-overlay');
  });

  it('exposes the Zod propsSchema', () => {
    expect(clickOverlayClip).toHaveProperty('propsSchema');
  });

  it('declares no font requirements (purely structural)', () => {
    expect(clickOverlayClip.fontRequirements).toBeUndefined();
  });
});
