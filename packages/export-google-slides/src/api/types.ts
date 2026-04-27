// packages/export-google-slides/src/api/types.ts
// Minimal Slides-API v1 mutation request/response types. Hand-rolled per
// T-244's accepted precedent — pulling from `googleapis` adds ~3 MB of
// transitive surface. Field set is the strict subset T-252 emits;
// extending requires re-pinning fixtures.

/**
 * Discriminated request union: every batchUpdate body item is exactly one
 * key in this union. We model the subset T-252 emits.
 */
export interface CreateShapeRequest {
  createShape: {
    objectId: string;
    shapeType: string;
    elementProperties: ElementProperties;
  };
}

export interface CreateImageRequest {
  createImage: {
    objectId: string;
    url: string;
    elementProperties: ElementProperties;
  };
}

export interface CreateTableRequest {
  createTable: {
    objectId: string;
    rows: number;
    columns: number;
    elementProperties: ElementProperties;
  };
}

export interface InsertTextRequest {
  insertText: {
    objectId: string;
    text: string;
    insertionIndex?: number;
    cellLocation?: { rowIndex: number; columnIndex: number };
  };
}

export interface UpdateShapePropertiesRequest {
  updateShapeProperties: {
    objectId: string;
    fields: string;
    shapeProperties: Record<string, unknown>;
  };
}

export interface UpdateTextStyleRequest {
  updateTextStyle: {
    objectId: string;
    textRange?: { type: 'ALL' | 'FIXED_RANGE' | 'FROM_START_INDEX' };
    fields: string;
    style: Record<string, unknown>;
    cellLocation?: { rowIndex: number; columnIndex: number };
  };
}

export interface DuplicateObjectRequest {
  duplicateObject: {
    objectId: string;
    objectIds?: Record<string, string>;
  };
}

export interface DeleteObjectRequest {
  deleteObject: {
    objectId: string;
  };
}

export interface GroupObjectsRequest {
  groupObjects: {
    groupObjectId: string;
    childrenObjectIds: string[];
  };
}

export interface MergeTableCellsRequest {
  mergeTableCells: {
    objectId: string;
    tableRange: {
      location: { rowIndex: number; columnIndex: number };
      rowSpan: number;
      columnSpan: number;
    };
  };
}

export interface UpdatePageElementTransformRequest {
  updatePageElementTransform: {
    objectId: string;
    transform: AffineTransform;
    applyMode: 'ABSOLUTE' | 'RELATIVE';
  };
}

/** Discriminated request union. */
export type BatchUpdateRequest =
  | CreateShapeRequest
  | CreateImageRequest
  | CreateTableRequest
  | InsertTextRequest
  | UpdateShapePropertiesRequest
  | UpdateTextStyleRequest
  | DuplicateObjectRequest
  | DeleteObjectRequest
  | GroupObjectsRequest
  | MergeTableCellsRequest
  | UpdatePageElementTransformRequest;

export interface ElementProperties {
  pageObjectId: string;
  size?: { width: Magnitude; height: Magnitude };
  transform?: AffineTransform;
}

export interface Magnitude {
  magnitude: number;
  unit: 'EMU' | 'PT';
}

export interface AffineTransform {
  scaleX?: number;
  scaleY?: number;
  shearX?: number;
  shearY?: number;
  translateX?: number;
  translateY?: number;
  unit: 'EMU' | 'PT';
}

/** Single batchUpdate response reply (one per request). */
export interface BatchUpdateReply {
  // The Slides API echoes the created object id for create requests.
  createShape?: { objectId: string };
  createImage?: { objectId: string };
  createTable?: { objectId: string };
  duplicateObject?: { objectId: string };
  // Other request types echo empty replies.
}

/** Top-level batchUpdate response. */
export interface BatchUpdateResponse {
  presentationId: string;
  replies: BatchUpdateReply[];
  /**
   * Per-request error info populated by the test stub (not part of the real
   * Slides API surface). The client maps real-API HTTP errors into this shape
   * so the convergence loop / loss-flag emitter has a uniform handle.
   */
  errors?: Array<{ requestIndex: number; message: string }>;
}

/** `presentations.create` response — minimal slice. */
export interface CreatePresentationResponse {
  presentationId: string;
  pageSize?: { width: Magnitude; height: Magnitude };
  slides?: Array<{ objectId: string }>;
}

/**
 * `presentations.get` response slice. Only the fields T-252's plan emitter
 * inspects to drive option (a) / option (b) preference. Re-uses the
 * `PreferenceApiPageElement` shape from `plan/preference.ts` for `pageElements`.
 */
export interface ApiPresentation {
  presentationId?: string;
  pageSize?: { width: Magnitude; height: Magnitude };
  slides?: ApiPage[];
  layouts?: ApiPage[];
  masters?: ApiPage[];
  title?: string;
}

export interface ApiPage {
  objectId?: string;
  pageType?: 'SLIDE' | 'LAYOUT' | 'MASTER' | 'NOTES' | 'NOTES_MASTER';
  pageElements?: ApiPageElementSnapshot[];
}

/**
 * Minimal page-element snapshot the planner reads. Mirrors T-244's
 * `ApiPageElement` (which is package-internal there) — we keep our own copy
 * to avoid coupling to an unexported symbol.
 */
export interface ApiPageElementSnapshot {
  objectId?: string;
  size?: { width?: Magnitude; height?: Magnitude };
  transform?: AffineTransform;
  shape?: {
    text?: { textElements?: Array<{ textRun?: { content?: string } }> };
  };
  image?: { contentUrl?: string };
  table?: { rows?: number; columns?: number };
  elementGroup?: { children?: ApiPageElementSnapshot[] };
}

/** Drive `files.create` response — minimal slice. */
export interface DriveFileCreateResponse {
  id: string;
  /** Public-readable contentUrl the Slides API can fetch from. */
  webContentLink?: string;
  /** Slides accepts `https://drive.google.com/uc?id=<id>` as a contentUrl proxy. */
}
