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

  // Slide-mode branding (T-134)
  ['slide.tagline', 'AI-native motion for presentations'],
  ['slide.productName', 'StageFlip.Slide'],

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

  // ZodForm (T-125b)
  ['zodform.empty', 'No fields to inspect.'],
  ['zodform.optional', 'optional'],
  ['zodform.unknownPlaceholder', 'Unsupported type — raw text'],
  ['zodform.tagPlaceholder', 'Add tag + Enter'],
  ['zodform.numberListPlaceholder', 'Comma-separated numbers'],
  ['zodform.colorPickerLabel', 'Color picker'],

  // Clip element properties (T-125b)
  ['properties.clip.title', 'Clip Props'],
  ['properties.clip.noSchema', 'This clip does not expose a prop schema.'],
  ['properties.clip.unknownRuntime', 'Clip not found in any registered runtime.'],

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

  // Persistent toolbar (T-139a)
  ['toolbar.persistent.ariaLabel', 'Persistent toolbar'],
  ['toolbar.persistent.newSlide', 'New slide'],
  ['toolbar.persistent.undo', 'Undo'],
  ['toolbar.persistent.redo', 'Redo'],
  ['toolbar.persistent.zoomIn', 'Zoom in'],
  ['toolbar.persistent.zoomOut', 'Zoom out'],
  ['toolbar.persistent.zoomLabel', 'Zoom'],
  ['toolbar.persistent.present', 'Present'],
  ['toolbar.persistent.slideCounter', 'Slide counter'],

  // Contextual toolbar (T-139a)
  ['toolbar.contextual.ariaLabel', 'Selection toolbar'],
  ['toolbar.contextual.empty', 'Nothing selected'],
  ['toolbar.contextual.text.bold', 'Bold'],
  ['toolbar.contextual.text.italic', 'Italic'],
  ['toolbar.contextual.text.underline', 'Underline'],
  ['toolbar.contextual.text.alignLeft', 'Align left'],
  ['toolbar.contextual.text.alignCenter', 'Align center'],
  ['toolbar.contextual.text.alignRight', 'Align right'],
  ['toolbar.contextual.text.fontSize', 'Font size'],
  ['toolbar.contextual.shape.fill', 'Fill'],
  ['toolbar.contextual.shape.stroke', 'Stroke'],
  ['toolbar.contextual.image.crop', 'Crop'],
  ['toolbar.contextual.image.filter', 'Filter'],
  ['toolbar.contextual.type.text', 'Text'],
  ['toolbar.contextual.type.shape', 'Shape'],
  ['toolbar.contextual.type.image', 'Image'],
  ['toolbar.contextual.type.video', 'Video'],
  ['toolbar.contextual.type.table', 'Table'],
  ['toolbar.contextual.type.chart', 'Chart'],
  ['toolbar.contextual.type.clip', 'Clip'],
  ['toolbar.contextual.type.group', 'Group'],
  ['toolbar.contextual.type.embed', 'Embed'],
  ['toolbar.contextual.type.code', 'Code'],
  ['toolbar.contextual.type.audio', 'Audio'],

  // Asset browser (T-139b)
  ['assetBrowser.title', 'Assets'],
  ['assetBrowser.ariaLabel', 'Asset browser'],
  ['assetBrowser.empty', 'No assets yet — upload an image to get started.'],
  ['assetBrowser.uploadButton', 'Upload'],
  ['assetBrowser.dragHint', 'Drag onto the canvas'],
  ['assetBrowser.filter.all', 'All'],
  ['assetBrowser.filter.image', 'Images'],
  ['assetBrowser.filter.video', 'Videos'],
  ['assetBrowser.filter.audio', 'Audio'],
  ['assetBrowser.contextMenu.insert', 'Insert on slide'],
  ['assetBrowser.contextMenu.copyRef', 'Copy asset ref'],
  ['assetBrowser.contextMenu.rename', 'Rename'],
  ['assetBrowser.contextMenu.remove', 'Remove from library'],

  // Import dialogs (T-139b)
  ['import.google.title', 'Import Google Slides'],
  ['import.google.tokenLabel', 'OAuth access token'],
  ['import.google.tokenPlaceholder', 'ya29.…'],
  ['import.google.deckIdLabel', 'Slides deck ID'],
  ['import.google.deckIdPlaceholder', '1A2b3C4dEfGhIjK…'],
  ['import.google.submit', 'Import deck'],
  ['import.google.pending', 'Fetching deck…'],
  [
    'import.google.featureFlag',
    'OAuth backend is not wired yet — import runs in legacy-bridge mode.',
  ],
  ['import.google.error.missingFields', 'Both token and deck ID are required.'],
  ['import.google.error.generic', 'Import failed. Check the token and deck ID.'],

  ['import.pptx.title', 'Import PowerPoint'],
  ['import.pptx.pickLabel', 'Choose a .pptx file'],
  ['import.pptx.submit', 'Import'],
  [
    'import.pptx.stub',
    'Full PPTX parse ships in a follow-up task. The picker validates the file but no slides are imported.',
  ],
  ['import.pptx.error.invalidType', 'Only .pptx files are supported.'],

  ['import.image.title', 'Upload image'],
  ['import.image.pickLabel', 'Choose an image file'],
  ['import.image.submit', 'Upload'],
  ['import.image.error.invalidType', 'Only image files are supported.'],
  ['import.image.error.tooLarge', 'File exceeds the 20 MB upload limit.'],

  // Export dialog (T-139b)
  ['export.dialog.title', 'Export deck'],
  ['export.dialog.formatLabel', 'Format'],
  ['export.dialog.format.png', 'PNG frames'],
  ['export.dialog.format.mp4', 'MP4 video'],
  ['export.dialog.resolutionLabel', 'Resolution'],
  ['export.dialog.resolution.1080', '1080p (1920×1080)'],
  ['export.dialog.resolution.720', '720p (1280×720)'],
  ['export.dialog.resolution.4k', '4K (3840×2160)'],
  ['export.dialog.rangeLabel', 'Range'],
  ['export.dialog.range.all', 'Full deck'],
  ['export.dialog.range.current', 'Current slide'],
  ['export.dialog.submit', 'Start export'],
  ['export.dialog.pending', 'Exporting…'],
  ['export.dialog.error.noDocument', 'Open a deck before exporting.'],
  ['export.dialog.success', 'Export queued.'],

  // Find/replace dialog (T-139c)
  ['findReplace.title.find', 'Find'],
  ['findReplace.title.findReplace', 'Find and replace'],
  ['findReplace.findPlaceholder', 'Find…'],
  ['findReplace.replacePlaceholder', 'Replace with…'],
  ['findReplace.caseSensitive', 'Match case'],
  ['findReplace.wholeWord', 'Whole word'],
  ['findReplace.regex', 'Regex'],
  ['findReplace.previous', 'Previous'],
  ['findReplace.next', 'Next'],
  ['findReplace.replace', 'Replace'],
  ['findReplace.replaceAll', 'Replace all'],
  ['findReplace.noMatches', 'No matches'],
  ['findReplace.invalidRegex', 'Invalid regex'],
  ['findReplace.of', 'of'],
  ['findReplace.close', 'Close'],

  // Onboarding coachmarks (T-139c)
  ['onboarding.coachmark.welcome.title', 'Welcome to StageFlip'],
  [
    'onboarding.coachmark.welcome.body',
    'A quick tour of the essentials. You can dismiss any tip with Esc.',
  ],
  ['onboarding.coachmark.canvas.title', 'The canvas'],
  ['onboarding.coachmark.canvas.body', 'Your slide lives here. Click text to edit inline.'],
  ['onboarding.coachmark.filmstrip.title', 'Slides list'],
  [
    'onboarding.coachmark.filmstrip.body',
    'Add, reorder, and delete slides from the filmstrip on the left.',
  ],
  ['onboarding.coachmark.properties.title', 'Properties'],
  ['onboarding.coachmark.properties.body', 'Fine-tune the selected element on the right.'],
  ['onboarding.coachmark.toolbar.title', 'Toolbar'],
  ['onboarding.coachmark.toolbar.body', 'New slide, undo/redo, zoom, and present live up top.'],
  ['onboarding.coachmark.next', 'Next'],
  ['onboarding.coachmark.previous', 'Back'],
  ['onboarding.coachmark.done', 'Done'],
  ['onboarding.coachmark.skip', 'Skip tour'],
  ['onboarding.coachmark.stepCounter', 'Step'],

  // Cloud-save panel (T-139c)
  ['cloudSave.title', 'Cloud save'],
  ['cloudSave.save', 'Save to cloud'],
  ['cloudSave.saveAgain', 'Save again'],
  ['cloudSave.status.idle', 'Not saved'],
  ['cloudSave.status.saving', 'Saving…'],
  ['cloudSave.status.saved', 'Saved'],
  ['cloudSave.status.conflict', 'Conflict detected'],
  ['cloudSave.status.error', 'Save failed'],
  ['cloudSave.conflict.title', 'The cloud copy has diverged'],
  ['cloudSave.conflict.body', 'Choose which version wins. You can still undo after.'],
  ['cloudSave.conflict.keepLocal', 'Keep mine'],
  ['cloudSave.conflict.keepRemote', 'Use cloud version'],
  ['cloudSave.lastSavedAt', 'Last saved'],
  ['cloudSave.revision', 'Rev'],

  // Presentation mode (T-139c)
  ['presentation.enter', 'Start presentation'],
  ['presentation.exit', 'Exit'],
  ['presentation.next', 'Next slide'],
  ['presentation.previous', 'Previous slide'],
  ['presentation.notes.title', 'Speaker notes'],
  ['presentation.notes.empty', 'No speaker notes for this slide.'],
  ['presentation.notes.toggle', 'Toggle notes'],
  ['presentation.counter', 'Slide'],
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
