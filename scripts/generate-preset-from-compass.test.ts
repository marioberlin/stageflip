// scripts/generate-preset-from-compass.test.ts
// Tests for T-314 compass ingest tooling — markdown → preset frontmatter generator.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { presetFrontmatterSchema } from '../packages/schema/src/presets/frontmatter.js';
import { loadCompassAnchors } from './check-preset-integrity.js';
import {
  buildPresetMarkdown,
  closestAnchors,
  parseArgs,
  parseCompassSections,
  runGenerate,
  slugify,
} from './generate-preset-from-compass.js';

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'gen-compass-'));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function writeCompass(name: string, body: string): string {
  const p = join(tmpRoot, name);
  writeFileSync(p, body, 'utf8');
  return p;
}

const SAMPLE_COMPASS = [
  '# CNN Classic',
  '',
  'CNN classic lower-third with red bar.',
  'White headline on red.',
  '',
  '## Al Jazeera English',
  '',
  'Orange-on-light bar.',
  '',
  '# BBC Reith Dark',
  '',
  'Dark mode lower-third.',
  '',
  '# F1 Sector Purple Green',
  '',
  'Sector best display.',
  '',
].join('\n');

describe('slugify', () => {
  it('matches loadCompassAnchors slug convention', () => {
    expect(slugify('CNN Classic')).toBe('cnn-classic');
    expect(slugify('  Al Jazeera English  ')).toBe('al-jazeera-english');
    expect(slugify('Foo / Bar — Baz')).toBe('foo-bar-baz');
    expect(slugify('mixed_case AND symbols!')).toBe('mixed-case-and-symbols');
  });

  it('round-trips compass anchors', () => {
    const compassPath = writeCompass('compass.md', SAMPLE_COMPASS);
    const anchors = loadCompassAnchors(compassPath);
    if (anchors === undefined) throw new Error('expected anchors to be defined');
    const sections = parseCompassSections(SAMPLE_COMPASS);
    const fromGenerator = new Set(sections.map((s) => s.slug));
    for (const slug of anchors.anchors) {
      expect(fromGenerator.has(slug)).toBe(true);
    }
    for (const slug of fromGenerator) {
      expect(anchors.anchors.has(slug)).toBe(true);
    }
  });
});

describe('parseArgs', () => {
  it('parses required + optional flags', () => {
    const { args, errors } = parseArgs([
      '--compass=docs/compass_artifact.md',
      '--section=cnn-classic',
      '--cluster=news',
      '--id=cnn-classic',
      '--clip-kind=lowerThird',
      '--out=skills/stageflip/presets/news/cnn-classic.md',
      '--source-license=ofl',
      '--preferred-font=Inter',
      '--force',
    ]);
    expect(errors).toEqual([]);
    expect(args.compass).toBe('docs/compass_artifact.md');
    expect(args.section).toBe('cnn-classic');
    expect(args.cluster).toBe('news');
    expect(args.id).toBe('cnn-classic');
    expect(args.clipKind).toBe('lowerThird');
    expect(args.out).toBe('skills/stageflip/presets/news/cnn-classic.md');
    expect(args.sourceLicense).toBe('ofl');
    expect(args.preferredFont).toBe('Inter');
    expect(args.force).toBe(true);
  });

  it('flags unknown args', () => {
    const { errors } = parseArgs(['--bogus=x']);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('closestAnchors', () => {
  it('ranks closest matches first', () => {
    const all = ['cnn-classic', 'cnn-breaking', 'bbc-reith-dark', 'al-jazeera-english'];
    const top = closestAnchors('cnn-clasic', all, 3);
    expect(top[0]).toBe('cnn-classic');
    expect(top.length).toBeLessThanOrEqual(3);
  });
});

describe('runGenerate — happy paths', () => {
  it('writes a valid preset stub for a found section', async () => {
    const compassPath = writeCompass('compass.md', SAMPLE_COMPASS);
    const out = join(tmpRoot, 'cnn-classic.md');
    const res = await runGenerate([
      `--compass=${compassPath}`,
      '--section=cnn-classic',
      '--cluster=news',
      '--id=cnn-classic',
      '--clip-kind=lowerThird',
      `--out=${out}`,
    ]);
    expect(res.exitCode).toBe(0);
    expect(existsSync(out)).toBe(true);
    const file = readFileSync(out, 'utf8');
    expect(file.startsWith('---\n')).toBe(true);
    expect(file).toContain(
      '<!-- skills/stageflip/presets/news/cnn-classic.md - Generated from compass section #cnn-classic via T-314 tooling. -->',
    );
    const parsed = matter(file);
    const fm = presetFrontmatterSchema.parse(parsed.data);
    expect(fm.id).toBe('cnn-classic');
    expect(fm.cluster).toBe('news');
    expect(fm.clipKind).toBe('lowerThird');
    expect(fm.source).toBe(`${compassPath}#cnn-classic`);
    expect(fm.status).toBe('stub');
    expect(fm.preferredFont.family).toBe('Inter');
    expect(fm.preferredFont.license).toBe('ofl');
    expect(fm.fallbackFont).toBeUndefined();
    expect(fm.signOff.parityFixture).toBe('pending-user-review');
    expect(fm.signOff.typeDesign).toBe('pending-cluster-batch'); // news = cluster A
    // body seeded with compass section text
    expect(parsed.content).toContain('CNN classic lower-third with red bar.');
  });

  it('--out override writes to caller-specified location', async () => {
    const compassPath = writeCompass('compass.md', SAMPLE_COMPASS);
    const customOut = join(tmpRoot, 'sub', 'dir', 'custom.md');
    const res = await runGenerate([
      `--compass=${compassPath}`,
      '--section=bbc-reith-dark',
      '--cluster=news',
      '--id=bbc-reith-dark',
      '--clip-kind=lowerThird',
      `--out=${customOut}`,
    ]);
    expect(res.exitCode).toBe(0);
    expect(existsSync(customOut)).toBe(true);
  });
});

describe('runGenerate — error paths', () => {
  it('exits 1 when compass file missing', async () => {
    const res = await runGenerate([
      `--compass=${join(tmpRoot, 'missing.md')}`,
      '--section=anything',
      '--cluster=news',
      '--id=foo',
      '--clip-kind=lowerThird',
      `--out=${join(tmpRoot, 'foo.md')}`,
    ]);
    expect(res.exitCode).toBe(1);
    expect(res.stderr.join('\n')).toMatch(/compass file not found|cannot read compass/i);
  });

  it('exits 1 when section slug not found and lists suggestions', async () => {
    const compassPath = writeCompass('compass.md', SAMPLE_COMPASS);
    const res = await runGenerate([
      `--compass=${compassPath}`,
      '--section=cnn-clasic', // typo
      '--cluster=news',
      '--id=cnn-classic',
      '--clip-kind=lowerThird',
      `--out=${join(tmpRoot, 'cnn-classic.md')}`,
    ]);
    expect(res.exitCode).toBe(1);
    const stderr = res.stderr.join('\n');
    expect(stderr).toContain("compass section 'cnn-clasic' not found");
    expect(stderr).toContain('cnn-classic'); // suggested
  });

  it('refuses to overwrite existing target without --force', async () => {
    const compassPath = writeCompass('compass.md', SAMPLE_COMPASS);
    const out = join(tmpRoot, 'cnn-classic.md');
    writeFileSync(out, 'existing content', 'utf8');
    const res = await runGenerate([
      `--compass=${compassPath}`,
      '--section=cnn-classic',
      '--cluster=news',
      '--id=cnn-classic',
      '--clip-kind=lowerThird',
      `--out=${out}`,
    ]);
    expect(res.exitCode).toBe(1);
    expect(res.stderr.join('\n')).toMatch(/file exists/);
    // existing content preserved
    expect(readFileSync(out, 'utf8')).toBe('existing content');
  });

  it('--force overwrites existing target', async () => {
    const compassPath = writeCompass('compass.md', SAMPLE_COMPASS);
    const out = join(tmpRoot, 'cnn-classic.md');
    writeFileSync(out, 'existing content', 'utf8');
    const res = await runGenerate([
      `--compass=${compassPath}`,
      '--section=cnn-classic',
      '--cluster=news',
      '--id=cnn-classic',
      '--clip-kind=lowerThird',
      `--out=${out}`,
      '--force',
    ]);
    expect(res.exitCode).toBe(0);
    expect(readFileSync(out, 'utf8')).not.toBe('existing content');
  });

  it('exits 1 when generated frontmatter fails schema validation', async () => {
    const compassPath = writeCompass('compass.md', SAMPLE_COMPASS);
    const res = await runGenerate([
      `--compass=${compassPath}`,
      '--section=cnn-classic',
      '--cluster=news',
      '--id=Invalid_ID', // not lowercase kebab
      '--clip-kind=lowerThird',
      `--out=${join(tmpRoot, 'foo.md')}`,
    ]);
    expect(res.exitCode).toBe(1);
    expect(res.stderr.join('\n')).toMatch(/frontmatter validation failed/i);
  });

  it('exits 2 on unknown CLI flag', async () => {
    const res = await runGenerate(['--bogus=x']);
    expect(res.exitCode).toBe(2);
  });
});

describe('runGenerate — cluster + font defaults', () => {
  it('audience cluster -> typeDesign defaults to na (cluster I exempt)', async () => {
    const compassPath = writeCompass('compass.md', SAMPLE_COMPASS);
    const out = join(tmpRoot, 'foo.md');
    const res = await runGenerate([
      `--compass=${compassPath}`,
      '--section=cnn-classic',
      '--cluster=audience',
      '--id=foo-audience',
      '--clip-kind=live-qa',
      `--out=${out}`,
    ]);
    expect(res.exitCode).toBe(0);
    const fm = presetFrontmatterSchema.parse(matter(readFileSync(out, 'utf8')).data);
    expect(fm.signOff.typeDesign).toBe('na');
  });

  it('captions cluster (F) -> typeDesign defaults to pending-cluster-batch', async () => {
    const compassPath = writeCompass('compass.md', SAMPLE_COMPASS);
    const out = join(tmpRoot, 'foo.md');
    const res = await runGenerate([
      `--compass=${compassPath}`,
      '--section=cnn-classic',
      '--cluster=captions',
      '--id=foo-captions',
      '--clip-kind=captionWord',
      `--out=${out}`,
    ]);
    expect(res.exitCode).toBe(0);
    const fm = presetFrontmatterSchema.parse(matter(readFileSync(out, 'utf8')).data);
    expect(fm.signOff.typeDesign).toBe('pending-cluster-batch');
  });

  it('weather cluster (C exempt) -> typeDesign defaults to na', async () => {
    const compassPath = writeCompass('compass.md', SAMPLE_COMPASS);
    const out = join(tmpRoot, 'foo.md');
    const res = await runGenerate([
      `--compass=${compassPath}`,
      '--section=cnn-classic',
      '--cluster=weather',
      '--id=foo-weather',
      '--clip-kind=weatherMap',
      `--out=${out}`,
    ]);
    expect(res.exitCode).toBe(0);
    const fm = presetFrontmatterSchema.parse(matter(readFileSync(out, 'utf8')).data);
    expect(fm.signOff.typeDesign).toBe('na');
  });

  it('proprietary-byo preferred font -> auto-emits Inter fallbackFont', async () => {
    const compassPath = writeCompass('compass.md', SAMPLE_COMPASS);
    const out = join(tmpRoot, 'foo.md');
    const res = await runGenerate([
      `--compass=${compassPath}`,
      '--section=cnn-classic',
      '--cluster=news',
      '--id=cnn-bespoke',
      '--clip-kind=lowerThird',
      '--source-license=proprietary-byo',
      '--preferred-font=CNN Sans',
      `--out=${out}`,
    ]);
    expect(res.exitCode).toBe(0);
    const fm = presetFrontmatterSchema.parse(matter(readFileSync(out, 'utf8')).data);
    expect(fm.preferredFont.license).toBe('proprietary-byo');
    expect(fm.preferredFont.family).toBe('CNN Sans');
    expect(fm.fallbackFont).toEqual({ family: 'Inter', weight: 600, license: 'ofl' });
  });

  it('non-byo preferred font -> no fallbackFont emitted', async () => {
    const compassPath = writeCompass('compass.md', SAMPLE_COMPASS);
    const out = join(tmpRoot, 'foo.md');
    const res = await runGenerate([
      `--compass=${compassPath}`,
      '--section=cnn-classic',
      '--cluster=news',
      '--id=cnn-ofl',
      '--clip-kind=lowerThird',
      '--source-license=ofl',
      '--preferred-font=Inter',
      `--out=${out}`,
    ]);
    expect(res.exitCode).toBe(0);
    const fm = presetFrontmatterSchema.parse(matter(readFileSync(out, 'utf8')).data);
    expect(fm.fallbackFont).toBeUndefined();
  });
});

describe('writeFileAtomic', () => {
  it('writes content to target', async () => {
    const { writeFileAtomic } = await import('./generate-preset-from-compass.js');
    const target = join(tmpRoot, 'out.txt');
    writeFileAtomic(target, 'hello');
    expect(readFileSync(target, 'utf8')).toBe('hello');
  });

  it('on rename failure cleans up temp + leaves original intact', async () => {
    const { writeFileAtomic } = await import('./generate-preset-from-compass.js');
    // Aim at an unwriteable path (parent does not exist + cannot be created
    // because it sits inside a pre-existing regular file).
    const blockerFile = join(tmpRoot, 'blocker');
    writeFileSync(blockerFile, 'not a directory', 'utf8');
    const target = join(blockerFile, 'cannot-write.txt');
    expect(() => writeFileAtomic(target, 'should-fail')).toThrow();
    // Original blocker preserved
    expect(readFileSync(blockerFile, 'utf8')).toBe('not a directory');
    // No straggling .tmp.* files in tmpRoot
    const { readdirSync } = await import('node:fs');
    const stragglers = readdirSync(tmpRoot).filter((n) => n.includes('.tmp.'));
    expect(stragglers).toEqual([]);
  });
});

describe('buildPresetMarkdown', () => {
  it('emits file header and well-formed frontmatter', () => {
    const md = buildPresetMarkdown({
      id: 'cnn-classic',
      cluster: 'news',
      clipKind: 'lowerThird',
      compassPath: 'docs/compass_artifact.md',
      sectionSlug: 'cnn-classic',
      title: 'CNN Classic',
      bodyText: 'Sample body',
      preferredFontFamily: 'Inter',
      preferredFontLicense: 'ofl',
    });
    expect(md.startsWith('---\n')).toBe(true);
    expect(md).toContain(
      '<!-- skills/stageflip/presets/news/cnn-classic.md - Generated from compass section #cnn-classic via T-314 tooling. -->',
    );
    const parsed = matter(md);
    presetFrontmatterSchema.parse(parsed.data);
    expect(parsed.content).toContain('# CNN Classic');
    expect(parsed.content).toContain('Sample body');
  });
});
