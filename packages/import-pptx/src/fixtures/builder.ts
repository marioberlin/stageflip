// packages/import-pptx/src/fixtures/builder.ts
// Programmatic PPTX fixture builder. Each fixture writes a minimal but valid
// OPC package that exercises a different code path through `parsePptx`. The
// fixture bytes live only in memory; tests compare parsed output against
// committed JSON snapshots so the binary blobs never enter version control.
//
// Spec deviation (acknowledged in PR description): the original T-240
// acceptance criterion #8 asked for 5 generator-specific fixtures (PowerPoint
// 365, Keynote, Google Slides, LibreOffice Impress, OOXML-spec minimal). We
// substitute 5 structural-variant fixtures here for licensing safety + test
// isolation. Real-world generator fixtures land as a follow-up once their
// redistribution rights are sorted.

import { strToU8, zipSync } from 'fflate';

/** A flat path -> bytes map ready for `fflate.zipSync` or comparison. */
type Files = Record<string, Uint8Array>;

const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

const REL_TYPE_SLIDE = `${NS_R}/slide`;
const REL_TYPE_SLIDE_LAYOUT = `${NS_R}/slideLayout`;
const REL_TYPE_SLIDE_MASTER = `${NS_R}/slideMaster`;
const REL_TYPE_THEME = `${NS_R}/theme`;
const REL_TYPE_OFFICE_DOC = `${NS_R}/officeDocument`;
const REL_TYPE_IMAGE = `${NS_R}/image`;
const REL_TYPE_VIDEO = `${NS_R}/video`;

const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/**
 * Configurable per-slide rels (T-243b): the picture-only fixture path keeps
 * a default that emits an image rel per `ppt/media/*` extra, while the
 * video / mixed fixtures pass an explicit list of typed relationships
 * including `TargetMode="External"` for the linked-URL case.
 */
type ExplicitRel = {
  /** Rel id; must match what the slide XML references via `r:embed` / `r:link`. */
  id: string;
  /** Relationship type — image / video / etc. */
  type: string;
  /** OPC-relative target (e.g. `../media/video1.mp4`). */
  target: string;
  /** OPC `TargetMode`. Defaults to Internal when omitted. */
  targetMode?: 'Internal' | 'External';
};

/** Build the full PPTX byte buffer from a slide XML list. */
function buildPptx(
  slideXmls: string[],
  extraAssets: Record<string, Uint8Array> = {},
  perSlideExplicitRels?: ExplicitRel[][],
): Uint8Array {
  const files: Files = {};

  // _rels/.rels — package-level: doc root → ppt/presentation.xml
  files['_rels/.rels'] = strToU8(rootRels());

  // ppt/presentation.xml — declare slide ids
  files['ppt/presentation.xml'] = strToU8(presentationXml(slideXmls.length));
  files['ppt/_rels/presentation.xml.rels'] = strToU8(presentationRels(slideXmls.length));

  // Slide parts
  for (let i = 0; i < slideXmls.length; i++) {
    const idx = i + 1;
    files[`ppt/slides/slide${idx}.xml`] = strToU8(slideXmls[i] ?? '');
    const explicit = perSlideExplicitRels?.[i];
    files[`ppt/slides/_rels/slide${idx}.xml.rels`] = strToU8(
      explicit !== undefined ? slideRelsExplicit(explicit) : slideRels(idx, extraAssets),
    );
  }

  // One slide layout + one slide master + theme — minimal but valid.
  files['ppt/slideLayouts/slideLayout1.xml'] = strToU8(layoutXml());
  files['ppt/slideLayouts/_rels/slideLayout1.xml.rels'] = strToU8(layoutRels());
  files['ppt/slideMasters/slideMaster1.xml'] = strToU8(masterXml());
  files['ppt/slideMasters/_rels/slideMaster1.xml.rels'] = strToU8(masterRels());
  files['ppt/theme/theme1.xml'] = strToU8(themeXml());

  // Embedded asset bytes (images / videos), if any.
  for (const [path, bytes] of Object.entries(extraAssets)) {
    files[path] = bytes;
  }

  return zipSync(files);
}

function rootRels(): string {
  return `${xmlHeader}
<Relationships xmlns="${NS_R}/package/2006/relationships">
<Relationship Id="rId1" Type="${REL_TYPE_OFFICE_DOC}" Target="ppt/presentation.xml"/>
</Relationships>`;
}

function presentationXml(slideCount: number): string {
  const ids: string[] = [];
  for (let i = 0; i < slideCount; i++) {
    ids.push(`<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`);
  }
  return `${xmlHeader}
<p:presentation xmlns:p="${NS_P}" xmlns:r="${NS_R}">
<p:sldIdLst>${ids.join('')}</p:sldIdLst>
</p:presentation>`;
}

function presentationRels(slideCount: number): string {
  const rows: string[] = [];
  for (let i = 0; i < slideCount; i++) {
    rows.push(
      `<Relationship Id="rId${i + 1}" Type="${REL_TYPE_SLIDE}" Target="slides/slide${i + 1}.xml"/>`,
    );
  }
  rows.push(
    `<Relationship Id="rIdMaster" Type="${REL_TYPE_SLIDE_MASTER}" Target="slideMasters/slideMaster1.xml"/>`,
  );
  return `${xmlHeader}
<Relationships xmlns="${NS_R}/package/2006/relationships">
${rows.join('\n')}
</Relationships>`;
}

function slideRels(_slideIndex: number, extraImages: Record<string, Uint8Array>): string {
  const rows: string[] = [
    `<Relationship Id="rIdLayout" Type="${REL_TYPE_SLIDE_LAYOUT}" Target="../slideLayouts/slideLayout1.xml"/>`,
  ];
  let imgIdx = 1;
  for (const path of Object.keys(extraImages)) {
    if (!path.startsWith('ppt/media/')) continue;
    rows.push(
      `<Relationship Id="rIdImg${imgIdx}" Type="${REL_TYPE_IMAGE}" Target="../media/${path.slice('ppt/media/'.length)}"/>`,
    );
    imgIdx++;
  }
  return `${xmlHeader}
<Relationships xmlns="${NS_R}/package/2006/relationships">
${rows.join('\n')}
</Relationships>`;
}

/**
 * Explicit-rel variant for fixtures that need typed relationships beyond the
 * image-only auto-derived form (videos, external `TargetMode="External"`
 * cases). Always emits the layout rel first.
 */
function slideRelsExplicit(rels: readonly ExplicitRel[]): string {
  const rows: string[] = [
    `<Relationship Id="rIdLayout" Type="${REL_TYPE_SLIDE_LAYOUT}" Target="../slideLayouts/slideLayout1.xml"/>`,
  ];
  for (const r of rels) {
    const tm = r.targetMode === undefined ? '' : ` TargetMode="${r.targetMode}"`;
    rows.push(`<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"${tm}/>`);
  }
  return `${xmlHeader}
<Relationships xmlns="${NS_R}/package/2006/relationships">
${rows.join('\n')}
</Relationships>`;
}

function layoutXml(): string {
  return `${xmlHeader}
<p:sldLayout xmlns:p="${NS_P}" xmlns:a="${NS_A}">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name="layoutRoot"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr/>
</p:spTree></p:cSld>
</p:sldLayout>`;
}

function layoutRels(): string {
  return `${xmlHeader}
<Relationships xmlns="${NS_R}/package/2006/relationships">
<Relationship Id="rIdMaster" Type="${REL_TYPE_SLIDE_MASTER}" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
}

function masterXml(): string {
  return `${xmlHeader}
<p:sldMaster xmlns:p="${NS_P}" xmlns:a="${NS_A}">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name="masterRoot"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr/>
</p:spTree></p:cSld>
</p:sldMaster>`;
}

function masterRels(): string {
  return `${xmlHeader}
<Relationships xmlns="${NS_R}/package/2006/relationships">
<Relationship Id="rIdTheme" Type="${REL_TYPE_THEME}" Target="../theme/theme1.xml"/>
</Relationships>`;
}

function themeXml(): string {
  return `${xmlHeader}<a:theme xmlns:a="${NS_A}" name="default"/>`;
}

/** Common slide skeleton. Children go inside `<p:spTree>`. */
function slideShell(spTreeChildren: string): string {
  return `${xmlHeader}
<p:sld xmlns:p="${NS_P}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name="slideRoot"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr/>
${spTreeChildren}
</p:spTree></p:cSld>
</p:sld>`;
}

/** Helper: a `<p:sp>` with text. */
function spText(opts: {
  id: number;
  name: string;
  text: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
  bold?: boolean;
}): string {
  const rPr = opts.bold === true ? '<a:rPr b="1"/>' : '';
  return `<p:sp>
<p:nvSpPr><p:cNvPr id="${opts.id}" name="${opts.name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr>
<a:xfrm><a:off x="${opts.x}" y="${opts.y}"/><a:ext cx="${opts.cx}" cy="${opts.cy}"/></a:xfrm>
<a:prstGeom prst="rect"/>
</p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r>${rPr}<a:t>${xmlEscape(opts.text)}</a:t></a:r></a:p></p:txBody>
</p:sp>`;
}

/** Helper: a `<p:sp>` shape (no text). Optional `adjustments` populates `<a:avLst>`. */
function spShape(opts: {
  id: number;
  name: string;
  prst: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
  adjustments?: Record<string, number>;
}): string {
  const avLst = opts.adjustments
    ? `<a:avLst>${Object.entries(opts.adjustments)
        .map(([n, v]) => `<a:gd name="${n}" fmla="val ${v}"/>`)
        .join('')}</a:avLst>`
    : '';
  return `<p:sp>
<p:nvSpPr><p:cNvPr id="${opts.id}" name="${opts.name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr>
<a:xfrm><a:off x="${opts.x}" y="${opts.y}"/><a:ext cx="${opts.cx}" cy="${opts.cy}"/></a:xfrm>
<a:prstGeom prst="${opts.prst}">${avLst}</a:prstGeom>
</p:spPr>
</p:sp>`;
}

/** Helper: a `<p:pic>` referencing an embed rel id. */
function spPic(opts: {
  id: number;
  name: string;
  embedRelId: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
}): string {
  return `<p:pic>
<p:nvPicPr><p:cNvPr id="${opts.id}" name="${opts.name}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="${opts.embedRelId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr>
<a:xfrm><a:off x="${opts.x}" y="${opts.y}"/><a:ext cx="${opts.cx}" cy="${opts.cy}"/></a:xfrm>
</p:spPr>
</p:pic>`;
}

/** Helper: a `<p:sp>` carrying a custom geometry. */
function spCustom(opts: {
  id: number;
  name: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
}): string {
  return `<p:sp>
<p:nvSpPr><p:cNvPr id="${opts.id}" name="${opts.name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr>
<a:xfrm><a:off x="${opts.x}" y="${opts.y}"/><a:ext cx="${opts.cx}" cy="${opts.cy}"/></a:xfrm>
<a:custGeom><a:pathLst/></a:custGeom>
</p:spPr>
</p:sp>`;
}

/**
 * Helper: a `<p:sp>` whose `<p:nvSpPr><p:nvPr>` carries a `<p:videoFile>`
 * extension. ECMA-376 §19.5.41 — the relId attribute may be either
 * `r:embed` or `r:link`. Optional `body` injects a non-empty `<p:txBody>` /
 * `<a:custGeom>` so the walker-dispatch tests can verify the body is
 * dropped on the video extension.
 */
function spVideo(opts: {
  id: number;
  name: string;
  /** Carry the video relId as `r:embed` (default) or `r:link`. */
  relAttr?: 'r:embed' | 'r:link';
  relId: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
  /** Inject extra `<p:sp>` children (text body + custom geom) for AC #3. */
  withBody?: boolean;
}): string {
  const relAttr = opts.relAttr ?? 'r:embed';
  const body =
    opts.withBody === true
      ? '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>caption</a:t></a:r></a:p></p:txBody>'
      : '';
  const geom = opts.withBody === true ? '<a:custGeom><a:pathLst/></a:custGeom>' : '';
  return `<p:sp>
<p:nvSpPr>
<p:cNvPr id="${opts.id}" name="${opts.name}"/>
<p:cNvSpPr/>
<p:nvPr><p:videoFile ${relAttr}="${opts.relId}"/></p:nvPr>
</p:nvSpPr>
<p:spPr>
<a:xfrm><a:off x="${opts.x}" y="${opts.y}"/><a:ext cx="${opts.cx}" cy="${opts.cy}"/></a:xfrm>
${geom}
</p:spPr>
${body}
</p:sp>`;
}

/** Helper: a `<p:grpSp>` with nested children. */
function spGroup(opts: {
  id: number;
  name: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
  children: string;
}): string {
  return `<p:grpSp>
<p:nvGrpSpPr><p:cNvPr id="${opts.id}" name="${opts.name}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr>
<a:xfrm><a:off x="${opts.x}" y="${opts.y}"/><a:ext cx="${opts.cx}" cy="${opts.cy}"/></a:xfrm>
</p:grpSpPr>
${opts.children}
</p:grpSp>`;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Tiny 1x1 PNG used as a stand-in image embed. Bytes are deterministic. */
const ONE_PIXEL_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

/**
 * Stand-in MP4 byte payload. Bytes are deterministic but not a valid MP4
 * stream — the parser only looks at the path's extension for MIME inference
 * and uploads bytes through the abstract `AssetStorage` adapter. Tests don't
 * decode the payload, so a fixed 16-byte buffer suffices.
 */
const STUB_MP4_BYTES = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00,
]);

/** Fixture 1: minimal — one slide, one text shape. */
export function buildMinimalFixture(): Uint8Array {
  const slide = slideShell(
    spText({
      id: 2,
      name: 'Title',
      text: 'Hello, StageFlip',
      x: 914400,
      y: 914400,
      cx: 6858000,
      cy: 1143000,
      bold: true,
    }),
  );
  return buildPptx([slide]);
}

/** Fixture 2: shapes — assorted prstGeom values exercising preset mapping. */
export function buildShapesFixture(): Uint8Array {
  const children = [
    spShape({ id: 2, name: 'Rect1', prst: 'rect', x: 0, y: 0, cx: 1000000, cy: 1000000 }),
    spShape({
      id: 3,
      name: 'Ellipse1',
      prst: 'ellipse',
      x: 1500000,
      y: 0,
      cx: 1000000,
      cy: 1000000,
    }),
    spShape({
      id: 4,
      name: 'Hexagon1',
      prst: 'hexagon',
      x: 3000000,
      y: 0,
      cx: 1000000,
      cy: 1000000,
    }),
    spShape({ id: 5, name: 'Star5', prst: 'star5', x: 4500000, y: 0, cx: 1000000, cy: 1000000 }),
    spShape({ id: 6, name: 'Cloud', prst: 'cloud', x: 6000000, y: 0, cx: 1000000, cy: 1000000 }),
  ].join('\n');
  return buildPptx([slideShell(children)]);
}

/** Fixture 3: picture — `<p:pic>` referencing an embedded PNG. */
export function buildPictureFixture(): Uint8Array {
  const slide = slideShell(
    spPic({
      id: 2,
      name: 'Pic1',
      embedRelId: 'rIdImg1',
      x: 0,
      y: 0,
      cx: 4000000,
      cy: 3000000,
    }),
  );
  return buildPptx([slide], { 'ppt/media/image1.png': ONE_PIXEL_PNG });
}

/** Fixture 4: group — nested `<p:grpSp>` with two child shapes. */
export function buildGroupFixture(): Uint8Array {
  const inner = [
    spShape({
      id: 3,
      name: 'GroupChildA',
      prst: 'rect',
      x: 100000,
      y: 100000,
      cx: 500000,
      cy: 500000,
    }),
    spShape({
      id: 4,
      name: 'GroupChildB',
      prst: 'ellipse',
      x: 700000,
      y: 100000,
      cx: 500000,
      cy: 500000,
    }),
  ].join('\n');
  const slide = slideShell(
    spGroup({
      id: 2,
      name: 'OuterGroup',
      x: 1000000,
      y: 1000000,
      cx: 2000000,
      cy: 1000000,
      children: inner,
    }),
  );
  return buildPptx([slide]);
}

/** Fixture 5: multi-slide — three slides with mixed content. */
export function buildMultiSlideFixture(): Uint8Array {
  const s1 = slideShell(
    spText({ id: 2, name: 'Slide1Title', text: 'Slide One', x: 0, y: 0, cx: 5000000, cy: 1000000 }),
  );
  const s2 = slideShell(
    [
      spText({
        id: 2,
        name: 'Slide2Title',
        text: 'Slide Two',
        x: 0,
        y: 0,
        cx: 5000000,
        cy: 1000000,
      }),
      spShape({ id: 3, name: 'Underline', prst: 'line', x: 0, y: 1100000, cx: 5000000, cy: 0 }),
    ].join('\n'),
  );
  const s3 = slideShell(
    spCustom({ id: 2, name: 'CustomShape', x: 0, y: 0, cx: 1000000, cy: 1000000 }),
  );
  return buildPptx([s1, s2, s3]);
}

/**
 * Fixture 6 (T-242b): roundRect with adj1 + a wedgeRectCallout with adj
 * values the generator does not honor. Exercises both the cornerRadius
 * extraction path and the LF-PPTX-PRESET-ADJUSTMENT-IGNORED emit path.
 */
export function buildAdjustedShapesFixture(): Uint8Array {
  const children = [
    spShape({
      id: 2,
      name: 'RoundedBox',
      prst: 'roundRect',
      x: 0,
      y: 0,
      cx: 1000000,
      cy: 1000000,
      adjustments: { adj: 25000 },
    }),
    spShape({
      id: 3,
      name: 'CalloutWithIgnoredAdj',
      prst: 'wedgeRectCallout',
      x: 1500000,
      y: 0,
      cx: 1000000,
      cy: 1000000,
      adjustments: { adj1: -30000, adj2: 50000 },
    }),
  ].join('\n');
  return buildPptx([slideShell(children)]);
}

/**
 * Fixture 7 (T-243b): one slide with a single `<p:videoFile>` extension on
 * a `<p:sp>`. The relId is `r:embed`, target is `../media/video1.mp4`,
 * `TargetMode` defaults to Internal — the in-ZIP video happy path.
 */
export function buildVideoFixture(): Uint8Array {
  const slide = slideShell(
    spVideo({
      id: 2,
      name: 'Video1',
      relAttr: 'r:embed',
      relId: 'rIdVid1',
      x: 0,
      y: 0,
      cx: 4000000,
      cy: 3000000,
    }),
  );
  return buildPptx([slide], { 'ppt/media/video1.mp4': STUB_MP4_BYTES }, [
    [
      {
        id: 'rIdVid1',
        type: REL_TYPE_VIDEO,
        target: '../media/video1.mp4',
        targetMode: 'Internal',
      },
    ],
  ]);
}

/**
 * Fixture 8 (T-243b): mixed slide carrying one image + one video, exercising
 * the end-to-end pipeline (`parsePptx → resolveAssets`). Used by AC #15.
 */
export function buildVideoAndImageFixture(): Uint8Array {
  const slide = slideShell(
    [
      spPic({
        id: 2,
        name: 'Pic1',
        embedRelId: 'rIdImg1',
        x: 0,
        y: 0,
        cx: 1000000,
        cy: 1000000,
      }),
      spVideo({
        id: 3,
        name: 'Video1',
        relAttr: 'r:embed',
        relId: 'rIdVid1',
        x: 1500000,
        y: 0,
        cx: 4000000,
        cy: 3000000,
      }),
    ].join('\n'),
  );
  return buildPptx(
    [slide],
    {
      'ppt/media/image1.png': ONE_PIXEL_PNG,
      'ppt/media/video1.mp4': STUB_MP4_BYTES,
    },
    [
      [
        {
          id: 'rIdImg1',
          type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
          target: '../media/image1.png',
        },
        {
          id: 'rIdVid1',
          type: REL_TYPE_VIDEO,
          target: '../media/video1.mp4',
          targetMode: 'Internal',
        },
      ],
    ],
  );
}

/** All fixture builders, keyed by stable name. Preserves enumeration order. */
export const FIXTURE_BUILDERS = {
  minimal: buildMinimalFixture,
  shapes: buildShapesFixture,
  picture: buildPictureFixture,
  group: buildGroupFixture,
  'multi-slide': buildMultiSlideFixture,
  adjusted: buildAdjustedShapesFixture,
  video: buildVideoFixture,
  'video-and-image': buildVideoAndImageFixture,
} as const;

export type FixtureName = keyof typeof FIXTURE_BUILDERS;
