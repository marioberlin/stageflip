// apps/stageflip-slide/src/app/page.tsx
// Walking-skeleton entrypoint. Mounts <EditorShell> and renders a blank
// canvas plus a status line derived from the shell's own state.

import type { ReactElement } from 'react';
import { EditorAppClient } from './editor-app-client';

// Next.js App Router requires a default export for route components.
// biome-ignore lint/style/noDefaultExport: Next.js page contract.
export default function Page(): ReactElement {
  return <EditorAppClient />;
}
