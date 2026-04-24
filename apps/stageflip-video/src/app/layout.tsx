// apps/stageflip-video/src/app/layout.tsx
// Root layout for the StageFlip.Video walking skeleton. Framework-only
// wrapping; the editor shell mounts inside the page.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'StageFlip.Video — AI-native motion for video ads',
  description:
    'StageFlip.Video is the multi-aspect video editor in the StageFlip AI-native motion platform.',
};

// Next.js App Router requires a default export for layout components.
// biome-ignore lint/style/noDefaultExport: Next.js layout contract.
export default function RootLayout({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
