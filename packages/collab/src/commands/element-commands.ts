// packages/collab/src/commands/element-commands.ts
// Element-level commands. Per ADR-006 §D3 / T-260 ACs #25–#28.

import * as Y from 'yjs';
import { buildElementMap, getSlideIndex, getSlidesArray } from '../binding.js';
import type { CommandArgs, CommandFn } from './index.js';
import { makeChangeSet } from './index.js';
import { applyTextDiff } from './text-diff.js';

function locateElement(
  ydoc: Y.Doc,
  slideId: string,
  elementId: string,
): {
  slideIdx: number;
  elementIdx: number;
  elements: Y.Array<Y.Map<unknown>>;
  map: Y.Map<unknown>;
} {
  const slidesArr = getSlidesArray(ydoc);
  if (!slidesArr) throw new Error('locateElement: document is not in slide mode');
  const slideIdx = getSlideIndex(ydoc, slideId);
  if (slideIdx < 0) throw new Error(`locateElement: slide ${slideId} not found`);
  const slide = slidesArr.get(slideIdx) as Y.Map<unknown>;
  const elements = slide.get('elements') as Y.Array<Y.Map<unknown>> | undefined;
  if (!elements) throw new Error(`locateElement: slide ${slideId} has no elements array`);
  for (let i = 0; i < elements.length; i += 1) {
    const m = elements.get(i) as Y.Map<unknown>;
    if (m.get('id') === elementId) {
      return { slideIdx, elementIdx: i, elements, map: m };
    }
  }
  throw new Error(`locateElement: element ${elementId} not found on slide ${slideId}`);
}

export const addElementCommand: CommandFn<CommandArgs['addElement']> = async (ctx, args) => {
  const slidesArr = getSlidesArray(ctx.ydoc);
  if (!slidesArr) throw new Error('addElement: document is not in slide mode');
  const slideIdx = getSlideIndex(ctx.ydoc, args.slideId);
  if (slideIdx < 0) throw new Error(`addElement: slide ${args.slideId} not found`);
  ctx.ydoc.transact(() => {
    const slide = slidesArr.get(slideIdx) as Y.Map<unknown>;
    const elements = slide.get('elements') as Y.Array<Y.Map<unknown>>;
    const map = buildElementMap(args.element);
    if (args.index === undefined) elements.push([map]);
    else elements.insert(args.index, [map]);
  });
  const basePath = `/content/slides/${String(slideIdx)}/elements`;
  const path = args.index === undefined ? `${basePath}/-` : `${basePath}/${String(args.index)}`;
  const cs = makeChangeSet(ctx, [{ op: 'add', path, value: args.element }]);
  await ctx.emit(cs);
};

export const removeElementCommand: CommandFn<CommandArgs['removeElement']> = async (ctx, args) => {
  const { slideIdx, elementIdx, elements } = locateElement(ctx.ydoc, args.slideId, args.elementId);
  ctx.ydoc.transact(() => {
    elements.delete(elementIdx, 1);
  });
  const path = `/content/slides/${String(slideIdx)}/elements/${String(elementIdx)}`;
  const cs = makeChangeSet(ctx, [{ op: 'remove', path }]);
  await ctx.emit(cs);
};

export const updateElementTransformCommand: CommandFn<
  CommandArgs['updateElementTransform']
> = async (ctx, args) => {
  const { slideIdx, elementIdx, map } = locateElement(ctx.ydoc, args.slideId, args.elementId);
  ctx.ydoc.transact(() => {
    map.set('transform', { ...args.transform });
  });
  const path = `/content/slides/${String(slideIdx)}/elements/${String(elementIdx)}/transform`;
  const cs = makeChangeSet(ctx, [{ op: 'replace', path, value: args.transform }]);
  await ctx.emit(cs);
};

export const setTextRunCommand: CommandFn<CommandArgs['setTextRun']> = async (ctx, args) => {
  const { slideIdx, elementIdx, map } = locateElement(ctx.ydoc, args.slideId, args.elementId);
  if (map.get('type') !== 'text') {
    throw new Error(`setTextRun: element ${args.elementId} is not a text element`);
  }
  const yText = map.get('text');
  ctx.ydoc.transact(() => {
    if (yText instanceof Y.Text) {
      applyTextDiff(yText, yText.toString(), args.text);
    } else {
      map.set('text', new Y.Text(args.text));
    }
  });
  const path = `/content/slides/${String(slideIdx)}/elements/${String(elementIdx)}/text`;
  // AC #27 — debounce ChangeSet emission for Y.Text edits at 250 ms; the
  // Y.Doc transaction above is NOT debounced (provider handles its own
  // 50 ms debounce per AC #11).
  ctx.emitDebounced(`set-text:${args.slideId}:${args.elementId}`, () =>
    makeChangeSet(ctx, [{ op: 'replace', path, value: args.text }]),
  );
};
