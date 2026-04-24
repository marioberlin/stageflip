// apps/stageflip-video/src/app/page.tsx
// Walking-skeleton entrypoint. Renders the client-side editor shell.

import type { ReactElement } from 'react';

import { EditorAppClient } from './editor-app-client';

// Next.js App Router requires a default export for route components.
// biome-ignore lint/style/noDefaultExport: Next.js page contract.
export default function Page(): ReactElement {
  return <EditorAppClient />;
}
