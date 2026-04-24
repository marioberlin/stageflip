// packages/engine/src/router/router.test.ts

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { type ToolCallEvent, ToolRouter, ToolRouterError } from './router.js';
import type { ToolContext, ToolHandler } from './types.js';

const addTool: ToolHandler<{ a: number; b: number }, { sum: number }> = {
  name: 'add',
  bundle: 'read',
  description: 'adds two numbers',
  inputSchema: z.object({ a: z.number(), b: z.number() }).strict(),
  outputSchema: z.object({ sum: z.number() }).strict(),
  handle: ({ a, b }) => ({ sum: a + b }),
};

describe('ToolRouter.register', () => {
  it('registers handlers and reports them via has / get / size / names', () => {
    const router = new ToolRouter();
    router.register(addTool);
    expect(router.has('add')).toBe(true);
    expect(router.get('add')?.bundle).toBe('read');
    expect(router.size).toBe(1);
    expect(router.names()).toEqual(['add']);
  });

  it('throws on duplicate tool names', () => {
    const router = new ToolRouter();
    router.register(addTool);
    expect(() => router.register(addTool)).toThrow(/duplicate tool name "add"/);
  });
});

describe('ToolRouter.call — happy path', () => {
  it('runs the handler and returns the validated output', async () => {
    const router = new ToolRouter();
    router.register(addTool);
    const result = await router.call('add', { a: 2, b: 3 }, {});
    expect(result).toEqual({ sum: 5 });
  });

  it('supports async handlers', async () => {
    const router = new ToolRouter();
    router.register({
      ...addTool,
      name: 'add-async',
      handle: async ({ a, b }) => {
        await Promise.resolve();
        return { sum: a + b };
      },
    });
    expect(await router.call('add-async', { a: 4, b: 4 }, {})).toEqual({ sum: 8 });
  });

  it('strips unknown input fields via Zod .strict()', async () => {
    const router = new ToolRouter();
    router.register(addTool);
    const err = await router.call('add', { a: 1, b: 2, c: 99 }, {}).catch((e) => e);
    expect(err).toBeInstanceOf(ToolRouterError);
    expect((err as ToolRouterError).kind).toBe('input_invalid');
  });
});

describe('ToolRouter.call — error kinds', () => {
  it('unknown_tool when no handler is registered', async () => {
    const router = new ToolRouter();
    const err = await router.call('nope', {}, {}).catch((e) => e);
    expect(err).toBeInstanceOf(ToolRouterError);
    expect((err as ToolRouterError).kind).toBe('unknown_tool');
    expect((err as ToolRouterError).toolName).toBe('nope');
  });

  it('input_invalid when the input fails Zod validation (with issues)', async () => {
    const router = new ToolRouter();
    router.register(addTool);
    const err = await router.call('add', { a: 'one', b: 2 }, {}).catch((e) => e);
    expect((err as ToolRouterError).kind).toBe('input_invalid');
    expect((err as ToolRouterError).issues?.length ?? 0).toBeGreaterThan(0);
  });

  it('output_invalid when the handler returns malformed data', async () => {
    const router = new ToolRouter();
    router.register({
      ...addTool,
      name: 'broken',
      handle: () => ({ sum: 'NaN' }) as unknown as { sum: number },
    });
    const err = await router.call('broken', { a: 1, b: 2 }, {}).catch((e) => e);
    expect((err as ToolRouterError).kind).toBe('output_invalid');
  });

  it('handler_error when the handler throws a non-AbortError', async () => {
    const router = new ToolRouter();
    router.register({
      ...addTool,
      name: 'boom',
      handle: () => {
        throw new Error('oops');
      },
    });
    const err = await router.call('boom', { a: 1, b: 2 }, {}).catch((e) => e);
    expect((err as ToolRouterError).kind).toBe('handler_error');
    expect((err as ToolRouterError).message).toContain('oops');
  });

  it('aborted when the signal fires before start', async () => {
    const router = new ToolRouter();
    router.register(addTool);
    const controller = new AbortController();
    controller.abort(new Error('user cancelled'));
    const err = await router
      .call('add', { a: 1, b: 2 }, { signal: controller.signal })
      .catch((e) => e);
    expect((err as ToolRouterError).kind).toBe('aborted');
  });

  it('aborted when the handler throws an AbortError', async () => {
    const router = new ToolRouter();
    router.register({
      ...addTool,
      name: 'racy',
      handle: () => {
        throw Object.assign(new Error('cancelled mid-call'), { name: 'AbortError' });
      },
    });
    const err = await router.call('racy', { a: 1, b: 2 }, {}).catch((e) => e);
    expect((err as ToolRouterError).kind).toBe('aborted');
  });
});

describe('ToolRouter observer', () => {
  it('emits call-start and call-success for successful calls', async () => {
    const events: ToolCallEvent[] = [];
    const router = new ToolRouter({ observer: (e) => events.push(e) });
    router.register(addTool);

    await router.call('add', { a: 1, b: 1 }, {});
    expect(events.map((e) => e.type)).toEqual(['call-start', 'call-success']);
    expect((events[1] as Extract<ToolCallEvent, { type: 'call-success' }>).output).toEqual({
      sum: 2,
    });
  });

  it('emits call-error for unknown_tool / input_invalid / handler_error', async () => {
    const events: ToolCallEvent[] = [];
    const router = new ToolRouter({ observer: (e) => events.push(e) });
    router.register(addTool);

    await router.call('nope', {}, {}).catch(() => {});
    await router.call('add', { a: 'x', b: 2 }, {}).catch(() => {});

    const errors = events.filter((e) => e.type === 'call-error');
    expect(errors).toHaveLength(2);
    const kinds = errors.map(
      (e) => (e as Extract<ToolCallEvent, { type: 'call-error' }>).error.kind,
    );
    expect(kinds).toEqual(['unknown_tool', 'input_invalid']);
  });

  it('swallows observer errors so the caller still sees the tool result', async () => {
    const router = new ToolRouter({
      observer: () => {
        throw new Error('observer blew up');
      },
    });
    router.register(addTool);
    await expect(router.call('add', { a: 5, b: 5 }, {})).resolves.toEqual({ sum: 10 });
  });
});

describe('ToolRouter — context propagation', () => {
  it('forwards the context object to the handler', async () => {
    interface AuditedContext extends ToolContext {
      user: string;
    }
    const spy = vi.fn((_input: unknown, ctx: AuditedContext) => ({ sum: 1 }));
    const router = new ToolRouter<AuditedContext>();
    router.register<{ a: number; b: number }, { sum: number }>({
      ...addTool,
      handle: spy as unknown as (typeof addTool)['handle'],
    });
    await router.call('add', { a: 1, b: 2 }, { user: 'alice' });
    expect(spy).toHaveBeenCalledWith({ a: 1, b: 2 }, expect.objectContaining({ user: 'alice' }));
  });
});
