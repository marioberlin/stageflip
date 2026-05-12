// apps/audience-join/src/app/join-form-client.tsx
// T-456 — Client form on the index page. On submit, navigates to
// `/[sessionId]` so the voter landing route mounts.

'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactElement, useState } from 'react';

/** Manual session-id entry form. Mounted from the index page. */
export function JoinForm(): ReactElement {
  const router = useRouter();
  const [value, setValue] = useState('');

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed === '') return;
    router.push(`/${encodeURIComponent(trimmed)}`);
  }

  return (
    <form data-testid="join-form" onSubmit={onSubmit}>
      <label htmlFor="session-id-input">Session id</label>
      <input
        id="session-id-input"
        data-testid="join-form-session-id"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
      />
      <button type="submit" data-testid="join-form-submit">
        Join
      </button>
    </form>
  );
}
