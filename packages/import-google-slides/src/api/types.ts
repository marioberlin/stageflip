// packages/import-google-slides/src/api/types.ts
// Minimal Slides-API v1 response types we consume. Hand-rolled (NOT pulled
// from the `googleapis` SDK) so the package's bundle stays ~60 KB gzipped per
// the spec's size-limit budget. Field set is the strict subset T-244 reads;
// extending requires re-pinning fixtures.

/**
 * Affine transform on a page element. Slides API exposes a true 2×3 affine
 * (`{scaleX, scaleY, translateX, translateY, shearX, shearY}`); composition
 * is the standard matrix product. T-244 spec §3 forbids cross-package
 * extraction from `@stageflip/import-pptx`'s domain-specific accumulator.
 */
export interface ApiAffineTransform {
  scaleX?: number;
  scaleY?: number;
  shearX?: number;
  shearY?: number;
  translateX?: number;
  translateY?: number;
  unit?: 'EMU' | 'PT' | 'UNIT_UNSPECIFIED';
}

export interface ApiSize {
  /** EMU value embedded in `{magnitude, unit: 'EMU'}` per Slides API spec. */
  magnitude?: number;
  unit?: 'EMU' | 'PT';
}

export interface ApiSize2D {
  width?: ApiSize;
  height?: ApiSize;
}

/** `pageElement.shape` subset. */
export interface ApiShape {
  shapeType?: string;
  shapeProperties?: {
    shapeBackgroundFill?: {
      solidFill?: { color?: { rgbColor?: { red?: number; green?: number; blue?: number } } };
    };
  };
  text?: ApiTextContent;
  placeholder?: { type?: string; index?: number; parentObjectId?: string };
}

export interface ApiTextRun {
  content?: string;
  style?: {
    fontFamily?: string;
    fontSize?: { magnitude?: number; unit?: 'PT' | 'EMU' };
    bold?: boolean;
    italic?: boolean;
    foregroundColor?: {
      opaqueColor?: { rgbColor?: { red?: number; green?: number; blue?: number } };
    };
  };
}

export interface ApiTextElement {
  startIndex?: number;
  endIndex?: number;
  paragraphMarker?: { style?: { alignment?: string } };
  textRun?: ApiTextRun;
}

export interface ApiTextContent {
  textElements?: ApiTextElement[];
}

export interface ApiImage {
  contentUrl?: string;
  imageProperties?: { brightness?: number; contrast?: number };
}

export interface ApiTableCell {
  rowSpan?: number;
  columnSpan?: number;
  location?: { rowIndex?: number; columnIndex?: number };
  text?: ApiTextContent;
}

export interface ApiTableRow {
  rowHeight?: ApiSize;
  tableCells?: ApiTableCell[];
}

export interface ApiTable {
  rows?: number;
  columns?: number;
  tableRows?: ApiTableRow[];
}

export interface ApiLine {
  lineCategory?: string;
  lineProperties?: {
    lineFill?: {
      solidFill?: { color?: { rgbColor?: { red?: number; green?: number; blue?: number } } };
    };
    weight?: ApiSize;
  };
}

export interface ApiElementGroup {
  children?: ApiPageElement[];
}

/**
 * One page element. Discriminated by which payload field is present (shape,
 * image, table, line, elementGroup). The Slides API guarantees mutual
 * exclusion at the schema level.
 */
export interface ApiPageElement {
  objectId?: string;
  size?: ApiSize2D;
  transform?: ApiAffineTransform;
  title?: string;
  description?: string;
  shape?: ApiShape;
  image?: ApiImage;
  table?: ApiTable;
  line?: ApiLine;
  elementGroup?: ApiElementGroup;
}

export interface ApiSlideProperties {
  layoutObjectId?: string;
  masterObjectId?: string;
}

export interface ApiLayoutProperties {
  masterObjectId?: string;
  name?: string;
  displayName?: string;
}

export interface ApiMasterProperties {
  displayName?: string;
}

export interface ApiPage {
  objectId?: string;
  pageType?: 'SLIDE' | 'LAYOUT' | 'MASTER' | 'NOTES' | 'NOTES_MASTER';
  pageElements?: ApiPageElement[];
  slideProperties?: ApiSlideProperties;
  layoutProperties?: ApiLayoutProperties;
  masterProperties?: ApiMasterProperties;
}

/** Top-level `presentations.get` response. */
export interface ApiPresentation {
  presentationId?: string;
  pageSize?: ApiSize2D;
  slides?: ApiPage[];
  layouts?: ApiPage[];
  masters?: ApiPage[];
  title?: string;
}

/** `presentations.pages.getThumbnail` response. */
export interface ApiThumbnail {
  contentUrl?: string;
  width?: number;
  height?: number;
}
