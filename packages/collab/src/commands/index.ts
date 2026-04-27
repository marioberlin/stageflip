// packages/collab/src/commands/index.ts
// Command registry — typed emitters that mutate the Y.Doc and emit a
// matching ChangeSet. Per ADR-006 §D3, every command emits BOTH a Y.Doc
// transaction (CRDT fan-out) AND a ChangeSet (audit / undo).

import type { Element, Slide } from '@stageflip/schema';
import type { ChangeSet, JsonPatchOp, StorageAdapter } from '@stageflip/storage';
import type * as Y from 'yjs';
import { buildChangeSet } from '../changeset.js';
import type { YjsStorageProvider } from '../provider.js';
import {
  addElementCommand,
  removeElementCommand,
  setTextRunCommand,
  updateElementTransformCommand,
} from './element-commands.js';
import {
  addSlideCommand,
  removeSlideCommand,
  reorderSlidesCommand,
  setSlideNotesCommand,
  setSlideTitleCommand,
} from './slide-commands.js';

/** Context every command receives. */
export interface CommandContext {
  ydoc: Y.Doc;
  provider: YjsStorageProvider;
  storage: StorageAdapter;
  docId: string;
  actor: string;
  /** Returns the most recent observed snapshot version (or 0). */
  parentVersion(): number;
  /** Schedule a debounced ChangeSet emit; coalesces text-edit bursts (AC #27). */
  emitDebounced(key: string, build: () => ChangeSet): void;
  /** Emit a ChangeSet immediately. */
  emit(changeSet: ChangeSet): Promise<void>;
}

/** A command is a function that mutates the Y.Doc + returns ChangeSet ops. */
export type CommandFn<Args> = (ctx: CommandContext, args: Args) => Promise<void>;

/** Argument types per command — keeps `client.command(name, args)` typed. */
export interface CommandArgs {
  addSlide: { slide: Slide; index?: number };
  removeSlide: { slideId: string };
  reorderSlides: { fromIdx: number; toIdx: number };
  setSlideTitle: { slideId: string; title: string };
  setSlideNotes: { slideId: string; notes: string };
  addElement: { slideId: string; element: Element; index?: number };
  removeElement: { slideId: string; elementId: string };
  updateElementTransform: {
    slideId: string;
    elementId: string;
    transform: Element['transform'];
  };
  setTextRun: { slideId: string; elementId: string; text: string };
}

export type CommandName = keyof CommandArgs;

/** Registry of every shipped command. */
export const COMMAND_REGISTRY: { [K in CommandName]: CommandFn<CommandArgs[K]> } = {
  addSlide: addSlideCommand,
  removeSlide: removeSlideCommand,
  reorderSlides: reorderSlidesCommand,
  setSlideTitle: setSlideTitleCommand,
  setSlideNotes: setSlideNotesCommand,
  addElement: addElementCommand,
  removeElement: removeElementCommand,
  updateElementTransform: updateElementTransformCommand,
  setTextRun: setTextRunCommand,
};

/** Helper: build a ChangeSet bound to the context (docId, parentVersion, actor). */
export function makeChangeSet(ctx: CommandContext, ops: JsonPatchOp[]): ChangeSet {
  return buildChangeSet({
    docId: ctx.docId,
    parentVersion: ctx.parentVersion(),
    ops,
    actor: ctx.actor,
  });
}
