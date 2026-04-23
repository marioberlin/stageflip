// apps/stageflip-slide/src/components/onboarding/index.ts
// Barrel for the onboarding coachmark flow.

export {
  DEFAULT_COACHMARK_STEPS,
  Onboarding,
  type CoachmarkStep,
  type OnboardingProps,
} from './onboarding';
export {
  isOnboardingComplete,
  markOnboardingComplete,
  resetOnboardingForTest,
} from './onboarding-storage';
