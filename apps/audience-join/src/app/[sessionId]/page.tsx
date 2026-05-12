// apps/audience-join/src/app/[sessionId]/page.tsx
// Voter landing route (T-456). Server component thin-wrapper that
// extracts the dynamic `sessionId` segment and hands it to the
// client-side `<VoterAppClient>`. Reads the apps/api base URL from
// `NEXT_PUBLIC_STAGEFLIP_API_BASE_URL` (default `http://localhost:3001`
// for local dev).
//
// The audience backend provider is owned by T-478 (native) and
// T-479..T-483 (vendor adapters); T-456 ships a stub provider that
// surfaces "no live data" so the voter app boots end-to-end. The stub
// is wired client-side via `<VoterAppClientShell>`.

import type { ReactElement } from 'react';

import { VoterAppClientShell } from './voter-app-client-shell';

interface PageProps {
  readonly params: Promise<{ readonly sessionId: string }>;
}

// Next.js App Router requires a default export for route components.
// biome-ignore lint/style/noDefaultExport: Next.js page contract.
export default async function Page({ params }: PageProps): Promise<ReactElement> {
  const { sessionId } = await params;
  const apiBaseUrl = process.env.NEXT_PUBLIC_STAGEFLIP_API_BASE_URL ?? 'http://localhost:3001';
  return <VoterAppClientShell sessionId={sessionId} apiBaseUrl={apiBaseUrl} />;
}
