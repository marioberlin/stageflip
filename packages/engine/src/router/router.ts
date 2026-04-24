// packages/engine/src/router/router.ts
// ToolRouter — dispatches tool calls by name with Zod-validated input
// + output. Input / output validation is bi-directional because the model
// can hallucinate args and a misbehaving handler can return malformed
// payloads the Executor would then feed back to the model. Both failure
// paths surface as `ToolRouterError` with distinct `kind`s so the
// Executor (T-152) can branch — e.g. re-prompt on `input_invalid`, fail
// the step on `handler_error`.

import type { z } from 'zod';
import type { AnyToolHandler, ToolContext, ToolHandler } from './types.js';

export type ToolRouterErrorKind =
  | 'unknown_tool'
  | 'input_invalid'
  | 'output_invalid'
  | 'handler_error'
  | 'aborted';

export interface ToolRouterErrorContext {
  toolName: string;
  /** Populated when `kind` is `input_invalid` or `output_invalid`. */
  issues?: readonly z.ZodIssue[];
  /** Populated when `kind` is `handler_error` or `aborted`. */
  cause?: unknown;
}

export class ToolRouterError extends Error {
  readonly kind: ToolRouterErrorKind;
  readonly toolName: string;
  readonly issues: readonly z.ZodIssue[] | undefined;

  constructor(kind: ToolRouterErrorKind, message: string, context: ToolRouterErrorContext) {
    super(message, { cause: context.cause });
    this.name = 'ToolRouterError';
    this.kind = kind;
    this.toolName = context.toolName;
    this.issues = context.issues;
  }
}

export interface ToolRouterOptions {
  /**
   * Called for every completed call (success or failure). Useful for the
   * Executor's audit trail + streaming UI events. Never throws into the
   * caller — errors inside the observer are swallowed.
   */
  observer?: (event: ToolCallEvent) => void;
}

export type ToolCallEvent =
  | {
      type: 'call-start';
      toolName: string;
      input: unknown;
    }
  | {
      type: 'call-success';
      toolName: string;
      input: unknown;
      output: unknown;
    }
  | {
      type: 'call-error';
      toolName: string;
      input: unknown;
      error: ToolRouterError;
    };

export class ToolRouter<TContext extends ToolContext = ToolContext> {
  private readonly handlers = new Map<string, AnyToolHandler>();
  private readonly observer: ToolRouterOptions['observer'] | undefined;

  constructor(options: ToolRouterOptions = {}) {
    this.observer = options.observer;
  }

  register<TInput, TOutput>(handler: ToolHandler<TInput, TOutput, TContext>): void {
    if (this.handlers.has(handler.name)) {
      throw new Error(
        `ToolRouter.register: duplicate tool name "${handler.name}" (bundle "${handler.bundle}")`,
      );
    }
    this.handlers.set(handler.name, handler as AnyToolHandler);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  get(name: string): AnyToolHandler | undefined {
    return this.handlers.get(name);
  }

  get size(): number {
    return this.handlers.size;
  }

  names(): string[] {
    return [...this.handlers.keys()];
  }

  /**
   * Dispatch. Validates input against the handler's Zod schema, invokes
   * the handler, validates the output, returns. Every failure throws
   * `ToolRouterError` with a named `kind`.
   */
  async call(name: string, input: unknown, context: TContext): Promise<unknown> {
    const handler = this.handlers.get(name);
    if (!handler) {
      const err = new ToolRouterError('unknown_tool', `Unknown tool "${name}"`, { toolName: name });
      this.emit({ type: 'call-error', toolName: name, input, error: err });
      throw err;
    }

    this.emit({ type: 'call-start', toolName: name, input });

    if (context.signal?.aborted) {
      const err = new ToolRouterError('aborted', `Tool "${name}" aborted before start`, {
        toolName: name,
        cause: context.signal.reason,
      });
      this.emit({ type: 'call-error', toolName: name, input, error: err });
      throw err;
    }

    const parsedInput = handler.inputSchema.safeParse(input);
    if (!parsedInput.success) {
      const err = new ToolRouterError(
        'input_invalid',
        `Tool "${name}" received invalid input: ${parsedInput.error.message}`,
        { toolName: name, issues: parsedInput.error.issues },
      );
      this.emit({ type: 'call-error', toolName: name, input, error: err });
      throw err;
    }

    let rawOutput: unknown;
    try {
      rawOutput = await handler.handle(parsedInput.data, context);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      const kind: ToolRouterErrorKind =
        cause instanceof Error && cause.name === 'AbortError' ? 'aborted' : 'handler_error';
      const err = new ToolRouterError(kind, `Tool "${name}" handler threw: ${message}`, {
        toolName: name,
        cause,
      });
      this.emit({ type: 'call-error', toolName: name, input, error: err });
      throw err;
    }

    const parsedOutput = handler.outputSchema.safeParse(rawOutput);
    if (!parsedOutput.success) {
      const err = new ToolRouterError(
        'output_invalid',
        `Tool "${name}" handler returned invalid output: ${parsedOutput.error.message}`,
        { toolName: name, issues: parsedOutput.error.issues },
      );
      this.emit({ type: 'call-error', toolName: name, input, error: err });
      throw err;
    }

    this.emit({
      type: 'call-success',
      toolName: name,
      input,
      output: parsedOutput.data,
    });
    return parsedOutput.data;
  }

  private emit(event: ToolCallEvent): void {
    if (!this.observer) return;
    try {
      this.observer(event);
    } catch {
      // Observer errors must never propagate into the caller — the audit
      // trail is a diagnostic, not part of the tool-call contract.
    }
  }
}
