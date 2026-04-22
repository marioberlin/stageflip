// apps/stageflip-slide/src/components/properties/clip-element-properties.tsx
// Clip-element branch of the properties panel (T-125b).

/**
 * Resolves the currently selected `ClipElement` to its registered
 * `ClipDefinition` via `@stageflip/runtimes-contract`'s `findClip`, then
 * renders a `<ZodForm>` over the clip's `propsSchema`. Commits write back
 * to `element.params` through `useDocument().updateDocument`, so T-133's
 * undo interceptor captures one entry per field commit.
 *
 * Three fallbacks:
 *   - The clip's kind is not registered in any runtime → unknown-runtime
 *     notice. Happens when a document references a clip that no host app
 *     has registered.
 *   - The clip is registered but exposes no `propsSchema` → no-schema
 *     notice. Clips that haven't yet been ported (T-131) may not declare
 *     a schema; editors still open without crashing.
 *   - The document is in a non-slide mode when commit lands → no-op;
 *     `applyParamsPatch` returns the document unchanged.
 *
 * T-125b intentionally ignores `element.runtime`: `findClip(kind)` walks
 * every runtime and returns the first match. If two runtimes ship the
 * same kind (migration window), the first registered wins — same rule as
 * the RIR dispatcher (T-083).
 */

'use client';

import { ZodForm, t, useDocument } from '@stageflip/editor-shell';
import { findClip } from '@stageflip/runtimes-contract';
import type { ClipElement, Document } from '@stageflip/schema';
import { type ReactElement, useCallback } from 'react';

export interface ClipElementPropertiesProps {
  slideId: string;
  element: ClipElement;
}

export function ClipElementProperties({
  slideId,
  element,
}: ClipElementPropertiesProps): ReactElement {
  const { updateDocument } = useDocument();

  const onChange = useCallback(
    (next: Record<string, unknown>) => {
      if (element.locked) return;
      updateDocument((doc) => applyParamsPatch(doc, slideId, element.id, next));
    },
    [updateDocument, slideId, element.id, element.locked],
  );

  const found = findClip(element.clipName);
  if (!found) {
    return (
      <p data-testid="clip-unknown-runtime" style={noticeStyle}>
        {t('properties.clip.unknownRuntime')}
      </p>
    );
  }
  const schema = found.clip.propsSchema;
  if (!schema) {
    return (
      <p data-testid="clip-no-schema" style={noticeStyle}>
        {t('properties.clip.noSchema')}
      </p>
    );
  }

  return (
    <div data-testid="clip-element-properties">
      <ZodForm
        schema={schema}
        value={element.params}
        onChange={onChange}
        disabled={element.locked}
        title={t('properties.clip.title')}
      />
    </div>
  );
}

function applyParamsPatch(
  doc: Document,
  slideId: string,
  elementId: string,
  nextParams: Record<string, unknown>,
): Document {
  if (doc.content.mode !== 'slide') return doc;
  return {
    ...doc,
    content: {
      ...doc.content,
      slides: doc.content.slides.map((slide) =>
        slide.id === slideId
          ? {
              ...slide,
              elements: slide.elements.map((el) =>
                el.id === elementId && el.type === 'clip' ? { ...el, params: nextParams } : el,
              ),
            }
          : slide,
      ),
    },
  };
}

export const __test = { applyParamsPatch };

const noticeStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: '#5a6068',
  fontStyle: 'italic',
};
