// packages/import-google-slides/src/aiqc/stub-provider.ts
// Test-only LLMProvider stub. Returns canned text-block responses keyed by a
// caller-supplied selector function (typically derived from the residual's
// elementId). Records every request for assertion. No live network.

import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamEvent,
} from '@stageflip/llm-abstraction';

export type StubResponseFactory = (request: LLMRequest, callIndex: number) => StubResponseSpec;

export type StubResponseSpec = { kind: 'text'; text: string } | { kind: 'throw'; error: Error };

export interface StubGeminiProviderOptions {
  /**
   * Function returning the canned response per call. Receives the request and
   * the call index (0-based, in `complete` invocation order).
   */
  factory: StubResponseFactory;
}

export interface StubGeminiProvider extends LLMProvider {
  readonly callCount: number;
  readonly requests: ReadonlyArray<LLMRequest>;
}

/**
 * Build a stub LLMProvider. `complete` returns a synthetic LLMResponse with
 * one text content block from the factory's spec; `stream` is unimplemented
 * (T-246's pass uses `complete` only).
 */
export function createStubGeminiProvider(opts: StubGeminiProviderOptions): StubGeminiProvider {
  const requests: LLMRequest[] = [];
  let calls = 0;
  const provider: LLMProvider = {
    name: 'google',
    async complete(request: LLMRequest): Promise<LLMResponse> {
      const idx = calls;
      calls += 1;
      requests.push(request);
      const spec = opts.factory(request, idx);
      if (spec.kind === 'throw') throw spec.error;
      return {
        id: `stub-${idx}`,
        model: request.model,
        role: 'assistant',
        content: [{ type: 'text', text: spec.text }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 0, output_tokens: 0 },
      };
    },
    stream(): AsyncIterable<LLMStreamEvent> {
      // T-246 v1 uses `complete` only. A future task can wire streaming if
      // Gemini's multimodal API gains useful streaming semantics for QC.
      const error = new Error('StubGeminiProvider.stream is not implemented');
      return {
        [Symbol.asyncIterator](): AsyncIterator<LLMStreamEvent> {
          return {
            next(): Promise<IteratorResult<LLMStreamEvent>> {
              return Promise.reject(error);
            },
          };
        },
      };
    },
  };
  // Use Object.defineProperty to attach the getter so the closure-captured
  // `calls` variable is read on each access (Object.assign would copy the
  // descriptor's current value once — at attachment time — losing the live
  // reference). `requests` is a plain ref-mutation so a normal field works.
  Object.defineProperty(provider, 'callCount', {
    enumerable: true,
    get(): number {
      return calls;
    },
  });
  (provider as { requests?: ReadonlyArray<LLMRequest> }).requests = requests;
  return provider as StubGeminiProvider;
}
