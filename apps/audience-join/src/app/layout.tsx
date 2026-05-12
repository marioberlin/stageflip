// apps/audience-join/src/app/layout.tsx
// Root layout for the audience-join voter landing page (T-456).
// Framework-only wrapping; the per-route pages own their own state.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'StageFlip — Join the live session',
  description: 'Vote, react, and engage live in a StageFlip presentation.',
};

// Next.js App Router requires a default export for layout components.
// biome-ignore lint/style/noDefaultExport: Next.js layout contract.
export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
