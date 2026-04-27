// packages/collab/src/commands/slide-commands.ts
// Slide-level commands. Each emits one Y.Doc transaction and one ChangeSet
// per ADR-006 §D3 / T-260 ACs #22–#24.

import * as Y from 'yjs';
import { buildSlideMap, getSlideIndex, getSlidesArray } from '../binding.js';
import type { CommandArgs, CommandFn } from './index.js';
import { makeChangeSet } from './index.js';
import { applyTextDiff } from './text-diff.js';

const slidesPath = '/content/slides';

export const addSlideCommand: CommandFn<CommandArgs['addSlide']> = async (ctx, args) => {
  const slidesArr = getSlidesArray(ctx.ydoc);
  if (!slidesArr) throw new Error('addSlide: document is not in slide mode');
  ctx.ydoc.transact(() => {
    const map = buildSlideMap(args.slide);
    if (args.index === undefined) slidesArr.push([map]);
    else slidesArr.insert(args.index, [map]);
  });
  const path = args.index === undefined ? `${slidesPath}/-` : `${slidesPath}/${String(args.index)}`;
  const cs = makeChangeSet(ctx, [{ op: 'add', path, value: args.slide }]);
  await ctx.emit(cs);
};

export const removeSlideCommand: CommandFn<CommandArgs['removeSlide']> = async (ctx, args) => {
  const slidesArr = getSlidesArray(ctx.ydoc);
  if (!slidesArr) throw new Error('removeSlide: document is not in slide mode');
  const idx = getSlideIndex(ctx.ydoc, args.slideId);
  if (idx < 0) throw new Error(`removeSlide: slide ${args.slideId} not found`);
  ctx.ydoc.transact(() => {
    slidesArr.delete(idx, 1);
  });
  const cs = makeChangeSet(ctx, [{ op: 'remove', path: `${slidesPath}/${String(idx)}` }]);
  await ctx.emit(cs);
};

export const reorderSlidesCommand: CommandFn<CommandArgs['reorderSlides']> = async (ctx, args) => {
  const slidesArr = getSlidesArray(ctx.ydoc);
  if (!slidesArr) throw new Error('reorderSlides: document is not in slide mode');
  if (args.fromIdx === args.toIdx) return;
  if (args.fromIdx < 0 || args.fromIdx >= slidesArr.length) {
    throw new Error(`reorderSlides: fromIdx ${String(args.fromIdx)} out of range`);
  }
  if (args.toIdx < 0 || args.toIdx >= slidesArr.length) {
    throw new Error(`reorderSlides: toIdx ${String(args.toIdx)} out of range`);
  }
  ctx.ydoc.transact(() => {
    const moving = slidesArr.get(args.fromIdx) as Y.Map<unknown>;
    // Read structural copy, delete, then re-insert. Y.Array has no native
    // move; this is the documented pattern.
    const json = moving.toJSON();
    slidesArr.delete(args.fromIdx, 1);
    slidesArr.insert(args.toIdx, [buildSlideMap(json as Parameters<typeof buildSlideMap>[0])]);
  });
  const cs = makeChangeSet(ctx, [
    {
      op: 'move',
      from: `${slidesPath}/${String(args.fromIdx)}`,
      path: `${slidesPath}/${String(args.toIdx)}`,
    },
  ]);
  await ctx.emit(cs);
};

export const setSlideTitleCommand: CommandFn<CommandArgs['setSlideTitle']> = async (ctx, args) => {
  const slidesArr = getSlidesArray(ctx.ydoc);
  if (!slidesArr) throw new Error('setSlideTitle: document is not in slide mode');
  const idx = getSlideIndex(ctx.ydoc, args.slideId);
  if (idx < 0) throw new Error(`setSlideTitle: slide ${args.slideId} not found`);
  ctx.ydoc.transact(() => {
    const slide = slidesArr.get(idx) as Y.Map<unknown>;
    slide.set('title', args.title);
  });
  const cs = makeChangeSet(ctx, [
    { op: 'replace', path: `${slidesPath}/${String(idx)}/title`, value: args.title },
  ]);
  await ctx.emit(cs);
};

export const setSlideNotesCommand: CommandFn<CommandArgs['setSlideNotes']> = async (ctx, args) => {
  // slide.notes is a Y.Text — diff and emit minimal Y.Text edits.
  const slidesArr = getSlidesArray(ctx.ydoc);
  if (!slidesArr) throw new Error('setSlideNotes: document is not in slide mode');
  const idx = getSlideIndex(ctx.ydoc, args.slideId);
  if (idx < 0) throw new Error(`setSlideNotes: slide ${args.slideId} not found`);
  const slide = slidesArr.get(idx) as Y.Map<unknown>;
  const notes = slide.get('notes');
  ctx.ydoc.transact(() => {
    if (notes instanceof Y.Text) {
      applyTextDiff(notes, notes.toString(), args.notes);
    } else {
      slide.set('notes', new Y.Text(args.notes));
    }
  });
  const path = `${slidesPath}/${String(idx)}/notes`;
  ctx.emitDebounced(`slide-notes:${args.slideId}`, () =>
    makeChangeSet(ctx, [{ op: 'replace', path, value: args.notes }]),
  );
};
