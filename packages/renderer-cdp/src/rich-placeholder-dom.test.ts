// packages/renderer-cdp/src/rich-placeholder-dom.test.ts
// DOM-level behavioural tests for the rich-placeholder host. String-
// presence checks live in `puppeteer-session.test.ts`; this file
// drives the exported `richPlaceholderControllerScript` directly
// against happy-dom so the frame-reactive visibility logic (and the
// `visible: false` editorial hide) get actual end-to-end coverage.
//
// Uses the `@vitest-environment happy-dom` pragma so only this file
// pays the DOM cost; the rest of the package keeps running under the
// node environment.

/**
 * @vitest-environment happy-dom
 */

import type { RIRDocument, RIRElement } from '@stageflip/rir';
import { beforeEach, describe, expect, it } from 'vitest';

import { richPlaceholderControllerScript } from './puppeteer-session';

function shapeElement(
  id: string,
  timing: { startFrame: number; endFrame: number },
  overrides: Partial<RIRElement> = {},
): RIRElement {
  return {
    id,
    type: 'shape',
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    timing: { ...timing, durationFrames: timing.endFrame - timing.startFrame },
    zIndex: 0,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: { type: 'shape', shape: 'rect', fill: '#336699' },
    ...overrides,
  } as RIRElement;
}

function mkDoc(elements: RIRElement[]): RIRDocument {
  return {
    id: 'dom-test',
    width: 320,
    height: 240,
    frameRate: 30,
    durationFrames: 30,
    mode: 'slide',
    elements,
    stackingMap: {},
    fontRequirements: [],
    meta: {
      sourceDocId: 'src',
      sourceVersion: 1,
      compilerVersion: '0.0.0-test',
      digest: 'test',
    },
  };
}

/** Create a fresh root div under document.body using DOM APIs only. */
function freshRoot(): HTMLElement {
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
  const root = document.createElement('div');
  root.id = '__sf_root';
  document.body.appendChild(root);
  return root;
}

describe('richPlaceholderControllerScript — DOM behaviour', () => {
  beforeEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
  });

  it('hides elements whose frame falls outside [startFrame, endFrame)', () => {
    const doc = mkDoc([
      shapeElement('early', { startFrame: 0, endFrame: 10 }),
      shapeElement('late', { startFrame: 20, endFrame: 30 }),
    ]);
    const root = freshRoot();
    const { setFrame } = richPlaceholderControllerScript(doc, root);
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.__sf_el'));
    const [early, late] = nodes;
    if (!early || !late) throw new Error('expected two nodes');

    setFrame(5);
    expect(early.style.display).toBe('');
    expect(late.style.display).toBe('none');

    setFrame(25);
    expect(early.style.display).toBe('none');
    expect(late.style.display).toBe('');

    setFrame(15);
    expect(early.style.display).toBe('none');
    expect(late.style.display).toBe('none');
  });

  it('treats endFrame as exclusive', () => {
    const doc = mkDoc([shapeElement('el', { startFrame: 0, endFrame: 10 })]);
    const root = freshRoot();
    const { setFrame } = richPlaceholderControllerScript(doc, root);
    const el = root.querySelector<HTMLElement>('.__sf_el');
    if (!el) throw new Error('expected one node');

    setFrame(9);
    expect(el.style.display).toBe('');
    setFrame(10);
    expect(el.style.display).toBe('none');
  });

  it('honours element.visible = false even inside the timing window', () => {
    const doc = mkDoc([
      shapeElement('visible-el', { startFrame: 0, endFrame: 30 }),
      shapeElement('hidden-el', { startFrame: 0, endFrame: 30 }, { visible: false }),
    ]);
    const root = freshRoot();
    const { setFrame } = richPlaceholderControllerScript(doc, root);
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.__sf_el'));
    const [visibleEl, hiddenEl] = nodes;
    if (!visibleEl || !hiddenEl) throw new Error('expected two nodes');

    setFrame(10);
    expect(visibleEl.style.display).toBe('');
    expect(hiddenEl.style.display).toBe('none');
  });

  it('applies transform dimensions + opacity + zIndex to each element node', () => {
    const doc = mkDoc([
      shapeElement(
        'sized',
        { startFrame: 0, endFrame: 30 },
        {
          transform: { x: 12, y: 34, width: 56, height: 78, rotation: 45, opacity: 0.5 },
          zIndex: 7,
        },
      ),
    ]);
    const root = freshRoot();
    richPlaceholderControllerScript(doc, root);
    const el = root.querySelector<HTMLElement>('.__sf_el');
    if (!el) throw new Error('expected one node');
    expect(el.style.left).toBe('12px');
    expect(el.style.top).toBe('34px');
    expect(el.style.width).toBe('56px');
    expect(el.style.height).toBe('78px');
    expect(el.style.opacity).toBe('0.5');
    expect(el.style.zIndex).toBe('7');
    expect(el.style.transform).toBe('rotate(45deg)');
  });

  it('renders text elements with individual font properties (no CSS shorthand)', () => {
    const doc = mkDoc([
      {
        id: 'title',
        type: 'text',
        transform: { x: 0, y: 0, width: 200, height: 40, rotation: 0, opacity: 1 },
        timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
        zIndex: 0,
        visible: true,
        locked: false,
        stacking: 'auto',
        animations: [],
        content: {
          type: 'text',
          text: 'Hello',
          // Multi-word family would break the CSS shorthand. Using
          // individual properties sidesteps the quoting rule.
          fontFamily: 'Inter Tight',
          fontSize: 24,
          fontWeight: 600,
          color: '#fefefe',
          align: 'left',
          lineHeight: 1.2,
        },
      } as RIRElement,
    ]);
    const root = freshRoot();
    richPlaceholderControllerScript(doc, root);
    const el = root.querySelector<HTMLElement>('.__sf_el');
    if (!el) throw new Error('expected one node');
    expect(el.style.fontFamily).toContain('Inter Tight');
    expect(el.style.fontSize).toBe('24px');
    expect(el.style.fontWeight).toBe('600');
    expect(el.textContent).toBe('Hello');
  });

  it('renders clip elements as labelled placeholder boxes', () => {
    const doc = mkDoc([
      {
        id: 'the-clip',
        type: 'clip',
        transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
        timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
        zIndex: 0,
        visible: true,
        locked: false,
        stacking: 'auto',
        animations: [],
        content: { type: 'clip', runtime: 'css', clipName: 'solid-background', params: {} },
      } as RIRElement,
    ]);
    const root = freshRoot();
    richPlaceholderControllerScript(doc, root);
    const el = root.querySelector<HTMLElement>('.__sf_el');
    if (!el) throw new Error('expected one node');
    expect(el.className).toContain('__sf_clip_placeholder');
    expect(el.textContent).toContain('CLIP the-clip');
  });

  it('applies shape fill + ellipse border-radius', () => {
    const doc = mkDoc([
      shapeElement(
        'circle',
        { startFrame: 0, endFrame: 30 },
        {
          content: { type: 'shape', shape: 'ellipse', fill: 'rgb(10, 20, 30)' },
        },
      ),
    ]);
    const root = freshRoot();
    richPlaceholderControllerScript(doc, root);
    const el = root.querySelector<HTMLElement>('.__sf_el');
    if (!el) throw new Error('expected one node');
    expect(el.style.background).not.toBe('');
    expect(el.style.borderRadius).toBe('50%');
  });
});
