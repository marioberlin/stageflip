// packages/audience-contract/src/index.ts
// Public surface of `@stageflip/audience-contract`. Per ADR-009 §D2 / §D11
// and ADR-010 §D2 / §D3 / §D5. Pure interface package — concrete adapters
// are T-478 (native) + T-479..T-483 (vendor bridges); the backend service
// is T-453; the audience runtime is T-454.
//
// Ships:
//   - `AudienceBackendProvider` interface + per-method call/result shapes.
//   - `AudienceCapabilityDescriptor` + capability validator plugging into
//     T-418's `CapabilityDescriptorParser`.
//   - `VotePayload` discriminated union per ADR-010 §D2 (10 variants;
//     `leaderboard` is derived-from-quiz so excluded).
//   - `AggregationSnapshot` + `AggregationValue` discriminated union per
//     ADR-010 §D3 (11 variants).
//   - `AudienceProvenance` schema preview per ADR-010 §D5 (full element-
//     base merge in T-460).
//   - Sealed `const` array of 8 `LF-AUDIENCE-*` codes per ADR-009 §D11.

// ----------------------------------------------------------------------------
// Capability (ADR-009 §D2)
// ----------------------------------------------------------------------------
export {
  AUDIENCE_CLIP_KINDS,
  AUDIENCE_PERSISTENCE_TIERS,
  AUDIENCE_VOTER_IDENTITIES,
  audienceCapabilityDescriptorSchema,
  validateAudienceCapability,
} from './capability.js';
export type {
  AudienceCapabilityDescriptor,
  AudienceClipKind,
  AudiencePersistenceTier,
  AudienceVoterIdentity,
} from './capability.js';

// ----------------------------------------------------------------------------
// Provider interface (ADR-009 §D2)
// ----------------------------------------------------------------------------
export type {
  AudienceBackendProvider,
  CloseSessionCall,
  OpenSessionCall,
  SessionHandle,
  SubmitVoteCall,
  SubscribeCall,
  VoteAck,
} from './audience-backend-provider.js';

// ----------------------------------------------------------------------------
// Vote payload (ADR-010 §D2)
// ----------------------------------------------------------------------------
export { votePayloadSchema, VOTE_PAYLOAD_KINDS } from './vote-payload.js';
export type {
  AudienceAiPromptVote,
  HeatmapVote,
  LivePollMultipleChoiceVote,
  LivePollOpenTextVote,
  LivePollRatingVote,
  LiveQAVote,
  LiveQuizVote,
  ReactionStreamVote,
  SurveyVote,
  SurveyVoteResponseValue,
  VotePayload,
  VotePayloadKind,
  WordCloudVote,
} from './vote-payload.js';

// ----------------------------------------------------------------------------
// Aggregation snapshot (ADR-010 §D3 + ADR-009 §D2)
// ----------------------------------------------------------------------------
export {
  AGGREGATION_KINDS,
  LIVE_QUIZ_QUESTION_STATUSES,
  SURVEY_QUESTION_TYPES,
  aggregationSnapshotSchema,
  aggregationValueSchema,
  finalSnapshotSchema,
} from './aggregation-snapshot.js';
export type {
  AggregationKind,
  AggregationSnapshot,
  AggregationValue,
  AudienceAiPromptAggregation,
  FinalSnapshot,
  HeatmapAggregation,
  LeaderboardAggregation,
  LivePollMultipleChoiceAggregation,
  LivePollOpenTextAggregation,
  LivePollRatingAggregation,
  LiveQAAggregation,
  LiveQuizAggregation,
  LiveQuizQuestionStatus,
  ReactionStreamAggregation,
  SurveyAggregation,
  SurveyQuestionType,
  WordCloudAggregation,
} from './aggregation-snapshot.js';

// ----------------------------------------------------------------------------
// Audience provenance preview (ADR-010 §D5; full schema lands in T-460)
// ----------------------------------------------------------------------------
export {
  AUDIENCE_SNAPSHOT_POLICIES,
  audienceProvenanceSchema,
} from './audience-provenance.js';
export type {
  AudienceProvenance,
  AudienceSnapshotPolicy,
} from './audience-provenance.js';

// ----------------------------------------------------------------------------
// Loss-flag inventory (ADR-009 §D11)
// ----------------------------------------------------------------------------
export { LF_AUDIENCE_CODES, LF_AUDIENCE_SPECS } from './loss-flags.js';
export type {
  AudienceLossFlagSeverity,
  AudienceLossFlagSpec,
  LossFlagAudienceCode,
} from './loss-flags.js';
