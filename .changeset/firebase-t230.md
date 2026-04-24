---
"@stageflip/firebase-config": minor
---

T-230: Firebase hosting + rules.

Top-level `firebase.json` wires four hosting targets:

- **docs** → static Astro output at `apps/docs/dist/`.
- **slide / video / display** → Cloud Run services
  (`stageflip-{slide,video,display}`, `us-central1`) via hosting
  rewrites; Cloud Run itself lands with T-231.

`firebase/firestore.rules` enforces the T-262 role model
(`viewer` < `editor` < `admin` < `owner`) against
`/orgs/{orgId}/documents/**`, `/orgs/{orgId}/members/**`,
`/orgs/{orgId}/apiKeys/**`, and `/users/{uid}`. Deny-by-default
tail catches everything else.

`firebase/storage.rules` scopes asset writes to org members with at
least `editor`, enforces a 200 MB per-upload cap, and denies
everything outside `/orgs/{orgId}/assets/**`.

`.firebaserc` maps the four Firebase Hosting site IDs
(`stageflip-docs` / `-slide` / `-video` / `-display`) under the
`stageflip-prod` project alias.

14 unit tests — pure shape assertions against firebase.json /
.firebaserc / firestore.rules / storage.rules. Full behavioural
testing via the Firestore emulator is a Phase-12 follow-up (the
emulator needs Java, which isn't on the standard CI image yet).
