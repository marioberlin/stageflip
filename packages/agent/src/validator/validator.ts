// packages/agent/src/validator/validator.ts
// Validator — the quality gate after the Executor. Runs every registered
// programmatic check (deterministic, tier-bearing) and every opted-in
// qualitative check (LLM, informational). Tier is set by programmatic
// failures alone; qualitative verdicts can only push the tier from
// `pass` to `pass-with-notes`, never to `fail`.

import type { LLMProvider } from '@stageflip/llm-abstraction';
import { DEFAULT_PROGRAMMATIC_CHECKS, runProgrammaticChecks } from './programmatic.js';
import { runQualitativeCheck } from './qualitative.js';
import type { ProgrammaticCheck } from './types.js';
import type {
  ProgrammaticCheckResult,
  QualitativeCheckResult,
  ValidationResult,
  ValidationTier,
  Validator,
  ValidatorCallOptions,
  ValidatorRequest,
} from './types.js';

export const DEFAULT_VALIDATOR_MAX_TOKENS = 1024;

export interface CreateValidatorOptions {
  provider: LLMProvider;
  /**
   * Additional programmatic checks run after the built-ins. Typical uses:
   * pre-render linter (T-104), parity PSNR/SSIM when rendered frames are
   * available, custom invariants per deployment.
   */
  extraProgrammaticChecks?: readonly ProgrammaticCheck[];
}

export function createValidator(options: CreateValidatorOptions): Validator {
  const checks: readonly ProgrammaticCheck[] = [
    ...DEFAULT_PROGRAMMATIC_CHECKS,
    ...(options.extraProgrammaticChecks ?? []),
  ];

  return {
    async validate(
      request: ValidatorRequest,
      callOptions?: ValidatorCallOptions,
    ): Promise<ValidationResult> {
      const programmatic = await runProgrammaticChecks(request.document, checks);

      const qualitative: QualitativeCheckResult[] = [];
      const qualitativeList = request.qualitativeChecks ?? [];
      for (const name of qualitativeList) {
        if (callOptions?.signal?.aborted) break;
        const result = await runQualitativeCheck(
          options.provider,
          request.model,
          request.document,
          name,
          {
            ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
            maxTokens: request.maxTokens ?? DEFAULT_VALIDATOR_MAX_TOKENS,
            temperature: request.temperature ?? 0,
          },
        );
        qualitative.push(result);
      }

      return buildResult(programmatic, qualitative);
    },
  };
}

function buildResult(
  programmatic: ProgrammaticCheckResult[],
  qualitative: QualitativeCheckResult[],
): ValidationResult {
  const hasFailure = programmatic.some((p) => p.status === 'fail');
  const fixes = qualitative
    .map((q) => q.suggestedFix)
    .filter((fix): fix is string => fix !== undefined);

  const tier: ValidationTier = hasFailure ? 'fail' : fixes.length > 0 ? 'pass-with-notes' : 'pass';

  return {
    tier,
    programmatic,
    qualitative,
    ...(fixes.length > 0 ? { required_fixes: fixes } : {}),
  };
}
