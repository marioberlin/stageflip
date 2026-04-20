// packages/rir/src/compile/passes.ts
// The four primary RIR compiler passes owned by T-030:
//   theme-resolve, variable-resolve, component-expand, binding-resolve
// Font aggregation (also in T-030 scope per the RIR skill) lives here too.
// Timing flatten + stacking-context passes are T-031.

import type { ChartData, Document, Element, FontRequirement, Theme } from '@stageflip/schema';

import type { CompilerDiagnostic } from '../types.js';

/* --------------------------- Common utilities --------------------------- */

/** Collector for diagnostics emitted by passes. */
export class DiagnosticSink {
  readonly items: CompilerDiagnostic[] = [];
  emit(d: CompilerDiagnostic): void {
    this.items.push(d);
  }
  /** Number of error-severity diagnostics. */
  errorCount(): number {
    return this.items.filter((d) => d.severity === 'error').length;
  }
}

/** Walk every element in a tree, emitting each (including nested group children). */
export function walkElements(
  elements: readonly Element[],
  visit: (el: Element, ancestorIds: readonly string[]) => void,
  ancestors: readonly string[] = [],
): void {
  for (const el of elements) {
    visit(el, ancestors);
    if (el.type === 'group') {
      walkElements(el.children, visit, [...ancestors, el.id]);
    }
  }
}

/** Deep map over an element tree, producing new elements of the same shape. */
export function mapElements<E extends Element>(elements: readonly E[], fn: (el: E) => E): E[] {
  return elements.map((el) => {
    const mapped = fn(el);
    if (mapped.type === 'group') {
      // Recurse into group children after mapping the group itself.
      const group = mapped as Extract<Element, { type: 'group' }>;
      return {
        ...mapped,
        children: mapElements(group.children as E[], fn),
      } as E;
    }
    return mapped;
  });
}

/* --------------------------- Theme resolve --------------------------- */

/**
 * Resolve `theme:<dotted.path>` refs against `theme.tokens`. Missing tokens
 * emit a `warn` diagnostic and leave the literal ref in place so the
 * renderer can fall back.
 */
export function resolveThemeRefs(
  value: string,
  theme: Theme,
  context: { elementId?: string },
  sink: DiagnosticSink,
): string {
  if (!value.startsWith('theme:')) return value;
  const path = value.slice(6);
  const resolved = theme.tokens[path];
  if (resolved === undefined) {
    sink.emit({
      severity: 'warn',
      code: 'theme-token-missing',
      message: `theme token "${path}" is not declared in theme.tokens`,
      pass: 'theme-resolve',
      ...(context.elementId ? { elementId: context.elementId } : {}),
    });
    return value;
  }
  return typeof resolved === 'string' ? resolved : String(resolved);
}

/* --------------------------- Variable resolve --------------------------- */

const VARIABLE_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/**
 * Replace `{{name}}` placeholders in a string with values from the variables
 * dict. Unknown names emit a `warn` and are left as the literal placeholder
 * so editors can highlight the gap.
 */
export function resolveVariables(
  value: string,
  variables: Readonly<Record<string, unknown>>,
  context: { elementId?: string },
  sink: DiagnosticSink,
): string {
  return value.replace(VARIABLE_REGEX, (match, name: string) => {
    if (!Object.hasOwn(variables, name)) {
      sink.emit({
        severity: 'warn',
        code: 'variable-missing',
        message: `variable "${name}" is not declared in document.variables`,
        pass: 'variable-resolve',
        ...(context.elementId ? { elementId: context.elementId } : {}),
      });
      return match;
    }
    const val = variables[name];
    return val === null || val === undefined ? '' : String(val);
  });
}

/* --------------------------- Component expand --------------------------- */

/**
 * Expand component references into inline element trees. The component body
 * shape is not yet specified (T-249 design-system learning fills it); this
 * pass currently emits a single diagnostic per document signalling the gap
 * and leaves the document unchanged.
 */
export function expandComponents(doc: Document, sink: DiagnosticSink): Document {
  const names = Object.keys(doc.components);
  if (names.length > 0) {
    sink.emit({
      severity: 'info',
      code: 'component-expand-noop',
      message: `component-expand pass is a stub; ${names.length} component(s) not yet inlined (T-249)`,
      pass: 'component-expand',
    });
  }
  return doc;
}

/* --------------------------- Binding resolve --------------------------- */

/**
 * Resolve `ds:<id>` data-source references inside chart elements. A caller
 * supplies a provider; absence of a provider or an unknown id emits a `warn`
 * and leaves the element's data as-is.
 */
export type DataSourceProvider = (ref: string) => ChartData | null;

export function resolveBindings(
  elements: readonly Element[],
  provider: DataSourceProvider | undefined,
  sink: DiagnosticSink,
): Element[] {
  return mapElements(elements, (el) => {
    if (el.type !== 'chart') return el;
    if (typeof el.data !== 'string') return el;
    const ref = el.data;
    if (!provider) {
      sink.emit({
        severity: 'warn',
        code: 'binding-no-provider',
        message: `chart element "${el.id}" references ${ref}; no dataSourceProvider supplied`,
        pass: 'binding-resolve',
        elementId: el.id,
      });
      return el;
    }
    const resolved = provider(ref);
    if (!resolved) {
      sink.emit({
        severity: 'warn',
        code: 'binding-unresolved',
        message: `dataSourceProvider returned null for "${ref}"`,
        pass: 'binding-resolve',
        elementId: el.id,
      });
      return el;
    }
    return { ...el, data: resolved };
  });
}

/* --------------------------- Font aggregate --------------------------- */

/**
 * Walk every element and gather the union of FontRequirements the document
 * needs. Text elements contribute their fontFamily (with default weight 400);
 * clip elements contribute their declared `fonts` array. Duplicates are
 * deduped on (family, weight, style, subsets).
 */
export function aggregateFonts(elements: readonly Element[]): FontRequirement[] {
  const byKey = new Map<string, FontRequirement>();
  const add = (req: FontRequirement): void => {
    const key = JSON.stringify({
      family: req.family,
      weight: req.weight ?? '400',
      style: req.style ?? 'normal',
      subsets: (req.subsets ?? []).slice().sort(),
    });
    if (!byKey.has(key)) byKey.set(key, req);
  };

  walkElements(elements, (el) => {
    if (el.type === 'text' && el.fontFamily) {
      add({ family: el.fontFamily, style: 'normal' });
    }
    if (el.type === 'clip' && el.fonts) {
      for (const f of el.fonts) add(f);
    }
  });

  return [...byKey.values()];
}
