// packages/import-slidemotion-legacy/src/test-fixtures.ts
// Hand-rolled legacy-document fixtures for importer tests. Kept separate
// from the production surface so the test build doesn't pick them up.

export const MINIMAL_LEGACY_DOC = {
  id: 'demo-deck',
  title: 'Demo Deck',
  author: 'Jane Doe',
  created: '2025-01-01T00:00:00.000Z',
  modified: '2025-06-01T12:00:00.000Z',
  version: '1.2',
  slides: [
    {
      id: 'intro',
      title: 'Intro',
      width: 1920,
      height: 1080,
      duration: 3000,
      background: { type: 'solid', color: '#08101f' },
      elements: [
        {
          id: 'title-1',
          type: 'text',
          frame: { x: 100, y: 200, width: 1720, height: 200, rotation: 0 },
          content: { value: 'Hello, World' },
          style: { color: '#ffffff', fontFamily: 'Inter', fontSize: 72 },
        },
        {
          id: 'hero img',
          type: 'image',
          frame: { x: 100, y: 500, width: 800, height: 450 },
          assetId: 'cover.jpg',
          fit: 'cover',
        },
      ],
    },
  ],
} as const;

export const LOSSY_LEGACY_DOC = {
  id: 'loss-sample',
  created: '2025-03-01T00:00:00Z',
  modified: '2025-03-01T00:00:00Z',
  slides: [
    {
      id: 'has-unsupported',
      elements: [
        {
          id: 'good-text',
          type: 'text',
          frame: { x: 0, y: 0, width: 100, height: 50 },
          content: { value: 'ok' },
          style: {},
        },
        {
          id: 'pie-chart',
          type: 'chart',
          frame: { x: 0, y: 0, width: 400, height: 300 },
          chartType: 'pie',
          data: [],
        },
        {
          id: 'weird-shape',
          type: 'shape',
          frame: { x: 0, y: 0, width: 100, height: 100 },
          shape: 'triangle',
          style: {},
        },
        {
          id: 'bad-image',
          type: 'image',
          frame: { x: 0, y: 0, width: 100, height: 100 },
          // missing assetId
        },
      ],
      background: { type: 'gradient', kind: 'linear', stops: [] },
    },
  ],
} as const;

export const NESTED_GROUP_LEGACY_DOC = {
  id: 'nested',
  created: '2025-04-01T00:00:00Z',
  modified: '2025-04-01T00:00:00Z',
  slides: [
    {
      id: 'one',
      elements: [
        {
          id: 'outer',
          type: 'group',
          frame: { x: 0, y: 0, width: 500, height: 500 },
          children: [
            {
              id: 'inner-text',
              type: 'text',
              frame: { x: 10, y: 10, width: 400, height: 50 },
              content: { value: 'nested' },
              style: {},
            },
            {
              id: 'inner-group',
              type: 'group',
              frame: { x: 0, y: 100, width: 400, height: 300 },
              children: [
                {
                  id: 'deep-text',
                  type: 'text',
                  frame: { x: 0, y: 0, width: 300, height: 30 },
                  content: { value: 'deep' },
                  style: {},
                },
              ],
            },
          ],
        },
      ],
    },
  ],
} as const;
