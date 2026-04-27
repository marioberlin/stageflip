// packages/collab/src/commands/text-diff.ts
// Apply a minimal-edit text diff to a Y.Text. Per ADR-006 §D3 / T-260
// AC #26: a single-character insertion in the middle of a 1000-char run
// must produce one Y.Text.insert and zero Y.Text.delete calls.

import type * as Y from 'yjs';
import { diffText } from '../changeset.js';

export function applyTextDiff(target: Y.Text, prev: string, next: string): void {
  if (prev === next) return;
  const edits = diffText(prev, next);
  for (const edit of edits) {
    if (edit.op === 'delete') target.delete(edit.index, edit.length ?? 0);
    else if (edit.op === 'insert') target.insert(edit.index, edit.value ?? '');
  }
}
