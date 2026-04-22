// apps/stageflip-slide/src/app/layout.tsx
// Root layout for the StageFlip.Slide walking skeleton. Framework-only
// wrapping; the editor shell mounts inside the page.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'StageFlip.Slide — AI-native motion for presentations',
  description:
    'StageFlip.Slide is the slide-deck editor in the StageFlip AI-native motion platform.',
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
