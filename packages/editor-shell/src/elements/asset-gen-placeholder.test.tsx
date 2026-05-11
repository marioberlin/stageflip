// packages/editor-shell/src/elements/asset-gen-placeholder.test.tsx
// T-438 — render + hook tests for the optimistic-placeholder visual.

import type { AudioElement, Document, ImageElement, VideoElement } from '@stageflip/schema';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import { Provider as JotaiProvider, createStore } from 'jotai';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { documentAtom } from '../atoms/document';
import {
  AssetGenPlaceholder,
  type AssetGenPlaceholderEntry,
  useAssetGenPlaceholders,
} from './asset-gen-placeholder';

afterEach(cleanup);

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const BASE_TRANSFORM = {
  x: 0,
  y: 0,
  width: 320,
  height: 200,
  rotation: 0,
  opacity: 1,
} as const;

function pendingImage(overrides: Partial<ImageElement['provenance']> = {}): ImageElement {
  return {
    id: 'el-pending-1',
    transform: { ...BASE_TRANSFORM },
    visible: true,
    locked: false,
    animations: [],
    type: 'image',
    src: 'asset:placeholder-1',
    fit: 'cover',
    provenance: {
      kind: 'asset-gen-pending',
      placeholderId: 'ph-abc',
      provider: 'image-fake',
      estimatedCompletionAt: '2026-05-11T00:00:30.000Z',
      ...overrides,
    },
  } as ImageElement;
}

function resolvedImage(): ImageElement {
  return {
    id: 'el-resolved-1',
    transform: { ...BASE_TRANSFORM },
    visible: true,
    locked: false,
    animations: [],
    type: 'image',
    src: 'asset:resolved-1',
    fit: 'cover',
    provenance: {
      kind: 'image-gen',
      provider: 'image-fake',
      cacheKey: 'a'.repeat(64),
    },
  } as ImageElement;
}

function plainImage(): ImageElement {
  return {
    id: 'el-plain',
    transform: { ...BASE_TRANSFORM },
    visible: true,
    locked: false,
    animations: [],
    type: 'image',
    src: 'asset:plain',
    fit: 'cover',
  } as ImageElement;
}

function pendingAudio(): AudioElement {
  return {
    id: 'el-audio',
    transform: { ...BASE_TRANSFORM },
    visible: true,
    locked: false,
    animations: [],
    type: 'audio',
    src: 'asset:audio-pending',
    loop: false,
    provenance: {
      kind: 'asset-gen-pending',
      placeholderId: 'ph-audio',
    },
  } as AudioElement;
}

function pendingVideo(): VideoElement {
  return {
    id: 'el-video',
    transform: { ...BASE_TRANSFORM },
    visible: true,
    locked: false,
    animations: [],
    type: 'video',
    src: 'asset:video-pending',
    muted: false,
    loop: false,
    playbackRate: 1,
    provenance: {
      kind: 'asset-gen-pending',
      placeholderId: 'ph-video',
      provider: 'video-seedance',
      estimatedCompletionAt: '2026-05-11T00:02:00.000Z',
    },
  } as VideoElement;
}

function makeDoc(slides: { id: string; elements: unknown[] }[]): Document {
  return {
    meta: {
      id: 'doc',
      version: 0,
      createdAt: '2026-05-11T00:00:00.000Z',
      updatedAt: '2026-05-11T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: { mode: 'slide', slides },
  } as unknown as Document;
}

/* -------------------------------------------------------------------------- */
/* <AssetGenPlaceholder>                                                       */
/* -------------------------------------------------------------------------- */

describe('<AssetGenPlaceholder>', () => {
  it('renders nothing when provenance is absent', () => {
    const { container } = render(<AssetGenPlaceholder element={plainImage()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when provenance.kind is a terminal variant', () => {
    const { container } = render(<AssetGenPlaceholder element={resolvedImage()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a greyed-out box + spinner + label for pending kind', () => {
    render(
      <AssetGenPlaceholder
        element={pendingImage()}
        nowMs={() => Date.parse('2026-05-11T00:00:00.000Z')}
      />,
    );
    const wrapper = screen.getByTestId('asset-gen-placeholder');
    expect(wrapper).toBeTruthy();
    expect(wrapper.getAttribute('data-placeholder-id')).toBe('ph-abc');
    expect(wrapper.getAttribute('data-element-type')).toBe('image');
    expect(screen.getByTestId('asset-gen-placeholder-spinner')).toBeTruthy();
    expect(screen.getByTestId('asset-gen-placeholder-label').textContent).toContain(
      'Generating image with image-fake',
    );
  });

  it('shows the provider name when present', () => {
    render(
      <AssetGenPlaceholder
        element={pendingImage({ provider: 'tts-kokoro' })}
        nowMs={() => Date.parse('2026-05-11T00:00:00.000Z')}
      />,
    );
    expect(screen.getByTestId('asset-gen-placeholder-label').textContent).toContain('tts-kokoro');
  });

  it('falls back to a generic label when provider is absent', () => {
    render(
      <AssetGenPlaceholder
        element={pendingImage({ provider: undefined })}
        nowMs={() => Date.parse('2026-05-11T00:00:00.000Z')}
      />,
    );
    expect(screen.getByTestId('asset-gen-placeholder-label').textContent).toContain(
      'asset generation',
    );
  });

  it('shows a countdown derived from estimatedCompletionAt', () => {
    render(
      <AssetGenPlaceholder
        element={pendingImage()}
        nowMs={() => Date.parse('2026-05-11T00:00:00.000Z')}
      />,
    );
    const countdown = screen.getByTestId('asset-gen-placeholder-countdown');
    // estimatedCompletionAt = 00:00:30; now = 00:00:00 => 30s remaining.
    expect(countdown.getAttribute('data-state')).toBe('pending');
    expect(countdown.textContent).toContain('ready in ~30s');
  });

  it('shows an indefinite spinner state when estimatedCompletionAt is absent', () => {
    render(
      <AssetGenPlaceholder
        element={pendingImage({ estimatedCompletionAt: undefined })}
        nowMs={() => Date.parse('2026-05-11T00:00:00.000Z')}
      />,
    );
    const countdown = screen.getByTestId('asset-gen-placeholder-countdown');
    expect(countdown.getAttribute('data-state')).toBe('indefinite');
    expect(countdown.textContent).toContain('working');
  });

  it('shows finishing-up state when the target time has passed', () => {
    render(
      <AssetGenPlaceholder
        element={pendingImage()}
        // 1 minute past the estimated completion.
        nowMs={() => Date.parse('2026-05-11T00:01:00.000Z')}
      />,
    );
    const countdown = screen.getByTestId('asset-gen-placeholder-countdown');
    expect(countdown.getAttribute('data-state')).toBe('overdue');
    expect(countdown.textContent).toContain('finishing up');
  });

  it('accepts a custom child to override the spinner', () => {
    render(
      <AssetGenPlaceholder
        element={pendingImage()}
        nowMs={() => Date.parse('2026-05-11T00:00:00.000Z')}
      >
        <span data-testid="custom-spinner">custom</span>
      </AssetGenPlaceholder>,
    );
    expect(screen.getByTestId('custom-spinner')).toBeTruthy();
    // Default spinner is absent because children override it.
    expect(screen.queryByTestId('asset-gen-placeholder-spinner')).toBeNull();
  });

  it('renders for audio element type', () => {
    render(
      <AssetGenPlaceholder
        element={pendingAudio()}
        nowMs={() => Date.parse('2026-05-11T00:00:00.000Z')}
      />,
    );
    expect(screen.getByTestId('asset-gen-placeholder').getAttribute('data-element-type')).toBe(
      'audio',
    );
  });

  it('renders for video element type', () => {
    render(
      <AssetGenPlaceholder
        element={pendingVideo()}
        nowMs={() => Date.parse('2026-05-11T00:00:00.000Z')}
      />,
    );
    expect(screen.getByTestId('asset-gen-placeholder').getAttribute('data-element-type')).toBe(
      'video',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* useAssetGenPlaceholders                                                     */
/* -------------------------------------------------------------------------- */

function wrapperWithStore(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <JotaiProvider store={store}>{children}</JotaiProvider>;
  };
}

describe('useAssetGenPlaceholders', () => {
  it('returns an empty array when the document is null', () => {
    const store = createStore();
    const { result } = renderHook(() => useAssetGenPlaceholders(), {
      wrapper: wrapperWithStore(store),
    });
    expect(result.current).toEqual([]);
  });

  it('returns an empty array when no elements are pending', () => {
    const store = createStore();
    store.set(documentAtom, makeDoc([{ id: 's1', elements: [resolvedImage(), plainImage()] }]));
    const { result } = renderHook(() => useAssetGenPlaceholders(), {
      wrapper: wrapperWithStore(store),
    });
    expect(result.current).toEqual([]);
  });

  it('returns a single entry when one element is pending', () => {
    const store = createStore();
    store.set(
      documentAtom,
      makeDoc([{ id: 's1', elements: [resolvedImage(), pendingImage(), plainImage()] }]),
    );
    const { result } = renderHook(() => useAssetGenPlaceholders(), {
      wrapper: wrapperWithStore(store),
    });
    expect(result.current).toHaveLength(1);
    const entry = result.current[0] as AssetGenPlaceholderEntry;
    expect(entry.slideId).toBe('s1');
    expect(entry.elementId).toBe('el-pending-1');
    expect(entry.elementType).toBe('image');
    expect(entry.placeholderId).toBe('ph-abc');
    expect(entry.provider).toBe('image-fake');
    expect(entry.estimatedCompletionAt).toBe('2026-05-11T00:00:30.000Z');
  });

  it('returns entries in document-order across multiple slides', () => {
    const store = createStore();
    store.set(
      documentAtom,
      makeDoc([
        { id: 's1', elements: [pendingImage(), resolvedImage()] },
        { id: 's2', elements: [pendingAudio()] },
        { id: 's3', elements: [pendingVideo(), pendingImage()] },
      ]),
    );
    const { result } = renderHook(() => useAssetGenPlaceholders(), {
      wrapper: wrapperWithStore(store),
    });
    expect(result.current).toHaveLength(4);
    expect(result.current[0]?.slideId).toBe('s1');
    expect(result.current[1]?.slideId).toBe('s2');
    expect(result.current[1]?.elementType).toBe('audio');
    expect(result.current[2]?.slideId).toBe('s3');
    expect(result.current[2]?.elementType).toBe('video');
    expect(result.current[3]?.slideId).toBe('s3');
    expect(result.current[3]?.elementType).toBe('image');
  });

  it('returns an empty array for a non-slide-mode document', () => {
    const store = createStore();
    const videoDoc = {
      meta: {
        id: 'doc',
        version: 0,
        createdAt: '2026-05-11T00:00:00.000Z',
        updatedAt: '2026-05-11T00:00:00.000Z',
        locale: 'en',
        schemaVersion: 1,
      },
      theme: { tokens: {} },
      variables: {},
      components: {},
      masters: [],
      layouts: [],
      content: { mode: 'video', tracks: [] },
    } as unknown as Document;
    store.set(documentAtom, videoDoc);
    const { result } = renderHook(() => useAssetGenPlaceholders(), {
      wrapper: wrapperWithStore(store),
    });
    expect(result.current).toEqual([]);
  });
});
