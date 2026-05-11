// packages/asset-gen-contract/src/source-grounded/index.ts
// Barrel for the 7 source-grounded provider class interfaces (ADR-008 §D9).

export {
  slideDeckCapabilityDescriptorSchema,
  validateSlideDeckCapability,
} from './slide-deck-generation-provider.js';
export type {
  SlideDeckCall,
  SlideDeckCapabilityDescriptor,
  SlideDeckDocument,
  SlideDeckGenerationProvider,
  SlideDeckResult,
} from './slide-deck-generation-provider.js';

export {
  mindMapCapabilityDescriptorSchema,
  validateMindMapCapability,
} from './mind-map-generation-provider.js';
export type {
  MindMapCall,
  MindMapCapabilityDescriptor,
  MindMapGenerationProvider,
  MindMapResult,
  MindMapTree,
} from './mind-map-generation-provider.js';

export {
  tableCapabilityDescriptorSchema,
  validateTableCapability,
} from './table-generation-provider.js';
export type {
  TableCall,
  TableCapabilityDescriptor,
  TableElementContent,
  TableGenerationProvider,
  TableResult,
} from './table-generation-provider.js';

export {
  QUIZ_QUESTION_TYPES,
  quizCapabilityDescriptorSchema,
  validateQuizCapability,
} from './quiz-generation-provider.js';
export type {
  QuizCall,
  QuizCapabilityDescriptor,
  QuizClipProps,
  QuizGenerationProvider,
  QuizQuestionType,
  QuizResult,
} from './quiz-generation-provider.js';

export {
  flashcardCapabilityDescriptorSchema,
  validateFlashcardCapability,
} from './flashcard-generation-provider.js';
export type {
  FlashcardCall,
  FlashcardCapabilityDescriptor,
  FlashcardClipProps,
  FlashcardGenerationProvider,
  FlashcardResult,
} from './flashcard-generation-provider.js';

export {
  REPORT_FORMATS,
  reportCapabilityDescriptorSchema,
  validateReportCapability,
} from './report-generation-provider.js';
export type {
  ReportCall,
  ReportCapabilityDescriptor,
  ReportFormat,
  ReportGenerationProvider,
  ReportResult,
  TextElementContent,
} from './report-generation-provider.js';

export {
  INFOGRAPHIC_OUTPUT_FORMATS,
  infographicCapabilityDescriptorSchema,
  validateInfographicCapability,
} from './infographic-generation-provider.js';
export type {
  ImageElementSrc,
  InfographicCall,
  InfographicCapabilityDescriptor,
  InfographicGenerationProvider,
  InfographicOutputFormat,
  InfographicResult,
} from './infographic-generation-provider.js';
