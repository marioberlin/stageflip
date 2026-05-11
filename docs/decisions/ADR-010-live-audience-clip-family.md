# ADR-010: Live Audience Clip Family

**Date**: 2026-05-11
**Ratified**: pending (T-451 ratification PR; orchestrator approval)
**Status**: **Proposed**
**Supersedes**: N/A
**Superseded by**: N/A

---

## Context

ADR-009 (T-450) defined the audience **backend** — the WebSocket multiplexer, the Firestore `audience-sessions` collection extending `apps/api`, the `AudienceBackendProvider` interface (four-method contract), the rate-limit model, the SLA target, and the dual-trust-domain auth model. ADR-009 §D9 reserved the per-clip-kind shapes (`VotePayload.value` + `AggregationSnapshot.aggregation`) and the full `AudienceProvenance` schema for this ADR.

ADR-010 (this ADR) is the **clip-family ADR** — the second of two Phase 15 α hard-gate ADRs. It defines:

1. The **nine v1 audience clip families** — six standard (LivePoll multiple-choice / LivePoll open-text / LivePoll rating / LiveQA / LiveQuiz / LeaderboardClip / WordCloudClip / SurveyClip) plus three motion-native differentiators (HeatmapClip / ReactionStreamClip / AudienceAiPromptClip). The eleven `AudienceClipKind` discriminants from ADR-009 §D2 fan out across these nine clip families (LivePoll declares three sub-variants).
2. The **per-clip-kind `VotePayload.value` shapes** — the discriminated voter-side payloads each clip emits.
3. The **per-clip-kind `AggregationSnapshot.aggregation` shapes** — the discriminated presenter-side aggregation each clip consumes.
4. The **`staticFallback` snapshot semantics** — when the snapshot is taken; what bytes / JSON the persisted snapshot carries; how the renderer materializes a frame from it; how the snapshot is selected at export time. Inherits ADR-005 §D2's two-path `liveMount` / `staticFallback` contract.
5. The **full `AudienceProvenance` schema** — extends the ADR-009 §D9 preview slots (`provider`, `sessionId`, `snapshotFrame`, `voterCountAtCapture`, `capturedAt`) with the per-clip-kind aggregation slot (`aggregation` discriminated by clip kind).
6. The **`permissions: ['audience-network']` requirement** for every audience clip (per ADR-005 §D2 manifest convention; T-455 CI gate enforces).
7. The **dependency footprint** of the three motion-native differentiators — ReactionStreamClip depends on T-383 (`ShaderClip` from P13 γ); AudienceAiPromptClip depends on T-430 (Seedance video adapter) + T-432 (ACE-Step music adapter) from P14 β.
8. The **static-fallback vs. live-mount routing posture** — how the runtime selects between the two paths per ADR-005 §D2 inheritance.
9. The **Cluster I preset cluster** (~6 audience presets, T-486) downstream consumer footprint.
10. The **tenant frontier-enablement gating** posture — how `TenantSettings.features.audience.enabled` (extends the T-411a tenant-settings facet) gates whether the `liveMount` path is reachable for a given tenant; absent enablement, the clip materializes through `staticFallback`.

After this ADR + ADR-009 (T-450, merged via PR #512 / v1.28) merge, **all** of T-452+ can dispatch: `@stageflip/audience-contract` (T-452), the audience backend service (T-453), `packages/runtimes/audience/` (T-454), the nine v1 clip families (T-461 → T-471), the five vendor adapters (T-479 → T-483), and the Cluster I preset cluster (T-486).

ADR-007 §D2 reserved the consumer-ADR slot for audience-side shapes; ADR-009 fulfilled the backend-lifecycle half; this ADR fulfils the clip-family half. Together they close the audience-side reservation.

### What this ADR is **not**

- **Not the audience-backend ADR.** ADR-009 covers the backend service architecture, the `AudienceBackendProvider` interface, the rate-limit model, the SLA target, the persistence model, the WebSocket transport, the auth model, the vendor adapter bridge contract, and the loss-flag inventory. This ADR consumes those decisions; it does not redefine them.
- **Not the runtime tier ADR.** ADR-003 establishes the `interactive` runtime tier + the `liveMount` / `staticFallback` two-path contract every audience clip inherits. ADR-005 enumerates the Phase 13 frontier clip catalogue and the permissions manifest convention. ADR-010 honours both; `packages/runtimes/audience/` (T-454) extends `interactive` per ADR-003 §D1.
- **Not the schema-implementation ADR.** ADR-010 specifies the per-clip-kind shapes in TypeScript-shaped pseudocode. The actual Zod parsers + element-base merge land in T-452 (`@stageflip/audience-contract` ships the `VotePayload` + `AggregationSnapshot` discriminated unions + the eight `LF-AUDIENCE-*` loss-flag codes from ADR-009 §D11) and T-460 (`AudienceProvenance` type lands the Zod shape, including the per-clip-kind `aggregation` slot ADR-010 specifies). Those PRs DO bear the §13 obligation; this ADR is pure docs.
- **Not the parity-fixture ADR.** T-476 (Cluster I parity fixtures) ships the static-fallback parity goldens for the nine clip families. ADR-010 specifies the snapshot shape the fixtures render against; T-476 captures the bytes.
- **Not a code or schema PR.** Pure docs ADR. No code, no fixtures, no parity goldens, no skills, no packages touched.

---

## Decisions

### D1. Nine v1 audience clip families

The Phase 15 β implementation ships **nine** audience clip families spanning the eleven `AudienceClipKind` discriminants from ADR-009 §D2. LivePoll declares three sub-variants (multiple-choice / open-text / rating) that share a clip-family root and per-variant `VotePayload.value` shapes; the other six clips map one-to-one to a discriminant.

| Clip family | `AudienceClipKind` discriminant(s) | Spec task | Tier | Phase 15 β slot |
|---|---|---|---|---|
| `LivePollClip` (multiple-choice) | `live-poll-multiple-choice` | T-461 | Standard | β |
| `LivePollClip` (open-text) | `live-poll-open-text` | T-462 | Standard | β |
| `LivePollClip` (rating) | `live-poll-rating` | T-463 | Standard | β |
| `LiveQAClip` | `live-qa` | T-464 | Standard | β |
| `LiveQuizClip` | `live-quiz` | T-465 | Standard | β |
| `LeaderboardClip` | `leaderboard` | T-466 | Standard | β |
| `WordCloudClip` | `word-cloud` | T-467 | Standard | β |
| `SurveyClip` | `survey` | T-468 | Standard | β |
| `HeatmapClip` | `heatmap` | T-469 | Motion-native (#1) | β |
| `ReactionStreamClip` | `reaction-stream` | T-470 | Motion-native (#2) | β |
| `AudienceAiPromptClip` | `audience-ai-prompt` | T-471 | Motion-native (#3) | β |

**Six "standard" clips** replicate Slido / Mentimeter / Poll Everywhere parity — these are the table-stakes audience primitives every vendor offers. Native + every vendor adapter implements them per ADR-009 §D8.

**Three "motion-native differentiators"** exploit the StageFlip motion + 3D + frontier stack in ways the vendors structurally cannot reach:

- **`HeatmapClip`** — interactive image / chart / 3D scene where voters tap to register intensity. The per-voter `(x, y, intensity)` tap is aggregated into a raster heatmap blended over the underlying image. Slido offers a 2-dimensional "vote on a quadrant" primitive; none of the five vendors offer pixel-grain spatial input. The motion-platform differentiator: the heatmap is rendered live as a frame-deterministic raster on the same canvas as the image (`liveMount`), and the final snapshot is the raster at the close-frame (`staticFallback`).
- **`ReactionStreamClip`** — animated reaction river: voters tap an emoji button, particles spawn at the bottom of the screen and rise / drift / fade through a `ShaderClip` (T-383, P13 γ) compositor. Vendors offer "thumbs up / heart" reactions as static counts; the motion-platform differentiator is the visual: a particle storm at 1000 concurrent voters at a 10/voter/sec peak rate is a high-density visual no vendor can render at parity.
- **`AudienceAiPromptClip`** — voters submit a prompt (or vote among shortlisted prompts); the highest-voted prompt is sent to the P14 asset-gen pipeline (Seedance video adapter T-430 + ACE-Step music adapter T-432); the generated content is embedded in the slide as the result. The motion-platform differentiator: the result is a generated video / soundtrack, not a count or a word cloud. Slido / Mentimeter / Poll Everywhere have no equivalent primitive.

**Why nine (not seven, not eleven).** Seven would skip the open-text + rating LivePoll variants — but they have meaningfully different `VotePayload.value` shapes and different aggregation visuals, so they ship as separate clip-family entries even though they share the clip-family root. Eleven would split LivePoll into three top-level clip families — the editor's clip picker (Phase 15 δ work) groups the three under a single `LivePollClip` tile with a variant selector; declaring three separate top-level entries would multiply the picker surface for variants that share authoring intent. The nine-clip-family / eleven-discriminant split is the smallest surface that captures both authoring intent and per-discriminant payload variance.

**Why three (not two, not four) motion-native differentiators.** Two — Heatmap + ReactionStream — would skip the cross-product synergy story (AudienceAiPrompt exercises the P14 asset-gen stack). Four — adding a hypothetical "Voice Vote" (audience speaks; voice-clip routes to TTS-aware aggregator) — overlaps the v1 `VoiceClip` (ADR-005 §D1) without enough additional aggregation surface to justify a separate clip family. Three is the smallest set that exercises all three motion-platform strengths (raster aggregation + particle systems + cross-product asset-gen integration) and gives the marketing story three differentiator names, not two.

**Why no Polls-with-Multiple-Right-Answers / Ranking / Bracket variants in v1.** Out-of-scope for v1; tracked as candidate v2 clip-family additions. The discriminated `AudienceClipKind` union admits future entries without an ADR rewrite; new clip kinds extend `AudienceClipKind` + add per-clip-kind shapes in this ADR + add a row to the §D8 vendor parity matrix in ADR-009.

### D2. Per-clip-kind `VotePayload.value` shapes

Each clip kind declares the voter-side payload shape its `submitVote` accepts. The shapes are the `VotePayload.value` slot from ADR-009 §D2 — discriminated by the `kind: AudienceClipKind` discriminator already on the envelope.

```ts
// Conceptual shape — lands in @stageflip/audience-contract (T-452).
// Discriminated by VotePayload.kind (already on the envelope per ADR-009 §D2).

export type VotePayloadValue =
  | LivePollMultipleChoiceVote
  | LivePollOpenTextVote
  | LivePollRatingVote
  | LiveQAVote
  | LiveQuizVote
  | LeaderboardVote
  | WordCloudVote
  | SurveyVote
  | HeatmapVote
  | ReactionStreamVote
  | AudienceAiPromptVote;

/** LivePoll (multiple-choice): voter selects one of N options. */
export interface LivePollMultipleChoiceVote {
  readonly optionIndex: number;        // 0..(options.length - 1)
}

/** LivePoll (open-text): voter submits a free-text string. */
export interface LivePollOpenTextVote {
  readonly text: string;               // length ≤ clip.maxLength (default 280)
}

/** LivePoll (rating): voter submits a Likert score. */
export interface LivePollRatingVote {
  readonly score: number;              // 1..clip.scaleMax (default 5)
}

/** LiveQA: voter submits a question or upvotes an existing one. */
export interface LiveQAVote {
  readonly kind: 'submit' | 'upvote';
  readonly text?: string;              // present when kind === 'submit'; length ≤ 500
  readonly questionId?: string;        // present when kind === 'upvote'
}

/** LiveQuiz: voter selects an answer; server records latency for time-bonus scoring (T-473). */
export interface LiveQuizVote {
  readonly questionId: string;
  readonly optionIndex: number;        // 0..(question.options.length - 1)
}

/** Leaderboard: derived (server-side aggregation of LiveQuiz votes); no voter-side payload. */
export type LeaderboardVote = never;   // voters do not submit directly to a Leaderboard clip

/** WordCloud: voter submits one or more words. */
export interface WordCloudVote {
  readonly words: readonly string[];   // length ≤ clip.maxWordsPerVoter (default 3); per-word length ≤ 32
}

/** Survey: voter submits a multi-question response. */
export interface SurveyVote {
  readonly responses: readonly {
    readonly questionId: string;
    readonly value: string | number | readonly string[];  // per-question shape declared in the survey schema
  }[];
}

/** Heatmap: voter taps an (x, y) coordinate; intensity defaults to 1 (single tap). */
export interface HeatmapVote {
  readonly x: number;                  // 0..1 normalized to underlying image
  readonly y: number;                  // 0..1 normalized to underlying image
  readonly intensity?: number;         // 1..clip.maxIntensity (default 1; multi-tap accumulates)
}

/** ReactionStream: voter selects an emoji (per the clip's curated palette). */
export interface ReactionStreamVote {
  readonly emojiId: string;            // e.g., 'heart', 'thumbs-up', 'fire' — from clip.palette
}

/** AudienceAiPrompt: voter submits a prompt (or votes on a shortlisted prompt). */
export interface AudienceAiPromptVote {
  readonly kind: 'submit' | 'upvote';
  readonly text?: string;              // present when kind === 'submit'; length ≤ 200
  readonly promptId?: string;          // present when kind === 'upvote'
}
```

**Why discriminated by clip kind, not by call shape.** The `SubmitVoteCall` envelope (ADR-009 §D2) carries `payload.kind` as the discriminator; routing the call to the per-clip-kind validator is a single switch on `payload.kind`. Polymorphic call shapes (`submitVoteForPoll` / `submitVoteForQA` / …) would multiply the four-method contract surface from ADR-009 §D2.

**Why server-stamped fields are absent.** `eventId` / `serverTimestamp` / `accepted` live on the `VoteAck` (ADR-009 §D2); the `VotePayload.value` carries only the voter's intent. This is the audience analog of "the client says what; the server says when" — the audit trail is server-authoritative.

**Why `LeaderboardVote = never`.** A LeaderboardClip is **derived** from the parent LiveQuizClip's votes (server-side aggregation of question-by-question correctness + time-bonus scoring per T-473). Voters submit to the quiz, not to the leaderboard; the leaderboard subscribes to the quiz's aggregation snapshot stream and renders its own view. Declaring `LeaderboardVote = never` is the type-level encoding of that invariant: the routing engine refuses `submitVote` calls whose `payload.kind === 'leaderboard'`.

**Why per-clip-kind max-length / scale caps.** Open-ended fields (open-text / words / heatmap intensity / prompt text) need length caps to bound Firestore document size + protect against payload-bloat abuse. The defaults documented above are sensible v1 starting points; per-clip configuration (e.g., `LivePollOpenTextClip.maxLength: 500`) overrides the default within an absolute ceiling enforced by the audience backend (per ADR-009 §D3 rate-limit model + a payload-size limit T-453 implements).

**Voter retry semantics.** Per ADR-009 §D2, `submitVote` returns an ack durably; rate-limit refusals return `accepted: false` with `rejectReason`. For LivePoll / LiveQuiz / SurveyClip the voter's last accepted vote per question is canonical (a voter can change their answer until the question closes); for LiveQA the per-voter-per-question upvote is idempotent (a voter cannot upvote the same question twice); for HeatmapClip taps accumulate (a voter can register multiple intensity points). The per-clip-kind semantics are declared as part of the clip-family contract (T-461..T-471 implement; T-485 vendor-adapter regression suite confirms vendor adapters preserve the semantics).

### D3. Per-clip-kind `AggregationSnapshot.aggregation` shapes

Each clip kind declares the presenter-side aggregation shape its `AggregationSnapshot.aggregation` slot carries. The shapes are the discriminated payload from ADR-009 §D2's `AggregationSnapshot.aggregation: unknown` slot — typed here.

```ts
// Conceptual shape — lands in @stageflip/audience-contract (T-452).

export type AggregationValue =
  | LivePollMultipleChoiceAggregation
  | LivePollOpenTextAggregation
  | LivePollRatingAggregation
  | LiveQAAggregation
  | LiveQuizAggregation
  | LeaderboardAggregation
  | WordCloudAggregation
  | SurveyAggregation
  | HeatmapAggregation
  | ReactionStreamAggregation
  | AudienceAiPromptAggregation;

/** LivePoll (multiple-choice): per-option count + voter total. */
export interface LivePollMultipleChoiceAggregation {
  readonly kind: 'live-poll-multiple-choice';
  readonly optionCounts: readonly number[];   // length === clip.options.length
  readonly totalVotes: number;                // sum(optionCounts)
}

/** LivePoll (open-text): top-N submissions by submission order + count. */
export interface LivePollOpenTextAggregation {
  readonly kind: 'live-poll-open-text';
  readonly entries: readonly {
    readonly text: string;
    readonly count: number;                   // dedup by canonicalized text (lowercase + whitespace-trim)
  }[];                                         // length ≤ clip.topN (default 50)
  readonly totalVotes: number;
}

/** LivePoll (rating): per-score count + running mean. */
export interface LivePollRatingAggregation {
  readonly kind: 'live-poll-rating';
  readonly scoreCounts: readonly number[];    // length === clip.scaleMax
  readonly totalVotes: number;
  readonly mean: number;                       // sum(i * scoreCounts[i-1]) / totalVotes; NaN if totalVotes === 0
}

/** LiveQA: question feed sorted by upvote count; per-question metadata. */
export interface LiveQAAggregation {
  readonly kind: 'live-qa';
  readonly questions: readonly {
    readonly id: string;
    readonly text: string;
    readonly upvotes: number;
    readonly submittedAt: string;             // ISO 8601 — server-stamped
    readonly answered?: boolean;              // presenter / moderator toggle
  }[];                                         // length ≤ clip.topN (default 100)
  readonly totalQuestions: number;
}

/** LiveQuiz: per-question result + active-question pointer. */
export interface LiveQuizAggregation {
  readonly kind: 'live-quiz';
  readonly activeQuestionId: string | null;
  readonly questionResults: readonly {
    readonly questionId: string;
    readonly optionCounts: readonly number[];
    readonly correctOptionIndex: number;
    readonly totalVotes: number;
    readonly status: 'pending' | 'active' | 'closed';
  }[];
  readonly totalVoters: number;
}

/** Leaderboard: derived from LiveQuiz; ranked voter list. */
export interface LeaderboardAggregation {
  readonly kind: 'leaderboard';
  readonly quizId: string;                     // foreign key — LeaderboardClip references a LiveQuizClip
  readonly ranking: readonly {
    readonly voterToken: string;               // hashed (per ADR-009 §D5); display name resolved client-side
    readonly displayName?: string;             // voter-supplied screen name if present
    readonly score: number;
    readonly rank: number;
  }[];                                         // length ≤ clip.topN (default 10)
  readonly totalParticipants: number;
}

/** WordCloud: per-word frequency. */
export interface WordCloudAggregation {
  readonly kind: 'word-cloud';
  readonly words: readonly {
    readonly word: string;
    readonly weight: number;                   // count of occurrences across all voters
  }[];                                         // length ≤ clip.topN (default 100)
  readonly totalSubmissions: number;
}

/** Survey: per-question aggregated responses; shape is question-type-specific. */
export interface SurveyAggregation {
  readonly kind: 'survey';
  readonly questionAggregations: readonly {
    readonly questionId: string;
    readonly type: 'multiple-choice' | 'open-text' | 'rating';
    readonly aggregation: LivePollMultipleChoiceAggregation
      | LivePollOpenTextAggregation
      | LivePollRatingAggregation;
  }[];
  readonly totalResponses: number;
}

/** Heatmap: dense (x, y, intensity) array — rasterized client-side. */
export interface HeatmapAggregation {
  readonly kind: 'heatmap';
  readonly taps: readonly {
    readonly x: number;                        // 0..1 normalized
    readonly y: number;
    readonly intensity: number;
  }[];                                         // length unbounded within snapshot (per-snapshot capped by snapshot size policy)
  readonly totalTaps: number;
  readonly gridResolution: { readonly w: number; readonly h: number };  // raster grid for client-side downsampling
}

/** ReactionStream: per-emoji count + recent-burst counts for animation timing. */
export interface ReactionStreamAggregation {
  readonly kind: 'reaction-stream';
  readonly emojiCounts: readonly {
    readonly emojiId: string;
    readonly count: number;                    // lifetime count this session
    readonly recentBurst: number;              // count in last 1 s — drives particle-storm density
  }[];
  readonly totalReactions: number;
}

/** AudienceAiPrompt: prompt feed + winner. */
export interface AudienceAiPromptAggregation {
  readonly kind: 'audience-ai-prompt';
  readonly prompts: readonly {
    readonly id: string;
    readonly text: string;
    readonly upvotes: number;
  }[];                                         // length ≤ clip.topN (default 20)
  readonly winnerPromptId: string | null;
  readonly generatedAssetCacheKey: string | null;  // points to P14 asset-gen cache (ADR-008 §D1 / §D2)
}
```

**Why the snapshot frame carries the aggregation, not raw events.** ADR-009 §D5 already specifies the event/snapshot split — the durable `events/` sub-collection is the authoritative log; snapshots are pre-aggregated for fast client consumption. The `aggregation` slot is the **client-ready** view of the snapshot — clients render directly from it without re-aggregating. Server crashes between snapshots replay the `events/` sub-collection to rebuild the snapshot per ADR-009 §D5.

**Why HeatmapAggregation carries raw taps (not a pre-rasterized image).** The Heatmap visual is rendered client-side as a deterministic raster blend over the underlying image (per ADR-005 §D2 frame-deterministic posture for Shader / ThreeScene clips — ADR-005 §D2 inheritance). Carrying raw taps + a grid resolution lets the renderer rasterize at the export-target's resolution (different per export profile per ADR-005 §D4). Pre-rasterizing in the snapshot would force the export pipeline to either accept the snapshot's resolution or re-rasterize from a smaller bitmap (loss of fidelity). The size trade-off: 1000 voters × 1 tap each = ~30 KB JSON payload at 30 bytes per tap; tractable.

**Why ReactionStreamAggregation carries `recentBurst` separately from `count`.** The visual is density-driven: a 1000-voter session with a 50-emoji-per-second peak should render 50 emojis per frame, not the lifetime 50000. The `recentBurst` field (rolling 1 s window) drives particle-storm density at the client; the lifetime `count` is the audit field. Computing the burst client-side from raw events would require the client to subscribe to the events sub-collection — heavy-weight. The backend computes it on the snapshot.

**Why LeaderboardAggregation carries `quizId`.** Per D2, LeaderboardClip is derived from a LiveQuizClip. The foreign key + the parent quiz's session id is how the routing engine wires the two clips together: the LeaderboardClip subscribes to the quiz's snapshot stream and runs its own ranking pass; the quiz's `events/` sub-collection drives the derivation.

**Why AudienceAiPromptAggregation carries `generatedAssetCacheKey`.** Once the winning prompt has been routed through the P14 asset-gen pipeline (T-430 video + T-432 music adapters), the resulting generated asset is content-addressed in the P14 cache (per ADR-008 §D1). The aggregation snapshot carries the cache key so the static-fallback path can render the generated asset by fetching from the P14 cache without re-running generation. This is the cross-product synergy story made concrete: an audience vote produces a P14-cached asset, embedded in the slide.

**Aggregation snapshot cadence**: per ADR-009 §D5 — default 30 Hz for live-aggregating clips (LivePoll / LiveQA / LiveQuiz / Leaderboard / WordCloud / Survey / Heatmap / AudienceAiPrompt) and 5 Hz for ReactionStream (per the per-kind override). The cadence is the adapter's `AudienceCapabilityDescriptor.snapshotCadenceHz` declared at registration time (ADR-009 §D2); vendor adapters may declare lower cadences (e.g., Slido at 5 Hz).

### D3a. Cross-clip snapshot-size hygiene

Each per-clip-kind aggregation declares an explicit upper bound on the snapshot payload size so the Firestore `snapshots/{frameNo}` document never approaches the 1 MB per-document Firestore cap (per ADR-009 §D5).

| Clip kind | Bound | Mechanism |
|---|---|---|
| LivePoll (multiple-choice / rating) | ~1 KB | `optionCounts` array sized to `options.length` (default ≤ 10) |
| LivePoll (open-text) | ~50 KB | `entries` length ≤ `topN` (default 50; cap 200); per-entry text ≤ 500 chars |
| LiveQA | ~100 KB | `questions` length ≤ `topN` (default 100; cap 500); per-question text ≤ 500 chars |
| LiveQuiz | ~10 KB | One entry per question (default ≤ 20 questions per session); per-entry small |
| Leaderboard | ~10 KB | `ranking` length ≤ `topN` (default 10; cap 100) |
| WordCloud | ~50 KB | `words` length ≤ `topN` (default 100; cap 500) |
| Survey | ~200 KB | Sum of per-question aggregations; per-question survey limit (default 20 questions) |
| Heatmap | ~150 KB | `taps` length capped at 5000 per snapshot (server drops older taps; preserves recent-spatial-distribution fidelity over historical density) |
| ReactionStream | ~5 KB | `emojiCounts` length ≤ palette size (default 10 emojis) |
| AudienceAiPrompt | ~50 KB | `prompts` length ≤ `topN` (default 20; cap 100) |

Server-side enforcement: T-453 implements the per-clip-kind snapshot writer with the size caps from this table; exceeding a cap triggers downsampling (Heatmap: drop oldest taps; LiveQA: drop lowest-upvoted questions; WordCloud: drop lowest-weight words) — never document rejection. Snapshot continuity is preserved; aggregation fidelity degrades gracefully.

**Why a per-clip-kind cap (not a uniform "1 MB per snapshot" rule).** Different clips have different aggregation densities; uniform caps would either be too tight (HeatmapClip would saturate after 30 K taps) or too loose (LivePoll-multiple-choice would never need more than 1 KB). Per-kind caps match the natural data density.

### D4. `staticFallback` snapshot semantics

Every audience clip implements the two-path `liveMount` / `staticFallback` contract from ADR-005 §D2. `staticFallback` is the path the renderer invokes when:

1. The tenant has audience disabled at frontier-enablement (`TenantSettings.features.audience.enabled === false`) per §D9.
2. The clip is being rendered in **export mode** (MP4 / PPTX / display pre-render) where a live aggregation is impossible-by-construction; the static-fallback snapshot is the canonical render.
3. The clip is being rendered in **preview mode** before a session has been opened (the editor shows the clip's authored-defaults state — empty option bars, "No questions yet" placeholder, etc.).
4. The runtime tier denies the `liveMount` per ADR-005 §D5 permission-envelope enforcement (e.g., the device lacks WebSocket capability).

When `staticFallback` is selected, the clip renders against the **persisted snapshot bytes** — the `AggregationSnapshot` (per ADR-009 §D5 / §D2 D3 above) the backend persisted in the `snapshots/{frameNo}` Firestore sub-collection. The persisted bytes:

1. Are taken at **session close** — `closeSession` per ADR-009 §D2 stamps a `FinalSnapshot` (extends `AggregationSnapshot` with `closedAt` + `snapshotFrame`); this is the **authoritative export snapshot**. See §D5 below for `AudienceProvenance.snapshotFrame` referencing this frame.
2. Are taken **periodically** during the session — the backend emits aggregation snapshots at the cadence declared by the adapter (per §D3 / ADR-009 §D5); each snapshot is persisted to `snapshots/{frameNo}`. The static-fallback path can render against any historical frame — the snapshot history is fully addressable. Authoring-time live preview consumes the most-recent snapshot.

**Snapshot frame selection at export time.** Three policies, declared per-clip in the clip's authored configuration (defaults below; T-472 implements):

| Policy | Behaviour | Default for |
|---|---|---|
| `final` | Render the `FinalSnapshot` persisted on `closeSession`. | LivePoll, LiveQA, LiveQuiz, Leaderboard, Survey, WordCloud, AudienceAiPrompt |
| `peak` | Render the snapshot with the highest `voterCount` (or `recentBurst` for ReactionStream). | ReactionStream |
| `at-frame` | Render the snapshot at a presenter-pinned frame (e.g., "lock the heatmap at the moment of the climax"). | HeatmapClip (when pinned; otherwise `final`) |

**What bytes / JSON the persisted snapshot carries.** The Firestore `snapshots/{frameNo}` document carries (per ADR-009 §D5 + the typed `aggregation` from §D3 above):

```
/tenants/{tenantId}/projects/{projectId}/audience-sessions/{sessionId}/snapshots/{frameNo}
├── frameNo:        number
├── serverTimestamp: ISO 8601
├── voterCount:     number
└── aggregation:    AggregationValue  // typed per §D3; discriminated by `kind`
```

The clip's static-fallback path reads the document, validates the `aggregation` against the clip's expected `AggregationValue` variant (a runtime check; type-narrowing at the renderer layer), and renders the frame. Schema drift between snapshot-time and render-time (e.g., a clip-family update changes the aggregation shape) is handled via versioned schemas: each `AggregationValue` variant carries a `kind` discriminant that is stable-forever; new variants are additive; field additions are non-breaking; field removals require a new `kind`.

**How the renderer materializes the frame.** Per clip family:

- **LivePoll (multiple-choice / rating)**: render the option / score histogram bars as TextElement + ShapeElement primitives — exact pixel match per export resolution.
- **LivePoll (open-text)**: render the top-N entries as a stacked TextElement list with size scaled by `count`.
- **LiveQA**: render the top-N questions as a TextElement feed.
- **LiveQuiz**: render the active question + per-option result bars; if the quiz is closed, render the final result.
- **Leaderboard**: render the top-N ranking as a TextElement / table primitive.
- **WordCloud**: render the words as a CanvasElement laid out by the standard word-cloud algorithm (deterministic given identical word weights).
- **Survey**: render per-question aggregations as a stacked dashboard (delegating to the LivePoll renderer per question type).
- **Heatmap**: rasterize the taps array into a heatmap raster blended over the underlying image (deterministic given identical taps + grid resolution).
- **ReactionStream**: rasterize the emoji counts as a static still — the chosen frame is `peak` per the policy table above, so the rendered still represents the densest moment.
- **AudienceAiPrompt**: fetch the generated asset from the P14 cache (per `aggregation.generatedAssetCacheKey`) and render it (video frame at the slide's canonical frame, or music waveform thumbnail).

**Why a persisted snapshot (not re-aggregation at export time)**. Export-time re-aggregation would force the renderer to re-read the entire `events/` sub-collection — slow for sessions with > 10 K events, network-bound, and breaks the determinism contract (events may TTL out per ADR-009 §D5; the snapshot is durable per the same policy). The snapshot is the contract: same bytes → same pixels.

**Why session-close is the authoritative export frame**. The presenter's authored intent is "this is the final result of the audience interaction" — the close-frame captures it. Earlier snapshots are accessible for the `peak` and `at-frame` policies; `final` is the default because it matches authoring intent for the standard clips.

**Inheritance from ADR-005 §D2**. ADR-005 §D2 established the two-path contract for the seven frontier clips. ADR-010 inherits the contract verbatim for the nine audience clips: `liveMount` is the interactive surface (subscribes to the WebSocket per ADR-009 §D6, renders against the streaming aggregation); `staticFallback` is the deterministic surface (renders against the persisted snapshot). The runtime tier's permission envelope (ADR-005 §D5) is the gate between the two.

### D5. Full `AudienceProvenance` schema

ADR-009 §D9 named the shared slots (`provider`, `sessionId`, `snapshotFrame`, `voterCountAtCapture`, `capturedAt`). This ADR lands the full schema including the per-clip-kind `aggregation` slot.

```ts
// Conceptual shape — lands in T-460 (Zod + element-base merge).
//
// `AudienceProvenance` is the audience analog of `MediaProvenance` (ADR-008
// §D2): a strict, optional slot on the persisted clip element capturing how
// the static-fallback snapshot was produced, when, and from which session.

export interface AudienceProvenance {
  /** Adapter that served the session (descriptor.id from ADR-009 §D2). */
  readonly provider: string;            // e.g., 'audience-native', 'audience-slido'

  /** Stable session id (the `sessionId` from ADR-009 §D2). */
  readonly sessionId: string;

  /** The frame number of the snapshot the staticFallback path renders. */
  readonly snapshotFrame: number;

  /** Voter count captured at the snapshot frame. */
  readonly voterCountAtCapture: number;

  /** ISO 8601 of session close (matches the `closedAt` from ADR-009 §D5). */
  readonly capturedAt: string;

  /** Snapshot-selection policy used to pick the `snapshotFrame` (per §D4). */
  readonly snapshotPolicy: 'final' | 'peak' | 'at-frame';

  /** The clip kind this provenance is for. */
  readonly clipKind: AudienceClipKind;

  /** The persisted aggregation payload — typed per §D3 + discriminated by clipKind. */
  readonly aggregation: AggregationValue;
}
```

**Why include `aggregation` in the provenance (not just a pointer).** Two reasons:

1. **Export-time durability**: Once a slide with an audience clip is exported (PPTX / MP4 / static-image / display), the exported artifact MUST be renderable indefinitely — even after the Firestore session document has TTL'd out (per ADR-009 §D5 retention policy: 90 days closed / tenant-overridable). Inlining the aggregation in the provenance means the exported slide carries the bytes; re-rendering from the slide document does not depend on the backend session document still existing.
2. **Audit-trail completeness**: The provenance slot is the audit-load-bearing field for "what audience interaction produced this slide". The `aggregation` payload is part of the audit — it records the actual result, not just a pointer to it.

**Why include `snapshotPolicy` in the provenance.** The export-time selection (final / peak / at-frame) is part of the audit story — re-deriving the snapshot frame from the persisted session document later requires knowing which frame the export chose. Inlining the policy captures the choice.

**Why include `clipKind` in the provenance** (redundant with the clip's own kind). The provenance is meant to be self-contained: a tool walking the document and surfacing audience-provenance audit info should not have to dereference the clip kind from the element. Costless redundancy.

**Schema-evolution posture**: per the §D4 versioning posture, `aggregation`'s variants are discriminated by `kind` and stable-forever; new variants are additive. `AudienceProvenance` itself is additive — new fields land as optional slots; field removal requires a new container type (mirroring `MediaProvenance` evolution per ADR-008 §D2).

**Audit trail**: `provenance.provider` records which adapter served the session — `audience-native`, `audience-slido`, `audience-mentimeter`, `audience-polleverywhere`, `audience-vevox`, `audience-wooclap`. Exporters consuming the static-fallback snapshot (PPTX / MP4 / display) MAY surface "Powered by Slido" attribution when `provenance.provider === 'audience-slido'`; v1 does not require it but the slot is provisioned (matches ADR-009 §D9).

**Relationship to `MediaProvenance` (ADR-008 §D2)**: `AudienceProvenance` and `MediaProvenance` are siblings — both are strict optional provenance slots on persisted clip elements; both capture how a non-deterministic external interaction (asset generation / audience interaction) was made deterministic-at-export-time. They are not unified (the slot shapes differ enough) but they share the inlined-bytes-for-export-durability posture. `AudienceAiPromptClip` (per §D1) is the rare clip that carries **both** provenance kinds: `AudienceProvenance` records the audience vote that selected the winning prompt; `MediaProvenance` records the P14 generation that produced the resulting asset.

### D6. `permissions: ['audience-network']` requirement

Per ADR-005 §D2 (clip permissions manifest convention), every audience clip in the v1 catalogue declares `permissions: ['audience-network']` in its clip manifest. The `audience-network` permission grants the clip's `liveMount` path the capability to open a WebSocket connection to the audience-backend service (ADR-009 §D1).

**T-455 CI gate enforces** the declaration. The `check-audience-permissions` rule walks every clip-family registry entry under `packages/runtimes/audience/src/clips/**`, parses the clip manifest, and fails CI if any of:

1. The clip does not declare `permissions` at all.
2. The clip's `permissions` array does not include `'audience-network'`.
3. The clip declares a permission outside the allowlist (`audience-network` + optionally `network` for AudienceAiPromptClip's P14 fetch — confirmed in T-471 dispatch).

**Why a dedicated permission (not piggyback on `network`)** — per ADR-009 §D13. The `network` permission is too broad; `audience-network` is scoped to the audience-backend service's origin allowlist (the audience backend's domain, configured per-tenant per the existing region-router pattern). T-484 (P15 γ) ships the allowlist update applying the ADR-005 amendment landed in T-393 (`WebEmbedClip` `liveMount`).

**Tenant policy interaction**: per ADR-005 §D5 + §D9 below, the `audience-network` permission is grantable only when `TenantSettings.features.audience.enabled === true`. Tenants with audience disabled get the `staticFallback` path for any audience clip at render time (with the empty-state authored-defaults render for sessions that never opened); the `liveMount` path is denied at permission check, emitting `LF-PERMISSION-DENIED` (existing flag, per ADR-005 §D3).

**Manifest example** (LivePollClip; T-461 implements):

```ts
// packages/runtimes/audience/src/clips/live-poll-multiple-choice/manifest.ts
export const livePollMultipleChoiceManifest: ClipManifest = {
  kind: 'live-poll-multiple-choice',
  runtime: 'audience',
  interactive: true,
  permissions: ['audience-network'],
  staticFallback: { kind: 'persisted-snapshot' },
  liveMount: { kind: 'audience-provider' },
};
```

The `staticFallback.kind` + `liveMount.kind` discriminants are how the clip declares which two-path implementations it consumes; the routing engine reads them at mount time per ADR-003 §D1.

### D7. Motion-native dependency footprint (T-383 + T-430 + T-432)

The three motion-native differentiators depend on Phase 13 + Phase 14 deliverables already shipped:

| Differentiator | Depends on | Why |
|---|---|---|
| `ReactionStreamClip` | **T-383** (`ShaderClip`, P13 γ) | The particle storm is a GLSL fragment shader with declared uniforms (per ADR-005 §D2 frame-deterministic posture). The clip's `liveMount` mounts a ShaderClip child with `uReactionDensity` + `uReactionPalette` uniforms driven by the snapshot's `recentBurst` per emoji; `staticFallback` renders the same shader at the `peak` snapshot's burst values. |
| `AudienceAiPromptClip` | **T-430** (Seedance video adapter, P14 β) | The winning prompt is routed through the Seedance video-gen adapter (per ADR-008 §D5 + §D6) when the clip kind is `video`. The generated MP4 + waveform metadata is stored in the P14 asset cache (per ADR-008 §D1) and referenced via `AggregationValue.generatedAssetCacheKey` (per §D3 above). |
| `AudienceAiPromptClip` | **T-432** (ACE-Step music adapter, P14 β) | Same routing pattern when the clip kind is `music` — the winning prompt is routed through the ACE-Step music-gen adapter; the resulting WAV / FLAC + tempo metadata is stored in the P14 asset cache and referenced via the cache key. |

**Verification**: at T-470 (ReactionStreamClip impl) dispatch, the Implementer MUST verify T-383 is on `main` and the ShaderClip API surface accepts the uniforms ReactionStreamClip declares. At T-471 (AudienceAiPromptClip impl) dispatch, the Implementer MUST verify T-430 + T-432 are on `main` and the asset-gen contract surface accepts the prompt + returns a cache key matching `AudienceProvenance` schema expectations.

**Why ShaderClip (not a bespoke particle system)**. ShaderClip is the frame-deterministic motion primitive the renderer already supports across all three deployment targets (renderer-cdp / browser / on-device display per ADR-005 §D4). Building a bespoke particle system would multiply the surface; using ShaderClip is the smallest add.

**Why Seedance + ACE-Step (not all five P14 β adapters)**. AudienceAiPromptClip's v1 surface is video + music — the two highest-value generative modalities for an audience-prompt-driven interaction. TTS (Kokoro / Fish Speech), 3D (Tripo / Meshy), and SFX are out-of-scope for v1; tracked as v2 extensions. The clip-family discriminated union admits the future extension without an ADR rewrite (the `kind` field on AudienceAiPromptClip extends).

**Failure mode**: if T-430 / T-432 are not on `main` when T-471 dispatches, the Implementer escalates per CLAUDE.md §6 (escalation triggers). The audience-clip-family ADR is the artifact T-471 cites for the dependency; the orchestrator confirms P14 β status before unblocking T-471.

### D8. Static-fallback vs. live-mount routing posture

Per ADR-005 §D2 (two-path contract) + ADR-005 §D5 (permission envelope enforcement) + ADR-009 §D2 / §D13 (adapter routing + `audience-network` permission). The runtime selects between `liveMount` and `staticFallback` at mount time:

```
Mount-time decision tree (per audience clip; pseudo-code):

1. Is the render target an export profile (MP4 / PPTX / display pre-render)?
   YES → staticFallback (export mode is never live).

2. Is the tenant's `TenantSettings.features.audience.enabled` true?
   NO → staticFallback (permission denied at envelope check; emits LF-PERMISSION-DENIED per ADR-005 §D3).

3. Is there an `AudienceBackendProvider` available that:
   a) declares supportedClipKinds including this clip's kind, AND
   b) is licensed per the tenant's adapter policy (ADR-007 §D3)?
   NO → staticFallback (emits LF-AUDIENCE-ADAPTER-UNAVAILABLE per ADR-009 §D11).

4. Does the current device support WebSocket (per ADR-005 §D5 capability check)?
   NO → staticFallback (capability gate; same as feature-flag denial).

5. Does the clip have a persisted FinalSnapshot from a prior session?
   YES + presenter has selected "show final result" → staticFallback (rendered against the persisted snapshot, even in editor preview mode).
   NO + this is editor preview → liveMount in dry-run mode (no session opened; renders authoring-defaults).
   else → liveMount (subscribe to live aggregation).
```

**The decision is per-mount, not per-document.** A single clip element in a document may render via `liveMount` in the editor (presenter is actively running the session), via `staticFallback` in MP4 export (the persisted snapshot), and via `liveMount` again on the on-device display player when the presenter re-runs the session. The `AudienceProvenance` slot (§D5) is populated only when the static-fallback path is taken at export time; live-mount renders do not write provenance (the live aggregation is not the canonical export).

**Empty-state authoring**: when `liveMount` is the path but no session has been opened (editor preview, fresh slide), the clip renders an **authoring-defaults** state — empty option bars for LivePoll, "No questions yet" for LiveQA, empty word cloud for WordCloud, etc. This is not the static-fallback path (which requires a persisted snapshot) — it's a third "empty live mount" render state. T-461..T-471 each declare their empty-state visual; T-487 ships per-clip authoring templates.

**Why a three-state model (live / static-fallback / empty live-mount)** rather than two. The two-path contract (ADR-005 §D2) is the renderer-level contract; the editor's authoring-preview state is a third visual the user sees while authoring a clip that has not yet been bound to a live session. Conflating empty live-mount with static-fallback would force the editor to write a fake "no votes yet" snapshot to Firestore on slide creation — wasteful + clutters the audit trail. Three states is the correct abstraction; the renderer-level contract remains two.

### D9. Tenant frontier-enablement gating

Per ADR-005 §D3 (feature-flag posture: `features.interactive`) and T-411a (tenant-settings facet). Audience clips extend the tenant-settings facet with a dedicated `features.audience` sub-namespace:

```ts
// Extends TenantSettings.features from T-411a; lands in T-454 + T-455.

interface TenantSettingsFeaturesAudience {
  /** Master gate: does this tenant have audience clips enabled at all? */
  readonly enabled: boolean;                   // default: false

  /** Per-tenant ingest rate ceiling — extends ADR-009 §D3 per-tenant cap. */
  readonly maxIngestRateHz: number;            // default: 100

  /** Per-tenant concurrent voters cap per session — extends ADR-009 §D3 per-session cap. */
  readonly maxConcurrentVotersPerSession: number;  // default: 1000

  /** Audience-results retention policy in days (overrides ADR-009 §D5 default). */
  readonly retentionDays?: number;             // default: 90 (closed sessions)

  /** Adapter selection policy: which AudienceBackendProvider(s) this tenant is licensed for. */
  readonly licensedAdapters: readonly string[];  // e.g., ['audience-native', 'audience-slido']

  /** Whether the tenant requires authenticated voters (per ADR-009 §D7). */
  readonly requireAuthenticatedVoters?: boolean;  // default: false (anonymous)

  /** Whether motion-native differentiators (Heatmap / ReactionStream / AudienceAiPrompt) are enabled
   *  for this tenant — gated separately from the standard six clips to support phased rollout. */
  readonly motionNativeEnabled?: boolean;       // default: false (preview-only at v1 GA)
}
```

**Three-state enablement posture** (matches ADR-005 §D3's `'disabled' | 'preview' | 'ga'` pattern, expressed here via the boolean flags rather than a single tri-state for finer control):

| State | `features.audience.enabled` | `motionNativeEnabled` | What works |
|---|---|---|---|
| Disabled | `false` | `false` | All audience clips render via `staticFallback`; no live sessions. |
| Preview (standard only) | `true` | `false` | Six standard clips' `liveMount` paths active; motion-native renders via `staticFallback` only. |
| Preview (full) | `true` | `true` | All nine clip families' `liveMount` paths active. |
| GA | `true` | `true` (post-security-review per T-488) | All nine clip families' `liveMount` paths active on **all** deployment targets including on-device display player. |

**Why a separate `motionNativeEnabled` flag** (not folded into `enabled`). The three motion-native differentiators consume the P13 / P14 stacks — ShaderClip + asset-gen. Tenant rollout may proceed independently for the two surfaces: a tenant may want the six standard clips enabled before the motion-native trio is ready (e.g., they have not licensed the P14 video adapter). The two-flag split matches the rollout reality; merging them would force motion-native readiness onto the standard-clip enablement gate.

**Tenant-settings facet pattern**: the audience sub-namespace lives in the same `TenantSettingsStore` (T-411a) the rest of the tenant-settings facet uses. No new storage facet is needed — `TenantSettingsStore` is the 3-method contract (read / write / list) and the audience sub-namespace is a typed sub-tree under `features`. The TenantVoiceConsentStore carve-out (ADR-008 §D4) was needed because voice-consent is per-call + audit-load-bearing; audience-enabled is per-tenant + a configuration value — the same facet covers it.

**Why `licensedAdapters` is per-tenant**. ADR-007 §D3 (license-aware routing) already established that adapter availability is tenant-scoped. The audience namespace records which audience adapters the tenant is licensed for; the routing engine consumes this list when selecting an `AudienceBackendProvider`. Native is implicit (open-source / always available); vendor adapters are explicit (the tenant has a Slido enterprise tier, etc.).

**Failure mode**: a tenant attempting to author a clip whose kind is not in `licensedAdapters`' combined `supportedClipKinds` gets a clip-picker warning at authoring time (T-487 implements) + a render-time `staticFallback` fallback that surfaces a "this clip requires a licensed adapter" placeholder.

### D10. Cluster I preset cluster (~6 audience presets)

T-486 ships the Cluster I preset cluster as ~6 named compositions that exercise the nine clip families. The preset list (illustrative; T-486 dispatch confirms):

| Preset | Clip families exercised | Compass source |
|---|---|---|
| `slido-classic-poll` | LivePollClip (multiple-choice) | Slido — the canonical incumbent live-poll preset |
| `mentimeter-bar-vote` | LivePollClip (multiple-choice + rating composite) | Mentimeter — bar-vote with attached Likert rating |
| `kahoot-competitive` | LiveQuizClip + LeaderboardClip | Kahoot — the canonical quiz + leaderboard composite |
| `bbc-question-time` | LiveQAClip | BBC Question Time — moderated panel Q&A with upvotes |
| `conference-qa-upvote` | LiveQAClip + WordCloudClip | Conference-style speaker Q&A with topic word-cloud sidebar |
| `classroom-quiz` | LiveQuizClip + SurveyClip | Classroom — quiz followed by post-quiz survey |

The three motion-native differentiators (Heatmap / ReactionStream / AudienceAiPrompt) appear as **single-clip showcase presets** rather than as part of multi-clip compositions in v1; tracked as candidate composite presets for v2.

**Compass sourcing**: matches the Phase 12 / Phase 13 / Phase 14 compass-source convention (per ADR-004 + presetSpec §1). Each preset cites its compass source in its preset markdown (T-486 ships); reviewers verify per the compass-source-and-reference-frame parity workflow (CLAUDE.md §6 escalation trigger).

**Preset cluster ratification**: T-486 ships the six presets each with parity goldens; T-476 ships the Cluster I parity fixtures for the static-fallback paths; sign-off follows the standard preset-frontmatter sign-off flow per the `parity-fixture-signoff.md` procedural note (memory: parity-fixture-signoff is procedural — preset specs MUST NOT instruct Implementers to append entries; sign-off lives in preset frontmatter only).

**Why six (not the per-clip-family count of nine).** Six presets covers the canonical incumbent patterns (Slido / Mentimeter / Kahoot / BBC / conference / classroom) which span eight of the nine clip families (Survey + WordCloud + the three motion-native ones are each covered in at least one preset; LivePoll variants + LiveQuiz + Leaderboard + LiveQA are each in multiple). Six presets ratifies the clip families against real-world authoring patterns; nine would force a one-preset-per-clip pattern that does not match how authors compose audience interactions.

### D11. Determinism posture (inherited from ADR-009 §D10)

The audience clip implementations live under `packages/runtimes/audience/src/clips/**` — **inside** the determinism perimeter (CLAUDE.md §3). Each clip:

- **`liveMount` path**: uses non-deterministic primitives (WebSocket, time-of-day for ack tracking, RNG for retry jitter). Per ADR-003 §D5 + ADR-005 §D2 the interactive runtime tier permits these via the runtime-shim mechanism — the shim overrides `requestAnimationFrame` with a frame-driven scheduler, and time-of-day is read via the runtime's `mountedAt` slot, not direct `Date.now()`.
- **`staticFallback` path**: deterministic-by-construction. Given identical snapshot bytes (the persisted `AggregationValue` from §D3), the static-fallback render emits identical pixels regardless of when it runs. T-476 (Cluster I parity fixtures) verifies via parity goldens. Frame-deterministic clips that use sub-clips (ReactionStreamClip → ShaderClip, HeatmapClip → CanvasElement) inherit the sub-clip's determinism.

**Per-clip-kind determinism notes**:

- **LivePoll (all three variants)**: static-fallback renders the bar / list / score-histogram from `optionCounts` / `entries` / `scoreCounts` — pure layout pass, deterministic.
- **LiveQA**: top-N question list — pure layout pass, deterministic.
- **LiveQuiz**: per-question result bars — same as LivePoll multi-choice, deterministic.
- **Leaderboard**: rank-ordered list — pure layout pass, deterministic.
- **WordCloud**: layout uses a **seeded** word-cloud algorithm (seed = hash of session id; same input → same output). The CanvasElement renderer is frame-deterministic per ADR-005 §D2 inheritance.
- **Survey**: composition of per-question renderers, each deterministic.
- **Heatmap**: rasterization is deterministic given identical taps + grid resolution. The shader (when used for blending) is frame-deterministic per ADR-005 §D2.
- **ReactionStream**: rendered at the `peak` snapshot; ShaderClip pass is frame-deterministic given identical uniforms (per ADR-005 §D2). Live-path observably non-deterministic (particles spawn at random screen positions seeded by the voter token); static-fallback path is the snapshot of one frame and is reproducible-given-identical-snapshot.
- **AudienceAiPrompt**: static-fallback renders the generated asset from the P14 cache (per ADR-008 §D1 content-addressed cache). Re-fetching by cache key yields identical bytes; the renderer's video / waveform-thumbnail pass is deterministic per ADR-008's MediaProvenance posture.

**Live-aggregation latency variability** (per ADR-009 §D10): same voter input across two live runs MAY produce different per-frame `voterCount` trajectories. The **final snapshot** is reproducible-given-identical-events because the aggregation is deterministic over the persisted `events/` sub-collection. The live path is observably non-deterministic; the export-time path is contractually deterministic.

### D12. Loss-flag inventory (inherited from ADR-009 §D11)

ADR-010 does not add new loss flags. The eight `LF-AUDIENCE-*` codes from ADR-009 §D11 cover the clip-family failure modes:

| Code (from ADR-009 §D11) | Where the clip emits |
|---|---|
| `LF-AUDIENCE-TENANT-RATE-LIMITED` | Voter UX surface when the tenant's ingest cap kicks in |
| `LF-AUDIENCE-VOTER-RATE-LIMITED` | Silently dropped — but the reporter UI counter increments |
| `LF-AUDIENCE-SESSION-CLOSED` | Voter UX surface after the session closed |
| `LF-AUDIENCE-CONNECTION-LOST` | Voter UX surface after the §D6 retry budget exhausts |
| `LF-AUDIENCE-ADAPTER-UNAVAILABLE` | At clip mount time when no adapter matches |
| `LF-AUDIENCE-VENDOR-API-FAILURE` | Within a vendor-adapter session; clip falls through to staticFallback or empty-state |
| `LF-AUDIENCE-SNAPSHOT-MISSING` | At export time when the referenced `snapshotFrame` is not in `snapshots/` (corruption signal) |
| `LF-AUDIENCE-CAPACITY-CAP` | At `openSession` time when the per-tenant per-session voter cap is reached |

**No new loss flags**: the clip-family failure modes are covered by the backend-level flags. Per-clip-kind UX surfacing (e.g., "Voting closed" placeholder vs. "Voting paused — retry" toast) is presentation-layer; the underlying signal is one of the eight codes.

### D13. Plugin manifest extensions (inherited from ADR-009 §D12)

ADR-010 does not add new plugin manifest shape. The `audience-backend-provider` contribution kind from ADR-009 §D12 already covers the per-adapter declaration; per-clip-family extensions land in T-454 (`packages/runtimes/audience/`) as runtime registry entries, not as additional manifest declarations.

A future "audience-clip-family contribution kind" — a way for third-party plugins to ship custom audience clips — is **out-of-scope for v1**. The clip-family registry is closed at v1 (the nine families enumerated in D1); extending it requires (a) editing the `AudienceClipKind` discriminated union in `@stageflip/audience-contract` (T-452 / the schema package), (b) adding per-clip-kind shapes to this ADR, (c) shipping a clip-family implementation in `packages/runtimes/audience/src/clips/`. The Phase 16 marketplace surface (per ADR-007 §D12) covers the third-party-plugin path; v1 keeps the clip-family list closed.

---

## Out-of-scope decisions (deferred)

| Question | Punted to |
|---|---|
| `@stageflip/audience-contract` package layout (per-call shapes + Zod parsers for the discriminated unions specified here) | T-452 |
| Audience backend service implementation (`apps/api` extension + Firestore wiring) | T-453 |
| `packages/runtimes/audience/` runtime tier (interactive tier extension per ADR-003) | T-454 |
| `check-audience-permissions` CI rule implementation | T-455 |
| Voter-join UX (QR + code modal + landing page) | T-456 |
| `tools/audience-engagement/SKILL.md` semantic tool bundle (#19) | T-457 |
| Rate-limit / spam-protection implementation (per ADR-009 §D3) | T-458 |
| CSV / JSON post-event analytics export | T-459 |
| `AudienceProvenance` schema implementation (Zod + element-base merge) | T-460 |
| LivePollClip (multiple-choice) implementation | T-461 |
| LivePollClip (open-text) implementation | T-462 |
| LivePollClip (rating / Likert) implementation | T-463 |
| LiveQAClip implementation | T-464 |
| LiveQuizClip implementation | T-465 |
| LeaderboardClip implementation | T-466 |
| WordCloudClip implementation | T-467 |
| SurveyClip implementation | T-468 |
| HeatmapClip implementation | T-469 |
| ReactionStreamClip implementation | T-470 |
| AudienceAiPromptClip implementation | T-471 |
| Static-fallback paths consolidated across all 9 clip families | T-472 |
| Quiz fairness — tie-breaking, late-joiner, disconnect/reconnect | T-473 |
| Audience-data persistence — TTL + EU residency posture | T-474 |
| Live-aggregation latency tests (p50 < 200 ms, p95 < 500 ms per ADR-009 §D4) | T-475 |
| Cluster I parity fixtures (static-fallback paths) | T-476 |
| Audience-backend SLA load test — 1000 concurrent voters via K6 | T-477 |
| `@stageflip/audience-native` reference implementation | T-478 |
| Vendor adapters (Slido / Mentimeter / Poll Everywhere / Vevox / Wooclap) | T-479 → T-483 |
| WebEmbed allowlist update for audience origins | T-484 |
| Vendor adapter regression suite | T-485 |
| Cluster I preset cluster (~6 presets) | T-486 |
| Cluster I `SKILL.md` + `compose_*` semantic tools | T-487 |
| GA readiness + security review | T-488 |
| Phase 15 closeout handover | T-489 |
| v2 clip families (Polls-with-Multiple-Right-Answers / Ranking / Bracket variants) | Future v2 |
| v2 motion-native fourth differentiator (Voice Vote) | Future v2 |
| Third-party-plugin audience-clip-family contribution kind | Phase 16 marketplace |
| Composite presets exercising motion-native trio | Future v2 (post Cluster I) |
| Multi-tenant cross-session leaderboard aggregation | Out-of-scope for v1 (LeaderboardClip is per-quiz) |
| Per-voter analytics dashboard (cohort-level voter behaviour) | Out-of-scope for v1 (anonymous-by-default; the data is not collected) |

---

## Consequences

### Immediate (Phase 15 α hard gate cleared)

- **Together with ADR-009 (T-450, merged 2026-05-11 via PR #512 / v1.28), this ADR clears the Phase 15 α hard gate.** All of T-452+ can dispatch.
- **T-452** (`@stageflip/audience-contract`) implements the `VotePayloadValue` + `AggregationValue` discriminated unions from §D2 + §D3, the `AudienceProvenance` schema from §D5 (with T-460 doing the Zod + element-base merge), plus the eight `LF-AUDIENCE-*` loss-flag codes from ADR-009 §D11.
- **T-453** (audience backend service) implements the per-clip-kind snapshot writers per §D3a size hygiene + the snapshot-selection policies per §D4.
- **T-454** (`packages/runtimes/audience/`) implements the runtime tier hosting the nine clip families with the §D6 permission declaration + the §D8 routing decision tree.
- **T-455** (`check-audience-permissions`) enforces §D6 on every clip-family manifest.
- **T-460** (`AudienceProvenance` type) implements the full §D5 schema.
- **T-461 → T-471** (the nine clip family implementations) each consume the §D2 + §D3 + §D4 contracts; each ships with the §D6 permission declaration; T-470 verifies T-383 dependency; T-471 verifies T-430 + T-432 dependencies.

### Downstream (Phase 15 β + γ)

- All nine clip family implementations (T-461 → T-471) ride the §D2 / §D3 / §D4 contracts.
- T-472 (static-fallback paths consolidated) implements the per-clip rendering pseudo-code from §D4.
- T-476 (Cluster I parity fixtures) captures the static-fallback parity goldens for the nine clip families; verifies the §D11 determinism posture.
- The five vendor adapters (T-479 → T-483) implement `AudienceBackendProvider` per ADR-009 §D2; per-vendor capability variance flows through `supportedClipKinds` (per ADR-009 §D8 vendor parity matrix) — Slido / Mentimeter / Poll Everywhere / Vevox / Wooclap each declare which of the eleven `AudienceClipKind` discriminants they support.
- T-485 (vendor adapter regression suite) verifies vendor-adapter behavioural parity against the nine clip families' contract per §D2 retry semantics + §D3 aggregation snapshot shape.
- T-486 (Cluster I preset cluster) ships the six presets enumerated in §D10.

### Downstream (Phase 16)

- The closed v1 clip-family list (§D1 + §D13) defers the third-party-plugin-extends-clip-families story to the Phase 16 marketplace ADRs (ADR-012 / ADR-013 / ADR-014). The `AudienceClipKind` discriminated union can be re-opened by a future ADR (the union is `string`-typed at the call-shape level per ADR-009 §D2; closing it in code via Zod's strict discriminated-union mechanism is the §D1 enforcement).

### Ongoing

- New audience clip family → extend `AudienceClipKind` (ADR-009 §D2) + add `VotePayloadValue` variant (§D2) + add `AggregationValue` variant (§D3) + declare per-clip-family static-fallback render (§D4) + add row to ADR-009 §D8 vendor parity matrix + add per-kind snapshot-size cap row to §D3a.
- New `AudienceProvenance` slot → additive extension; mirrors the `MediaProvenance` evolution posture from ADR-008 §D2.
- New snapshot-selection policy → extend §D4 policy table + extend `AudienceProvenance.snapshotPolicy` union + ship the policy implementation in T-472's downstream.
- Motion-native fourth differentiator (Voice Vote v2 candidate) → new ADR (or amendment to this one) defining the integration with v1 `VoiceClip` (ADR-005 §D1); requires Phase 13 / Phase 14 cross-product alignment.

### Risks

- **Per-clip-kind shape drift between this ADR and T-452 implementation.** The shapes here are TypeScript-shaped pseudocode; the real Zod parsers may surface field-naming inconsistencies. Mitigation: T-452's review pass walks every field in every variant against this ADR; reviewers cross-check the discriminated-union shape at PR time.
- **Snapshot size cap downsampling under-fidelity.** §D3a's downsampling (drop oldest taps for HeatmapClip, drop lowest-upvoted questions for LiveQA, drop lowest-weight words for WordCloud) is a graceful-degrade — but pathological sessions (e.g., 50 K taps in a Heatmap) lose the spatial-distribution tail. Mitigation: T-453's snapshot writer documents the policy + emits a telemetry signal when downsampling kicks in; T-475's load test surfaces the threshold.
- **Authoring-defaults state drift across clip families.** §D8's three-state model (live / static-fallback / empty live-mount) requires T-461..T-471 to each declare an authoring-defaults visual. Inconsistent visuals across the nine clips would surface as a fragmented editor UX. Mitigation: T-487 ships per-clip authoring templates in a single PR; the visual consistency check is part of T-487 review.
- **P14 cache eviction breaking AudienceAiPromptClip exports.** ADR-008 specifies the P14 cache is content-addressed but does not (yet) declare a TTL policy. If the P14 cache evicts a generated asset before an AudienceAiPromptClip-bearing slide is exported, the export would fail to render. Mitigation: AudienceAiPromptClip's `AudienceProvenance.aggregation.generatedAssetCacheKey` is the routable reference; the export pipeline (T-472) is responsible for pinning the referenced cache entries against eviction. Tracked as a T-471 concern + flagged for the GA security review T-488.
- **Vendor-adapter aggregation-shape drift.** Vendor APIs return aggregations in vendor-specific shapes; the adapter is responsible for normalizing into the §D3 shapes. Vendor-side schema drift (Slido changes its poll API response format) breaks the adapter. Mitigation: T-485's regression suite catches drift; each vendor adapter pins its vendor SDK version; loss flag `LF-AUDIENCE-VENDOR-API-FAILURE` surfaces transient failures.
- **Provenance bloat across exports with many audience clips.** A 100-slide PPTX with one audience clip per slide carries 100 `AudienceProvenance` slots, each with a potentially-large `aggregation` payload. Total provenance bytes could exceed reasonable PPTX size. Mitigation: §D3a snapshot caps bound per-clip provenance to < 200 KB worst-case (Survey); a 100-clip deck carries < 20 MB of provenance — acceptable for PPTX / MP4 sidecar metadata.
- **`audience-network` permission scope ambiguity for AudienceAiPromptClip.** The clip needs `audience-network` for the audience-side WebSocket but also network access to the P14 asset-gen pipeline (which lives behind `apps/api` per ADR-008). Whether AudienceAiPromptClip needs `permissions: ['audience-network', 'network']` or `permissions: ['audience-network']` only (with the P14 fetch routed through the audience backend) is a T-471 dispatch question. Mitigation: T-471 spec confirms the routing posture; T-455 ratifies the permission allowlist for AudienceAiPromptClip.

---

## Alternatives Considered

### A. Unify LivePoll variants under a single clip family with a `variant` field

**Rejected per §D1.** A single `LivePollClip` with `variant: 'multiple-choice' | 'open-text' | 'rating'` would collapse the three discriminant rows into one, but the `VotePayload.value` shape varies discriminately per variant (number index vs. string text vs. Likert score) and the `AggregationSnapshot.aggregation` shape varies discriminately too. The variant field would force a polymorphic union inside the clip — the same surface a discriminated `AudienceClipKind` already expresses, but with extra indirection. Three discriminants is the smaller surface.

### B. Polymorphic `submitVote{ForPoll, ForQA, ForQuiz, …}` calls instead of one `submitVote` discriminated by payload kind

**Rejected per §D2.** ADR-009 §D2 fixed the four-method contract surface (`openSession` / `submitVote` / `subscribe` / `closeSession`); per-clip-kind method variants would multiply the surface from four to ~13. The single-method-discriminated-by-payload-kind is the smaller contract. Vendor adapters benefit: a vendor's vote endpoint accepts a payload; the StageFlip-side routing engine peels off `payload.kind` and dispatches to the vendor-specific translator, all behind one method.

### C. Pre-rasterize HeatmapClip snapshots (carry the raster image, not the taps array)

**Rejected per §D3.** Pre-rasterization would freeze the raster at the snapshot-time resolution; export at a different resolution would either accept the snapshot's resolution (loss of fidelity at higher export resolution) or re-rasterize from a smaller bitmap (interpolation artifacts). Carrying the raw taps + a grid resolution lets each export rasterize at its own resolution. The size trade-off (~150 KB max per snapshot at 5 K taps) is tractable.

### D. Pointer-only `AudienceProvenance.aggregation` (Firestore document reference, not inlined payload)

**Rejected per §D5.** Exported slides MUST be renderable indefinitely — even after the Firestore session document has TTL'd out (per ADR-009 §D5: 90-day default retention). A pointer-only provenance would fail to render once the backing document is gone. Inlining the aggregation payload makes the exported slide self-contained. The mirror of ADR-008's MediaProvenance posture (cache-key + bytes-where-needed) — the audience analog is the same.

### E. Two-state model (live / static-fallback) without the "empty live-mount" third state

**Rejected per §D8.** Conflating empty live-mount with static-fallback would force the editor to write a fake "no votes yet" snapshot to Firestore on slide creation — wasteful + clutters the audit trail + breaks the staticFallback contract (which expects a persisted-at-session-time snapshot, not an editor-fabricated empty one). The three-state model matches the editor's authoring lifecycle; the renderer-level two-path contract (ADR-005 §D2) is preserved at the runtime layer.

### F. Unified `features.audience.tier: 'disabled' | 'preview' | 'ga'` field instead of two-flag enablement

**Rejected per §D9.** ADR-005 §D3 chose a tri-state for `features.interactive`; ADR-010 chose two-flag for `features.audience` because motion-native and standard-clip readiness are not strictly ordered for a given tenant — a tenant may have the six standard clips enabled (and live in production) while the motion-native trio remains preview-only pending P14 adapter licensing. A unified tier would force motion-native readiness onto the standard-clip enablement gate. Two flags expresses the rollout reality.

### G. Add `AudienceProvenance` to `MediaProvenance` (unify under one provenance type)

**Rejected per §D5.** The two provenance shapes overlap in posture (audit-trail-for-non-deterministic-external-interaction) but differ enough in slots (`AudienceProvenance` carries `sessionId` + `voterCountAtCapture` + aggregation; `MediaProvenance` carries `prompt` + `seed` + `cacheKey`) that a unified type would be a Zod-`union` requiring discriminator-and-cast at every access site. Two strict types is the simpler client surface; the rare case where both apply (AudienceAiPromptClip) carries both as independent optional slots.

### H. Defer the per-clip-kind `aggregation` shapes to T-452 (implementation PR), not this ADR

**Rejected.** The plan-row for T-451 (`docs/implementation-plan.md` Phase 15 α row) explicitly cites "the 9 v1 clips; `staticFallback` snapshot semantics; `AudienceProvenance` schema" as this ADR's scope. Without the per-clip-kind shapes, the downstream specs T-461..T-471 + T-472 + T-476 + T-486 cannot dispatch (they each cite this ADR for the contract surface they consume). Deferring would push the per-clip-kind contract surface into individual clip-family PRs — a fragmented contract is harder to keep coherent.

### I. Three motion-native differentiators sized differently (only Heatmap; Heatmap + ReactionStream; four-including-Voice-Vote)

**Rejected per §D1.** Only Heatmap would skip the high-density-particle-system story (ReactionStream) and the cross-product-asset-gen-integration story (AudienceAiPrompt). Two would skip cross-product. Four-with-Voice-Vote overlaps the v1 VoiceClip (ADR-005 §D1) without enough additional aggregation surface to justify a separate clip family. Three is the smallest set exercising raster aggregation + particle systems + cross-product integration.

---

## References

- `docs/decisions/ADR-009-audience-backend.md` — sibling Phase 15 α ADR (T-450; merged 2026-05-11 via PR #512 / v1.28). This ADR consumes ADR-009 §D2 (`AudienceBackendProvider` interface + `AudienceCapabilityDescriptor` + `AudienceClipKind` enumeration), §D5 (persistence model + snapshot cadence), §D9 (`AudienceProvenance` shared slots — full schema in this ADR §D5), §D10 (determinism posture inherited), §D11 (loss-flag inventory), §D12 (plugin manifest), §D13 (`audience-network` permission cross-reference).
- `docs/decisions/ADR-007-provider-seam-pattern.md` — meta-pattern ADR-009 (and indirectly this ADR) extends; §D1 (`AdapterDescriptor` shape), §D2 (modality reservation table), §D3 (license-aware routing — referenced in §D9 of this ADR).
- `docs/decisions/ADR-008-asset-generation.md` — sibling consumer ADR; the `MediaProvenance` (§D2) template `AudienceProvenance` mirrors; the content-addressed cache (§D1) `AudienceAiPromptClip` consumes via §D3 / §D7 of this ADR; the seven β modality contracts §D5 / §D6 establish the asset-gen seam T-430 + T-432 ride.
- `docs/decisions/ADR-005-frontier-clip-catalogue.md` — clip-permissions manifest convention + `liveMount` / `staticFallback` two-path contract this ADR inherits (§D2 covered the seven frontier clips; the nine audience clips slot the same way); §D5 (permission envelope enforcement) §D8 of this ADR cites.
- `docs/decisions/ADR-003-interactive-runtime-tier.md` — `interactive` runtime tier `packages/runtimes/audience/` extends per ADR-009 / T-454; §D1 (tier contract); §D5 (frame-deterministic clip exemption from determinism perimeter).
- `docs/decisions/ADR-004-preset-system.md` — preset system foundation Cluster I (T-486 / §D10 of this ADR) consumes.
- `docs/tasks/T-450.md` — predecessor task spec (ADR-009 Audience Backend).
- `docs/implementation-plan.md` — Phase 15 α (T-450 → T-460), Phase 15 β (T-461 → T-477), Phase 15 γ (T-478 → T-485), Phase 15 δ (T-486 → T-489); v1.22 / v1.26 / v1.28 / v1.29 (this ADR's ship) changelog entries.
- `packages/runtimes/contract/` — interactive runtime contract; T-454 extends per ADR-003.
- `packages/loss-flags/src/types.ts` — receives the eight `LF-AUDIENCE-*` codes per ADR-009 §D11 (string-typed `code`; no closed-union edit).
- `packages/runtimes/interactive/` — sibling interactive-tier package the audience runtime extends; shader-clip + canvas-element + three-scene-clip primitives the audience clips compose (per §D4 + §D11 of this ADR).
- `packages/asset-cache/` (T-420) — P14 asset cache `AudienceAiPromptClip` references via `AggregationValue.generatedAssetCacheKey` per §D3.
- CLAUDE.md §3 (license whitelist invariant + determinism perimeter §D11 honours), §6 (escalation triggers — vendor parity disputes routed through ADR-009 §D8 + T-485 regression; AudienceAiPromptClip P14-cache eviction routed per §"Risks" above), §10 (where things go — adapter packages slot under `packages/<vendor>-audience/` per ADR-009 §D8; clip implementations slot under `packages/runtimes/audience/src/clips/<clip-name>/` per CLAUDE.md §10 row), §13 (structural-extension rule — N/A here, this is a docs-only ADR; the schema additions ADR-010 specifies land in T-452 / T-460 / T-461..T-471 which DO bear the §13 obligation; T-476 Cluster I parity fixtures + the PO ratification sign-off carry the end-to-end render verification per the §13 means-of-verification options).

---

## Ratification Signoff

- [ ] Product owner — nine v1 clip families (six standard + three motion-native) ratified
- [ ] Product owner — `staticFallback` snapshot semantics + snapshot-selection policies (final / peak / at-frame) ratified
- [ ] Product owner — `AudienceProvenance` schema (inlined aggregation for export durability) ratified
- [ ] Product owner — tenant frontier-enablement gating posture (two-flag enablement: `enabled` + `motionNativeEnabled`) ratified
- [ ] Engineering — T-452 (`@stageflip/audience-contract`) ships against this ADR + ADR-009; `VotePayloadValue` + `AggregationValue` discriminated unions
- [ ] Engineering — T-460 (`AudienceProvenance` type) ships the full §D5 schema
- [ ] Engineering — T-461..T-471 each consume the §D2 + §D3 + §D4 contracts; each declares `permissions: ['audience-network']` per §D6
- [ ] Engineering — T-470 verifies T-383 dependency at dispatch
- [ ] Engineering — T-471 verifies T-430 + T-432 dependencies at dispatch
- [ ] Engineering — T-455 (`check-audience-permissions`) enforces §D6 on every clip-family manifest
- [ ] Engineering — T-472 implements §D4 snapshot-selection policies + per-clip rendering pseudocode
- [ ] Engineering — T-476 Cluster I parity fixtures verify §D11 determinism posture
- [ ] Engineering — T-486 Cluster I preset cluster ships the six presets enumerated in §D10
- [ ] Security — T-488 GA review covers `audience-network` permission scope (§D6), AudienceAiPromptClip P14-cache eviction risk (§"Risks"), provenance-bytes export durability (§D5)
