// packages/runtimes/interactive/src/clips/ai-generative/ai-generative-provider.ts
// `AiGenerativeProvider` interface + two implementations for T-395
// (D-T395-5):
//
//   1. `HostInjectedAiGenerativeProvider` — wraps a host-supplied
//      `Generator` callable. The host's adapter is the seam where
//      provider SDKs (OpenAI / Stability / Replicate) / API tokens /
//      tenant moderation live. The clip itself never touches
//      `globalThis.fetch`.
//   2. `InMemoryAiGenerativeProvider` — resolves a scripted
//      `Record<prompt, ScriptedResult>`. Used by tests; production
//      code never instantiates.
//
// A `@stageflip/ai-generative-abstraction` package mirroring
// `@stageflip/llm-abstraction` is a future asset-gen task — Phase 14
// ADR-006 covers the pattern. T-395 ships only the seam.
//
// HARD-RULE COMPLIANCE (CLAUDE.md §3 + T-395 AC #26): this file
// contains NO direct `fetch(`, `XMLHttpRequest`, or `sendBeacon`
// reference. The `Generator` shape describes a callable a host
// passes through; the actual transport happens in host space.
//
// BROWSER-SAFE — no Node-only imports.

/**
 * Arguments to {@link AiGenerativeProvider.generateOnce}. The
 * provider OWNS the transport from invocation through to the
 * returned tuple — the factory awaits this resolution before
 * resolving its own generation lifecycle.
 *
 * `signal` is the per-generation AbortSignal: a `dispose()` while
 * a generation is in flight aborts the underlying provider call
 * (D-T395-7 + AC #14).
 */
export interface AiGenerativeArgs {
  /** Generation prompt. Forwarded verbatim to the provider. */
  prompt: string;
  /** Optional negative prompt. Provider-specific support. */
  negativePrompt?: string;
  /** Model identifier within the provider. */
  model: string;
  /** Optional output dimensions. */
  width?: number;
  height?: number;
  /** Optional deterministic seed (provider-specific support). */
  seed?: number;
  /** Cancellation signal. Aborts the in-flight provider call. */
  signal: AbortSignal;
}

/**
 * Resolved generation shape. The provider returns the artifact as a
 * `Blob` plus the reported MIME type; the factory creates a blob URL
 * from this.
 */
export interface AiGenerativeResult {
  /** Generated artifact. */
  blob: Blob;
  /**
   * MIME type as reported by the provider. May NOT be `image/*` —
   * real SDKs sometimes return `application/octet-stream`. The
   * factory passes this through verbatim and emits a telemetry
   * warning if non-`image/*`; rendering is best-effort. Per the
   * T-395 escalation trigger documenting this design choice.
   */
  contentType: string;
}

/**
 * The generation seam. Two implementations ship with T-395; future
 * tenant adapters or cloud-only providers add a third.
 */
export interface AiGenerativeProvider {
  /**
   * Resolve a single generation. Resolves with the artifact;
   * rejects on transport / quota / safety failure or any other
   * error the underlying transport surfaces.
   *
   * Rejections route via the factory's
   * `ai-generative-clip.generate.error` telemetry. The factory does
   * NOT classify the rejection itself — the seam is responsible
   * for surfacing a meaningful Error.
   */
  generateOnce(args: AiGenerativeArgs): Promise<AiGenerativeResult>;
}

// ---------- Host-injected provider — wraps a host-supplied callable ----------

/**
 * `Generator` shape — the callable signature
 * `HostInjectedAiGenerativeProvider` consumes. Hosts pass either:
 *
 *   - A wrapper around the OpenAI SDK that converts the response
 *     to `{ blob, contentType }`
 *   - A wrapper around Stable Diffusion / Replicate / etc.
 *   - A test double
 *
 * The shape is structural — any callable matching this signature
 * works.
 */
export type Generator = (args: AiGenerativeArgs) => Promise<AiGenerativeResult>;

/** Construction options for {@link HostInjectedAiGenerativeProvider}. */
export interface HostInjectedAiGenerativeProviderOptions {
  /** Host-supplied generator callable. Required. */
  generator: Generator;
}

/**
 * `AiGenerativeProvider` backed by a host-supplied `Generator`.
 * Does not apply any auth, content moderation, or tenant logic —
 * those are the host's responsibility (ADR-005 §D7).
 */
export class HostInjectedAiGenerativeProvider implements AiGenerativeProvider {
  private readonly generator: Generator;

  constructor(options: HostInjectedAiGenerativeProviderOptions) {
    this.generator = options.generator;
  }

  async generateOnce(args: AiGenerativeArgs): Promise<AiGenerativeResult> {
    return this.generator(args);
  }
}

// ---------- In-memory provider (tests) ----------

/**
 * One scripted result entry. EITHER a successful `{ blob,
 * contentType }` OR `rejectWith` — not both.
 */
export interface ScriptedAiGenerativeResult {
  /** Resolved blob. */
  blob?: Blob;
  /** Resolved contentType (defaults to `'image/png'`). */
  contentType?: string;
  /** Optional pre-canned error to reject with. */
  rejectWith?: Error;
}

export interface InMemoryAiGenerativeProviderOptions {
  /**
   * Scripted results keyed by `prompt`. Prompts not present in the
   * script cause `generateOnce` to reject with a helpful error
   * referencing this provider.
   */
  scripted: Record<string, ScriptedAiGenerativeResult>;
}

/**
 * `AiGenerativeProvider` that resolves a script keyed by prompt.
 * Used by the factory tests; production code never instantiates
 * this.
 *
 * Implementation note: an already-aborted signal at invocation time
 * rejects synchronously with an `AbortError`-named Error so the
 * factory's abort-discipline path surfaces the same shape it would
 * see from a real provider.
 */
export class InMemoryAiGenerativeProvider implements AiGenerativeProvider {
  private readonly scripted: Record<string, ScriptedAiGenerativeResult>;

  constructor(options: InMemoryAiGenerativeProviderOptions) {
    this.scripted = options.scripted;
  }

  generateOnce(args: AiGenerativeArgs): Promise<AiGenerativeResult> {
    if (args.signal.aborted) {
      const err = new Error('AbortError');
      err.name = 'AbortError';
      return Promise.reject(err);
    }
    const entry = this.scripted[args.prompt];
    if (entry === undefined) {
      return Promise.reject(
        new Error(
          `InMemoryAiGenerativeProvider: no scripted result for prompt '${args.prompt}'. Add an entry to options.scripted.`,
        ),
      );
    }
    if (entry.rejectWith !== undefined) {
      return Promise.reject(entry.rejectWith);
    }
    if (entry.blob === undefined) {
      return Promise.reject(
        new Error(
          `InMemoryAiGenerativeProvider: scripted entry for '${args.prompt}' has neither blob nor rejectWith.`,
        ),
      );
    }
    return Promise.resolve({
      blob: entry.blob,
      contentType: entry.contentType ?? 'image/png',
    });
  }
}
