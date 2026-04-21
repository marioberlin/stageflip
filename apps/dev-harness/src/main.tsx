// apps/dev-harness/src/main.tsx
// React entry point for the frame-runtime dev harness. Registers the demo
// compositions and mounts the scrub UI.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { registerDemoCompositions } from './compositions.js';
import { Harness } from './harness.js';

registerDemoCompositions();

const root = document.getElementById('root');
if (root === null) {
  throw new Error('dev-harness: #root not found in index.html');
}

createRoot(root).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
