---
'@stageflip/schema': minor
'@stageflip/runtimes-audience': minor
'@stageflip/app-audience-join': minor
---

T-467 — `WordCloudClip` family. Seventh audience-clip variant on
disk. Live aggregating word weights: voters submit one or more words;
the server aggregates per-word frequency; the renderer lays out the
words at sizes proportional to their weight.

Static-fallback renders a flex-wrap container of word spans. Each
span carries inline `font-size: ${14 + (weight / maxWeight) * 36}px`
(range 14..50px). `maxWeight = Math.max(...weights) || 1` (the `|| 1`
guards against the divide-by-zero edge case; the empty-words path is
gated upstream). Words are sorted defensively by weight desc; each
span carries `data-word` + `data-weight` data attributes so tests
locate spans without relying on font-size lookups. Optional prompt
(`clip.props.prompt`) renders as an `<h3>` above the cloud; total
label below reads `${totalSubmissions} submissions`. Empty-words
shape renders the "Waiting for submissions…" placeholder.

Voter UI is the SECOND multi-value text-input on the dispatcher
registry. The `<textarea>` accepts a comma-separated word list;
on submit, the parser splits on commas, trims, filters empties,
slices to `maxWordsPerVoter`, and truncates each word to
`MAX_WORD_LENGTH` (32 chars per the `WordCloudVote` contract). Empty
or whitespace-only submissions are rejected (button disabled).
After submit, the input + button disable and a "Words submitted"
status appears.

§13 (CLAUDE.md structural-extension) verification ships as
`render-e2e.test.ts` driving the static-fallback path through the
T-454 `StaticFallbackRenderer` with the spec snapshot (5 weighted
words — design/react/rust/audio/video; `totalSubmissions: 18`) and
asserting on observable DOM (5 spans in weight-desc order, font-size
proportionality verified pixel-by-pixel for every weight, total
label reads "18 submissions") plus pixel-bucket non-blank proxies
(non-zero font sizes per span; non-default panel chrome).

`ELEMENT_TYPES` length: 19 → 20. `defaultVoterInputRegistry` size: 6
→ 7. `check-audience-permissions` reports "7 audience clips
inspected" (was 6 after T-466). RIR compiler + PPTX writer extend
their exhaustive-switch coverage for the new union variant.
