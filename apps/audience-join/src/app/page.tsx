// apps/audience-join/src/app/page.tsx
// Index page for the audience-join voter landing app (T-456). Shows
// instructions plus an "enter your code" form. The form posts to
// `/[sessionId]` — for v1 the field accepts the full session id directly
// (the room-code → session-id resolution is downstream work; v1 voters
// scan the QR which encodes the session id).

import type { ReactElement } from 'react';

import { JoinForm } from './join-form-client';

// Next.js App Router requires a default export for route components.
// biome-ignore lint/style/noDefaultExport: Next.js page contract.
export default function Page(): ReactElement {
  return (
    <main data-testid="audience-join-index">
      <h1>Join a live StageFlip session</h1>
      <p>Scan the QR code shown by the presenter, or enter your session id below.</p>
      <JoinForm />
    </main>
  );
}
