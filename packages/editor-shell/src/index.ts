// packages/editor-shell/src/index.ts
// Public surface for @stageflip/editor-shell.
// T-121a: shortcut registry. T-121b: atoms + context shells.
// T-121c: <EditorShell> composition + localStorage persistence + i18n.

// T-121a — shortcuts
export type { FocusZone } from './shortcuts/focus-zone';
export { currentFocusZone, focusIsInZone } from './shortcuts/focus-zone';
export { formatCombo, matchesKeyCombo } from './shortcuts/match-key-combo';
export {
  ShortcutRegistryProvider,
  useAllShortcuts,
  useRegisterShortcuts,
} from './shortcuts/shortcut-registry';
export type { Shortcut, ShortcutCategory, ShortcutHandler } from './shortcuts/types';

// T-121b — atoms + context
export {
  __clearElementByIdCacheForTest,
  __clearMaterializedSlideByIdCacheForTest,
  __clearSlideByIdCacheForTest,
  documentAtom,
  elementByIdAtom,
  materializedDocumentAtom,
  materializedSlideByIdAtom,
  slideByIdAtom,
} from './atoms/document';
export { activeSlideIdAtom } from './atoms/ui';
export {
  dismissedLossFlagIdsAtom,
  importLossFlagsAtom,
  visibleLossFlagsAtom,
} from './atoms/import-loss-flags';
export {
  EMPTY_SELECTION,
  selectedElementIdAtom,
  selectedElementIdsAtom,
  selectedSlideIdsAtom,
} from './atoms/selection';
export {
  MAX_MICRO_UNDO,
  type ActiveTransaction,
  type MicroUndo,
  canRedoAtom,
  canUndoAtom,
  inTransactionAtom,
  redoStackAtom,
  transactionAtom,
  undoStackAtom,
} from './atoms/undo';
export { AuthProvider, useAuth } from './context/auth-context';
export type { AuthContextValue, AuthUser } from './context/auth-context';
export {
  DocumentProvider,
  type DocumentContextValue,
  type DocumentProviderProps,
  useDocument,
  useEditorShellAtomValue,
  useEditorShellSetAtom,
} from './context/document-context';

// T-121c — composition, persistence, i18n
export { EditorShell, type EditorShellProps } from './editor-shell';
export { type Locale, getLocale, setLocale, t } from './i18n/catalog';
export {
  MAX_RECENT_DOCUMENTS,
  type AutosaveOptions,
  type RecentDocumentEntry,
  clearDocument,
  listRecentDocuments,
  loadDocumentSerialized,
  saveDocument,
  useAutosaveDocument,
} from './persistence';

// T-125b — ZodForm auto-inspector
export {
  type DiscriminatedBranch,
  type FieldKind,
  type FieldSpec,
  introspectField,
  introspectSchema,
} from './zodform/introspect';
export { ZodForm, type ZodFormProps } from './zodform/zod-form';

// T-139a — context-menu framework
export {
  ContextMenu,
  ContextMenuProvider,
  pickContextMenu,
  useAllContextMenus,
  useContextMenu,
  useRegisterContextMenu,
} from './context-menu';
export type {
  ContextMenuDescriptor,
  ContextMenuItem,
  ContextMenuItemSpec,
  ContextMenuMatch,
  ContextMenuSeparator,
  ContextMenuSubmenu,
  OpenContextMenuState,
} from './context-menu';

// T-139b — asset registry (image / video / audio) shared across modes
export {
  addAssetAtom,
  assetsAtom,
  removeAssetAtom,
  replaceAssetsAtom,
  selectedAssetAtom,
  selectedAssetIdAtom,
} from './assets';
export type { Asset, AssetKind } from './assets';

// T-139c — find/replace framework (pure + atom)
export {
  EMPTY_FIND_HIGHLIGHTS,
  findHighlightsAtom,
  findMatches,
  replaceAll,
  type FindHighlightsState,
  type FindMatch,
  type FindOptions,
} from './find-replace';

// T-139c — cloud-save framework (adapter contract + stub)
export {
  CloudSaveConflictError,
  createStubCloudSaveAdapter,
  type CloudSaveAdapter,
  type CloudSaveResult,
  type CloudSaveStatus,
  type StubCloudSaveOptions,
} from './cloud-save';

// T-181 — shared timeline primitives (math + track layout).
export {
  type TimelineScale,
  formatFrameLabel,
  frameToPx,
  pxToFrame,
  rulerTickFrames,
  snapFrame,
} from './timeline/math';
export {
  type ElementBlockInput,
  type ElementBlockPlacement,
  type TimelineTrackKind,
  type TrackLaneInput,
  type TrackRowPlacement,
  DEFAULT_TRACK_ROW_HEIGHT_PX,
  TRACK_KIND_HEIGHT_PX,
  TRACK_KIND_ORDER,
  placeElementBlock,
  placeTrackElements,
  totalTrackStackHeight,
  trackRowLayout,
} from './timeline/tracks';

// T-181b — headless timeline React primitives.
export {
  type UseTimelineScaleOptions,
  type UseTimelineScaleResult,
  useTimelineScale,
} from './timeline/use-timeline-scale';
export {
  type ElementBlockProps,
  type TimelineRulerProps,
  type TimelineStackProps,
  type TrackRowProps,
  ElementBlock,
  TimelineRuler,
  TimelineStack,
  TrackRow,
} from './timeline/components';

// T-181c — scrubber state + playhead + panel composition.
export {
  type UseScrubberOptions,
  type UseScrubberResult,
  useScrubber,
} from './timeline/use-scrubber';
export {
  type PlayheadProps,
  type TimelinePanelProps,
  Playhead,
  TimelinePanel,
} from './timeline/panel';

// T-182 — aspect-ratio bouncer (multi-aspect preview grid).
export {
  type AspectPreviewPlacement,
  type AspectRatio,
  type AspectRowLayoutOptions,
  type BoxSize,
  COMMON_ASPECTS,
  fitAspect,
  layoutAspectPreviews,
} from './aspect-ratio/math';
export {
  type AspectRatioGridProps,
  type AspectRatioPreviewProps,
  AspectRatioGrid,
  AspectRatioPreview,
} from './aspect-ratio/components';

// T-201 — multi-size banner preview grid (StageFlip.Display).
export {
  type BannerSize,
  type BannerSizeLayoutOptions,
  type BannerSizePlacement,
  layoutBannerSizes,
} from './banner-size/math';
export {
  type BannerSizeGridProps,
  type BannerSizePreviewProps,
  BannerSizeGrid,
  BannerSizePreview,
} from './banner-size/components';
