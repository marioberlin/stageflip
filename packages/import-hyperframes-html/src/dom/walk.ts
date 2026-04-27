// packages/import-hyperframes-html/src/dom/walk.ts
// Thin walker over parse5's default tree-adapter shape. Hyperframes input is a
// nested HTML tree; the importer needs to (a) find the top-level
// `<div id="master-root">` element, (b) iterate its top-level composition
// children, (c) parse each composition's body once `fetchCompositionSrc`
// returns it as HTML and a `<template>` fragment is unwrapped. The DOM
// surface this package needs is small — no full traversal API.

import { parse, parseFragment } from 'parse5';
import type { DefaultTreeAdapterTypes } from 'parse5';
import { getAttr } from './attrs.js';

type Element = DefaultTreeAdapterTypes.Element;
type ChildNode = DefaultTreeAdapterTypes.ChildNode;
type ParentNode = DefaultTreeAdapterTypes.ParentNode;
type Template = DefaultTreeAdapterTypes.Template;

/** Type guard for parse5 element nodes (excludes #comment / #text). */
export function isElement(node: ChildNode): node is Element {
  return (
    node.nodeName !== '#comment' && node.nodeName !== '#text' && node.nodeName !== '#documentType'
  );
}

/** Returns true if the node is a `<template>` element with a `content` fragment. */
export function isTemplate(node: ChildNode): node is Template {
  return node.nodeName === 'template';
}

/** Iterate immediate-child elements of a parent. */
export function childElements(node: ParentNode): Element[] {
  const out: Element[] = [];
  for (const c of node.childNodes) {
    if (isElement(c)) out.push(c);
  }
  return out;
}

/** Recursively yield every descendant element of `root`, depth-first. */
export function* allElements(root: ParentNode): Generator<Element> {
  for (const c of root.childNodes) {
    if (isElement(c)) {
      yield c;
      yield* allElements(c);
    }
  }
}

/**
 * Find the first element in the tree whose `id` attribute equals `id`. Used
 * to locate `<div id="master-root">` from a parsed master HTML document.
 */
export function findElementById(root: ParentNode, id: string): Element | undefined {
  for (const el of allElements(root)) {
    if (getAttr(el, 'id') === id) return el;
  }
  return undefined;
}

/**
 * Concatenate all text-node descendants into a single string, joining with
 * empty separator. Used to extract `<script>` source text and `<div>` text
 * content. Whitespace inside text nodes is preserved verbatim.
 */
export function textContent(node: ParentNode): string {
  let out = '';
  for (const c of node.childNodes) {
    if (c.nodeName === '#text') {
      out += (c as DefaultTreeAdapterTypes.TextNode).value;
    } else if (isElement(c) || isTemplate(c)) {
      out += textContent(c as ParentNode);
    }
  }
  return out;
}

/** True if `node` has no element children (only #text / #comment). */
export function hasNoElementChildren(node: ParentNode): boolean {
  for (const c of node.childNodes) {
    if (isElement(c)) return false;
  }
  return true;
}

/**
 * Parse a composition HTML fragment string. Hyperframes producer files wrap
 * the composition body in `<template id="...">`; this helper handles both
 * the wrapped form (returns the template's content) and the bare form
 * (returns the parsed fragment directly).
 */
export function parseCompositionHtml(html: string): ParentNode {
  const fragment = parseFragment(html);
  // If the only top-level element is `<template>`, unwrap it.
  for (const c of fragment.childNodes) {
    if (isTemplate(c)) return c.content;
  }
  return fragment;
}

/** Parse a master HTML document. */
export function parseMasterHtml(html: string): DefaultTreeAdapterTypes.Document {
  return parse(html);
}

/** Re-export parse5 types narrowed for downstream consumers. */
export type { Element, ChildNode, ParentNode, Template };
