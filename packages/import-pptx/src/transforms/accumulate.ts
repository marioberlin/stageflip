// packages/import-pptx/src/transforms/accumulate.ts
// T-241a — walk the parser-side group tree and accumulate each group's
// <a:xfrm> transform (chOff/chExt scaling + rotation) into descendants so
// leaf children carry world-space coordinates. Pure: no I/O, no Date, no
// Math.random. Idempotent: every leaf gets touched exactly once per call,
// running twice yields the same output.
//
// Math derived from public references (CLAUDE.md §7):
//   - https://learn.microsoft.com/en-us/openspecs/office_standards/ms-pptx/
//   - https://officeopenxml.com/drwSp-rotate.php
//   - ECMA-376 §20.1.7.5–7.7

import type {
  CanonicalSlideTree,
  ParsedElement,
  ParsedGroupElement,
  ParsedSlide,
} from '../types.js';

/**
 * The cumulative ancestor-group transform a child sits inside. `null` at the
 * slide top level. Each level composes onto the previous via `compose`.
 */
interface GroupFrame {
  /** Group's world offset (where the unrotated group origin sits in the slide). */
  worldX: number;
  worldY: number;
  /** Scale factors mapping local (chExt) coords → world (group.ext) coords. */
  scaleX: number;
  scaleY: number;
  /** World-space center of the group used to rotate child positions around. */
  worldCenterX: number;
  worldCenterY: number;
  /** Cumulative rotation in degrees. */
  rotation: number;
}

const IDENTITY: GroupFrame = {
  worldX: 0,
  worldY: 0,
  scaleX: 1,
  scaleY: 1,
  worldCenterX: 0,
  worldCenterY: 0,
  rotation: 0,
};

/**
 * Walk every slide / layout / master and accumulate group transforms into
 * descendants. The group nodes themselves remain in the tree (their own
 * `transform` is unchanged); only their leaf descendants get rewritten.
 *
 * Idempotent via `tree.transformsAccumulated`: a second call on already-
 * accumulated input returns a structural clone rather than re-applying the
 * math (which would compound transforms).
 */
export function accumulateGroupTransforms(tree: CanonicalSlideTree): CanonicalSlideTree {
  if (tree.transformsAccumulated === true) {
    return {
      slides: tree.slides,
      layouts: tree.layouts,
      masters: tree.masters,
      lossFlags: tree.lossFlags,
      transformsAccumulated: true,
    };
  }
  return {
    slides: tree.slides.map(walkSlide),
    layouts: mapRecord(tree.layouts, walkSlide),
    masters: mapRecord(tree.masters, walkSlide),
    lossFlags: tree.lossFlags,
    transformsAccumulated: true,
  };
}

function walkSlide(slide: ParsedSlide): ParsedSlide {
  return { ...slide, elements: slide.elements.map((e) => walkElement(e, IDENTITY)) };
}

function walkElement(element: ParsedElement, frame: GroupFrame): ParsedElement {
  if (element.type === 'group') {
    return walkGroup(element, frame);
  }
  return applyFrameToLeaf(element, frame);
}

/**
 * Apply the active frame to a leaf element's transform. When `frame === IDENTITY`
 * we still go through the math (cos=1, sin=0, scale=1) so the function stays
 * a single code path; idempotence falls out of that.
 */
function applyFrameToLeaf(element: ParsedElement, frame: GroupFrame): ParsedElement {
  // Local coords inside the immediate-parent group's coordinate space.
  // For a top-level leaf, frame is IDENTITY so this is a no-op.
  if (frame === IDENTITY) return element;

  // The leaf's stored transform is in the parent group's local frame, where
  // local (0, 0) corresponds to world (frame.worldX, frame.worldY) and one
  // unit of local maps to (frame.scaleX, frame.scaleY) world units.
  const localX = element.transform.x;
  const localY = element.transform.y;
  const scaledX = localX * frame.scaleX;
  const scaledY = localY * frame.scaleY;

  // Position before rotation = group's world origin + scaled local offset.
  const preRotateX = frame.worldX + scaledX;
  const preRotateY = frame.worldY + scaledY;

  // Rotate around the group's world center.
  const { x: worldX, y: worldY } = rotatePoint(
    preRotateX,
    preRotateY,
    frame.worldCenterX,
    frame.worldCenterY,
    frame.rotation,
  );

  return {
    ...element,
    transform: {
      ...element.transform,
      x: worldX,
      y: worldY,
      width: element.transform.width * frame.scaleX,
      height: element.transform.height * frame.scaleY,
      rotation: element.transform.rotation + frame.rotation,
    },
  } as ParsedElement;
}

/**
 * Recurse into a group: compose a new frame from the active one + the group's
 * own transform, then walk the children with the composed frame. The group's
 * own transform is left unchanged; T-241a explicitly preserves it (AC #7).
 */
function walkGroup(group: ParsedGroupElement, parentFrame: GroupFrame): ParsedGroupElement {
  const childFrame = composeFrame(parentFrame, group);
  return {
    ...group,
    children: group.children.map((c) => walkElement(c, childFrame)),
  };
}

/**
 * Build the frame children of `group` see, given the frame `group` itself sits
 * in. Composition order: parent's transform applies to the group's own offset
 * (giving the group's world placement), then the group's chOff/chExt define
 * the child-local coordinate system inside that.
 *
 * Known limitation — nested rotation: when both `parent.rotation` and
 * `group.transform.rotation` are non-zero, the math here is approximate.
 * Rotation around different centers does not generally compose into a single
 * rotation around the cumulative center; doing it correctly requires affine
 * matrix composition, which is out of scope for T-241a (M). The single-level
 * rotation case (AC #5) and the pure-translation nested case (AC #6) are
 * exact. Real PPTX content rarely nests rotated groups; if it surfaces, fix
 * by switching this whole module to 2x3 affine matrices.
 */
function composeFrame(parent: GroupFrame, group: ParsedGroupElement): GroupFrame {
  // Group's world offset = parent applied to group.transform.{x,y}.
  // Use the same leaf math (without recursion) so we get rotation around
  // the parent's center plus parent scale.
  const groupWorldOriginX =
    parent === IDENTITY ? group.transform.x : parent.worldX + group.transform.x * parent.scaleX;
  const groupWorldOriginY =
    parent === IDENTITY ? group.transform.y : parent.worldY + group.transform.y * parent.scaleY;
  const { x: groupRotatedOriginX, y: groupRotatedOriginY } = rotatePoint(
    groupWorldOriginX,
    groupWorldOriginY,
    parent.worldCenterX,
    parent.worldCenterY,
    parent.rotation,
  );

  // Group's world extent = parent scale × group.transform.{width,height}.
  const groupWorldWidth = group.transform.width * parent.scaleX;
  const groupWorldHeight = group.transform.height * parent.scaleY;

  // chOff/chExt: child coords are scaled and offset within the group's box.
  // groupExtent of zero would divide-by-zero; the parser fills it from
  // group.transform.{width,height} when chExt is absent so this is safe in
  // the common path. Defend against a degenerate fixture by falling back to
  // an identity child-coord scale.
  const safeChExtW =
    group.groupExtent.width === 0 ? group.transform.width : group.groupExtent.width;
  const safeChExtH =
    group.groupExtent.height === 0 ? group.transform.height : group.groupExtent.height;
  const childScaleX = groupWorldWidth / safeChExtW || 1;
  const childScaleY = groupWorldHeight / safeChExtH || 1;

  // The world origin a child at local (chOff.x, chOff.y) sits at:
  // groupRotatedOrigin shifted by -chOff scaled into world space. Equivalent
  // to "group's world origin minus chOff in world units".
  const childFrameWorldX = groupRotatedOriginX - group.groupOrigin.x * childScaleX;
  const childFrameWorldY = groupRotatedOriginY - group.groupOrigin.y * childScaleY;

  return {
    worldX: childFrameWorldX,
    worldY: childFrameWorldY,
    scaleX: childScaleX,
    scaleY: childScaleY,
    worldCenterX: groupRotatedOriginX + groupWorldWidth / 2,
    worldCenterY: groupRotatedOriginY + groupWorldHeight / 2,
    rotation: parent.rotation + group.transform.rotation,
  };
}

/** Rotate `(x, y)` around `(cx, cy)` by `degrees`. Pure 2D affine. */
function rotatePoint(
  x: number,
  y: number,
  cx: number,
  cy: number,
  degrees: number,
): { x: number; y: number } {
  if (degrees === 0) return { x, y };
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

function mapRecord<T>(record: Record<string, T>, fn: (v: T) => T): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(record)) out[k] = fn(v);
  return out;
}
