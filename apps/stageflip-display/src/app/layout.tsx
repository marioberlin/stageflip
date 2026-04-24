// apps/stageflip-display/src/app/layout.tsx
// Root layout for the StageFlip.Display walking skeleton. Framework-
// only wrapping; the editor shell mounts inside the page.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'StageFlip.Display — AI-native motion for HTML5 banners',
  description:
    'StageFlip.Display is the IAB/GDN-compliant HTML5 banner editor in the StageFlip AI-native motion platform.',
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
