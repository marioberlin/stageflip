// packages/editor-shell/src/i18n/catalog.ts
// Flat translation catalog — deliberately minimal scaffolding.

/**
 * Translation strategy
 * --------------------
 * A flat `Map<string, string>` keyed by dotted namespace (`nav.undo`,
 * `properties.opacity`, …). Adding a translated string = add one entry
 * here + one `t('key')` call at the use site. Bare string literals in
 * user-visible copy are considered drift — CLAUDE.md §10.
 *
 * No `react-i18next`, no lazy bundle-splitting per locale, no RTL
 * wiring. One `en` catalog ships in the main bundle. When a second
 * locale becomes a real product requirement, swap this module for a
 * proper i18n lib — the `t('key')` call sites don't change.
 *
 * Concurrency
 * -----------
 * The active locale is a module-scoped `let` — process-global. Two
 * `<EditorShell>` instances mounted concurrently share one locale:
 * calling `setLocale('pseudo')` from either shell flips every
 * consumer. The rare concurrent-shell case (main editor + preview
 * modal) is not currently in scope for Phase 6 and this simpler shape
 * keeps the surface thin. If concurrent locale isolation becomes a
 * product requirement, migrate the active locale into a React
 * context; the `t()` call sites do not change.
 *
 * Pseudo-localization
 * -------------------
 * `setLocale('pseudo')` renders `⟦key⟧` at every call site so
 * missing translations are visible at a glance in QA passes. This
 * is a debug mode, not a production locale.
 *
 * Branding keys
 * -------------
 * Strings that mention product branding specifically (logos,
 * tagline, onboarding copy) live here as generic StageFlip text;
 * the branding pass (T-134) can replace any of them without touching
 * the call sites. Keys seeded from the SlideMotion editor audit
 * (§8, 358 entries) minus 28 SlideMotion-branded strings that need
 * rewriting for StageFlip anyway. Net: ~330 keys ready on ship.
 */

export type Locale = 'en' | 'pseudo';

/** Catalog entries for the `en` locale. Other locales re-use the `en`
 * dictionary with a renderer transform (see `t()`). */
const EN_CATALOG = new Map<string, string>([
  // Nav
  ['nav.undo', 'Undo'],
  ['nav.redo', 'Redo'],
  ['nav.create', 'Create'],
  ['nav.edit', 'Edit'],
  ['nav.present', 'Present'],
  ['nav.validate', 'Validate'],
  ['nav.diff', 'Diff'],
  ['nav.cloud', 'Cloud'],
  ['nav.save', 'Save'],
  ['nav.ai', 'AI'],
  ['nav.signIn', 'Sign In'],
  ['nav.export', 'Export'],

  // Common
  ['common.cancel', 'Cancel'],
  ['common.close', 'Close'],
  ['common.confirm', 'Confirm'],
  ['common.create', 'Create'],
  ['common.delete', 'Delete'],
  ['common.duplicate', 'Duplicate'],
  ['common.loading', 'Loading…'],
  ['common.rename', 'Rename'],
  ['common.save', 'Save'],
  ['common.slides', 'slides'],

  // Export confirm
  ['export.confirm.title', 'Confirm export'],
  ['export.confirm.lossIntro', 'The following features will be lost or downgraded in this format:'],
  ['export.confirm.proceed', 'Export anyway'],
  ['export.confirm.cancel', 'Cancel'],

  // Onboarding (branding-agnostic seed; T-134 may edit)
  ['onboarding.tagline', 'AI-native motion for every surface'],
  ['onboarding.welcome', 'Welcome,'],
  ['onboarding.newPresentation', 'New Presentation'],
  ['onboarding.newPresentation.description', 'Start from scratch with AI assistance'],
  ['onboarding.openFile', 'Open File'],
  ['onboarding.openFile.description', 'Load a StageFlip document'],
  ['onboarding.importGoogle', 'Import Google Slides'],
  ['onboarding.importGoogle.description', 'Bring in your existing decks'],
  ['onboarding.importPptx', 'Import PowerPoint'],
  ['onboarding.importPptx.description', 'Convert PPTX with high fidelity'],
  ['onboarding.resume', 'Resume'],
  ['onboarding.signInHint', 'Sign in to sync across devices'],
  ['onboarding.templates', 'Start from a template'],
  ['onboarding.slides', 'slides'],

  // Cloud save panel
  ['cloud.authPrompt', 'Sign in to save presentations to the cloud'],
  ['cloud.delete', 'Del'],
  ['cloud.empty', 'No saved presentations'],
  ['cloud.emptyHint', 'Save your first deck to the cloud'],
  ['cloud.id', 'ID'],
  ['cloud.load', 'Load'],
  ['cloud.loadError', 'Failed to load'],
  ['cloud.saved', 'Saved'],
  ['cloud.slides', 'slides'],

  // Command palette
  ['commandPalette.placeholder', 'Type a command…'],
  ['commandPalette.empty', 'No matches'],
  ['commandPalette.noResults', 'No results'],

  // AI copilot
  ['copilot.title', 'AI Copilot'],
  ['copilot.placeholder', 'Ask the copilot to change the deck…'],
  ['copilot.send', 'Send'],
  ['copilot.empty', 'No suggestions yet'],
  ['copilot.applyAll', 'Apply all'],
  ['copilot.dismiss', 'Dismiss'],
  ['copilot.close', 'Close copilot'],
  [
    'copilot.welcome',
    'Hi! Ask me to tweak slides — add a bullet, restyle a title, shorten a block of text.',
  ],
  ['copilot.notWired', 'AI execution is wired in Phase 7.'],
  ['copilot.errorPrefix', 'Error:'],
  ['copilot.status.idle', 'Idle'],
  ['copilot.status.pending', 'Thinking…'],
  ['copilot.status.error', 'Error'],
  ['copilot.variants', 'Variants'],
  ['copilot.variants.empty', 'No variants yet — ask for one.'],

  // Properties panel (selection-invariant)
  ['properties.fallback', 'Select an element'],
  ['properties.noSlide', 'No slide'],
  ['properties.slideInfo', 'Slide Info'],
  ['properties.title', 'Title'],
  ['properties.type', 'Type'],
  ['properties.size', 'Size'],
  ['properties.positionSize', 'Position & Size'],
  ['properties.opacity', 'Opacity'],
  ['properties.typography', 'Typography'],
  ['properties.typography.size', 'Size'],
  ['properties.typography.weight', 'Wght'],
  ['properties.legend', 'Legend'],
  ['properties.series', 'Series'],
  ['properties.seriesSingular', 'series'],
  ['properties.panel.header', 'Properties'],
  ['properties.panel.ariaLabel', 'Element properties'],
  ['properties.panel.empty', 'Nothing selected'],
  ['properties.actions', 'Actions'],
  ['properties.visible', 'Visible'],
  ['properties.locked', 'Locked'],
  ['properties.layerOrder', 'Layer Order'],
  ['properties.layer.front', 'Front'],
  ['properties.layer.fwd', 'Fwd'],
  ['properties.layer.back', 'Back'],
  ['properties.layer.bottom', 'Btm'],
  ['properties.delete', 'Delete element'],
  ['properties.typeEditors', 'Type editors'],
  ['properties.typeEditorsStub', 'No type-specific editor for this element.'],
  ['properties.slide.id', 'ID'],
  ['properties.slide.title', 'Title'],
  ['properties.slide.untitled', 'Untitled'],
  ['properties.slide.background', 'Background'],
  ['properties.slide.backgroundNone', 'none'],
  ['properties.slide.duration', 'Duration'],
  ['properties.slide.auto', 'auto'],
  ['properties.slide.elements', 'Elements'],
  ['properties.slide.notes', 'Notes'],
  ['properties.slide.notesPlaceholder', 'Speaker notes — exported to PPTX + PDF.'],

  // Layer ops
  ['properties.layer.bringForward', 'Bring Forward'],
  ['properties.layer.bringToFront', 'Bring to Front'],
  ['properties.layer.sendBackward', 'Send Backward'],
  ['properties.layer.sendToBack', 'Send to Back'],

  // Shortcut cheat sheet
  ['shortcut.cheatSheet.title', 'Keyboard Shortcuts'],
  ['shortcut.cheatSheet.search', 'Search shortcuts…'],
  ['shortcut.cheatSheet.empty', 'No shortcuts match'],
  ['shortcut.cheatSheet.close', 'Esc to close'],
  ['shortcut.cheatSheet.shortcuts', 'shortcuts'],

  // Single-input dialog
  ['singleInput.cancel', 'Cancel'],
  ['singleInput.save', 'Save'],

  // Chart editor (T-125c)
  ['properties.chart.kind', 'Chart kind'],
  ['properties.chart.legend', 'Legend'],
  ['properties.chart.axes', 'Axes'],
  ['properties.chart.series', 'Series'],
  ['properties.chart.addSeries', 'Add series'],
  ['properties.chart.seriesNamePlaceholder', 'Series name'],
  ['properties.chart.seriesValuesPlaceholder', 'Comma-separated numbers'],
  ['properties.chart.boundRef', 'Bound to data source {ref} — edit in the data-source panel.'],

  // Table editor (T-125c)
  ['properties.table.rows', 'Rows'],
  ['properties.table.columns', 'Columns'],
  ['properties.table.headerRow', 'Header row'],
  ['properties.table.addRow', 'Add row'],
  ['properties.table.addColumn', 'Add column'],
  ['properties.table.removeRow', 'Remove row'],
  ['properties.table.removeColumn', 'Remove column'],
  ['properties.table.cellContentPlaceholder', 'Cell content'],
  ['properties.table.align', 'Align'],
  ['properties.table.align.left', 'Left'],
  ['properties.table.align.center', 'Center'],
  ['properties.table.align.right', 'Right'],

  // Animation picker (T-125c)
  ['properties.animation.header', 'Animations'],
  ['properties.animation.none', 'No animations on this element.'],
  ['properties.animation.add', 'Add animation'],
  ['properties.animation.remove', 'Remove'],
  ['properties.animation.kind.fade', 'Fade'],
  ['properties.animation.kind.slide', 'Slide'],
  ['properties.animation.kind.scale', 'Scale'],
  ['properties.animation.kind.rotate', 'Rotate'],
  ['properties.animation.kind.color', 'Color'],
  ['properties.animation.kind.keyframed', 'Keyframed'],
  ['properties.animation.kind.runtime', 'Runtime'],

  // Status bar
  ['status.elements', 'elements'],
  ['status.slides', 'slides'],
  ['status.saving', 'Saving…'],
  ['status.saved', 'Saved'],
]);

let activeLocale: Locale = 'en';

export function setLocale(locale: Locale): void {
  activeLocale = locale;
}

export function getLocale(): Locale {
  return activeLocale;
}

/**
 * Resolve a translation key. In pseudo-locale mode every key renders as
 * `⟦key⟧` to spotlight missing translations. Unknown keys fall back to
 * `fallback` if provided, else to the key itself — the UI never crashes
 * on a missed add.
 */
export function t(key: string, fallback?: string): string {
  if (activeLocale === 'pseudo') return `⟦${key}⟧`;
  return EN_CATALOG.get(key) ?? fallback ?? key;
}

/** Test + tooling introspection: read-only snapshot of the `en` map. */
export function __enCatalogEntriesForTest(): ReadonlyArray<[string, string]> {
  return [...EN_CATALOG.entries()];
}
