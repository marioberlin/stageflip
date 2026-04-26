// packages/import-pptx/src/assets/content-type.test.ts
// AC #7 — inferContentType maps known extensions; unknown → octet-stream.

import { describe, expect, it } from 'vitest';
import { inferContentType } from './content-type.js';

describe('inferContentType', () => {
  it.each([
    ['ppt/media/image1.png', 'image/png'],
    ['ppt/media/photo.jpg', 'image/jpeg'],
    ['ppt/media/photo.JPEG', 'image/jpeg'],
    ['ppt/media/anim.gif', 'image/gif'],
    ['ppt/media/icon.webp', 'image/webp'],
    ['ppt/media/diagram.svg', 'image/svg+xml'],
  ])('maps %s → %s', (path, expected) => {
    expect(inferContentType(path)).toBe(expected);
  });

  // T-243b AC #13 — pin every added video extension to its IANA MIME.
  it.each([
    ['ppt/media/clip.mp4', 'video/mp4'],
    ['ppt/media/clip.MP4', 'video/mp4'],
    ['ppt/media/clip.m4v', 'video/mp4'],
    ['ppt/media/clip.mov', 'video/quicktime'],
    ['ppt/media/clip.webm', 'video/webm'],
    ['ppt/media/clip.avi', 'video/x-msvideo'],
    ['ppt/media/clip.wmv', 'video/x-ms-wmv'],
  ])('maps video %s → %s', (path, expected) => {
    expect(inferContentType(path)).toBe(expected);
  });

  it('returns application/octet-stream for unknown extensions', () => {
    expect(inferContentType('ppt/embeddings/data.bin')).toBe('application/octet-stream');
    expect(inferContentType('ppt/media/clip.flv')).toBe('application/octet-stream');
  });

  it('returns application/octet-stream when there is no extension', () => {
    expect(inferContentType('ppt/media/noext')).toBe('application/octet-stream');
    expect(inferContentType('ppt/media/trailing.')).toBe('application/octet-stream');
  });
});
