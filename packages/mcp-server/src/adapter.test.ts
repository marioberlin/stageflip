// packages/mcp-server/src/adapter.test.ts
// T-222 — unit coverage for the pure adapter functions. Exercises the
// bundle-filter, Zod→MCP schema passthrough, and error mapping without
// spinning up the MCP SDK Server runtime.

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { BundleRegistry, type ToolHandler, ToolRouter } from '@stageflip/engine';
import type { ToolContext } from '@stageflip/engine';

import { buildMcpToolList, dispatchMcpToolCall } from './adapter.js';

interface TestContext extends ToolContext {
  readonly who?: string;
}

function makeHandler<I, O>(def: {
  name: string;
  bundle: string;
  description: string;
  inputSchema: z.ZodType<I>;
  outputSchema: z.ZodType<O>;
  handle: ToolHandler<I, O, TestContext>['handle'];
}): ToolHandler<I, O, TestContext> {
  return def;
}

function seed(): { registry: BundleRegistry; router: ToolRouter<TestContext> } {
  const registry = new BundleRegistry();
  registry.register({
    name: 'read',
    description: 'Read-only bundle.',
    tools: [
      {
        name: 'get_slide',
        description: 'Returns a slide by id.',
        input_schema: {
          type: 'object',
          properties: { slideId: { type: 'string', description: 'Slide id' } },
          required: ['slideId'],
          additionalProperties: false,
        },
      },
    ],
  });
  registry.register({
    name: 'create-mutate',
    description: 'Mutation bundle.',
    tools: [
      {
        name: 'add_slide',
        description: 'Inserts a new slide.',
        input_schema: {
          type: 'object',
          properties: { title: { type: 'string' } },
          required: [],
          additionalProperties: false,
        },
      },
    ],
  });

  const router = new ToolRouter<TestContext>();
  router.register(
    makeHandler({
      name: 'get_slide',
      bundle: 'read',
      description: 'Returns a slide by id.',
      inputSchema: z.object({ slideId: z.string() }),
      outputSchema: z.object({ id: z.string(), title: z.string() }),
      handle: (input) => ({ id: input.slideId, title: `Slide ${input.slideId}` }),
    }),
  );
  router.register(
    makeHandler({
      name: 'add_slide',
      bundle: 'create-mutate',
      description: 'Inserts a new slide.',
      inputSchema: z.object({ title: z.string().optional() }),
      outputSchema: z.object({ id: z.string() }),
      handle: () => ({ id: 'slide-xyz' }),
    }),
  );
  router.register(
    makeHandler({
      name: 'broken',
      bundle: 'create-mutate',
      description: 'Throws on invocation.',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      handle: () => {
        throw new Error('kaboom');
      },
    }),
  );

  return { registry, router };
}

describe('buildMcpToolList', () => {
  it('surfaces every registered tool when no bundle filter is given', () => {
    const { registry } = seed();
    const list = buildMcpToolList(registry);
    const names = list.map((t) => t.name);
    expect(names).toContain('get_slide');
    expect(names).toContain('add_slide');
  });

  it('honours allowedBundles — filters tools to only permitted bundles', () => {
    const { registry } = seed();
    const list = buildMcpToolList(registry, { allowedBundles: ['read'] });
    expect(list.map((t) => t.name)).toEqual(['get_slide']);
  });

  it('passes tool.input_schema through as the MCP inputSchema', () => {
    const { registry } = seed();
    const [first] = buildMcpToolList(registry);
    expect(first).toBeDefined();
    expect(first.inputSchema).toMatchObject({
      type: 'object',
      required: ['slideId'],
    });
  });

  it('emits no tools when allowedBundles is an empty array', () => {
    const { registry } = seed();
    expect(buildMcpToolList(registry, { allowedBundles: [] })).toEqual([]);
  });

  it('deterministically preserves bundle + tool insertion order', () => {
    const { registry } = seed();
    const list = buildMcpToolList(registry);
    // `broken` is registered on the router only (not in a bundle) — it
    // exercises error paths, not list-surface.
    expect(list.map((t) => t.name)).toEqual(['get_slide', 'add_slide']);
  });
});

describe('dispatchMcpToolCall — success paths', () => {
  it('dispatches a known tool and wraps the handler output into MCP content blocks', async () => {
    const { router } = seed();
    const result = await dispatchMcpToolCall({
      router,
      name: 'get_slide',
      args: { slideId: 'hero' },
      context: { who: 'tester' },
    });
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toMatchObject({ type: 'text' });
    const text = (result.content[0] as { text: string }).text;
    expect(JSON.parse(text)).toEqual({ id: 'hero', title: 'Slide hero' });
  });

  it('treats `args: undefined` as an empty object', async () => {
    const { router } = seed();
    const result = await dispatchMcpToolCall({
      router,
      name: 'add_slide',
      args: undefined,
      context: {},
    });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual({ id: 'slide-xyz' });
  });
});

describe('dispatchMcpToolCall — error paths', () => {
  it('maps ToolRouterError(unknown_tool) to an MCP error result', async () => {
    const { router } = seed();
    const result = await dispatchMcpToolCall({
      router,
      name: 'does_not_exist',
      args: {},
      context: {},
    });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toMatch(/unknown tool/i);
  });

  it('maps input_invalid (Zod failure) to an error result with issue detail', async () => {
    const { router } = seed();
    const result = await dispatchMcpToolCall({
      router,
      name: 'get_slide',
      args: { wrong: 'field' },
      context: {},
    });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toMatch(/invalid|required/i);
  });

  it('maps handler_error (handler throws) to an error result', async () => {
    const { router } = seed();
    const result = await dispatchMcpToolCall({
      router,
      name: 'broken',
      args: {},
      context: {},
    });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toMatch(/kaboom|threw/i);
  });

  it('rejects calls to tools outside allowedBundles as not-permitted', async () => {
    const { router } = seed();
    const result = await dispatchMcpToolCall({
      router,
      name: 'add_slide',
      args: {},
      context: {},
      allowedBundles: ['read'],
    });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toMatch(
      /not permitted|not allowed|disallowed/i,
    );
  });

  it('still dispatches tools that are in an allowed bundle', async () => {
    const { router } = seed();
    const result = await dispatchMcpToolCall({
      router,
      name: 'get_slide',
      args: { slideId: 'x' },
      context: {},
      allowedBundles: ['read'],
    });
    expect(result.isError).toBeUndefined();
  });
});

describe('dispatchMcpToolCall — bundle lookup helper', () => {
  it('derives allowedBundles → callable tools from the router metadata', async () => {
    // Bundle-filter needs the router's handler metadata; assert the path
    // doesn't silently ignore an unknown-tool allowlist miss.
    const { router } = seed();
    const result = await dispatchMcpToolCall({
      router,
      name: 'get_slide',
      args: { slideId: 'x' },
      context: {},
      allowedBundles: ['create-mutate'], // doesn't include 'read'
    });
    expect(result.isError).toBe(true);
  });
});

describe('dispatchMcpToolCall — observer hook', () => {
  it('routes through the router observer (audit trail preserved)', async () => {
    const observer = vi.fn();
    const registry = new BundleRegistry();
    registry.register({ name: 'read', description: '', tools: [] });
    const router = new ToolRouter<TestContext>({ observer });
    router.register(
      makeHandler({
        name: 'ping',
        bundle: 'read',
        description: 'ping',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.literal(true) }),
        handle: () => ({ ok: true }),
      }),
    );
    await dispatchMcpToolCall({ router, name: 'ping', args: {}, context: {} });
    expect(observer).toHaveBeenCalledWith(expect.objectContaining({ type: 'call-start' }));
    expect(observer).toHaveBeenCalledWith(expect.objectContaining({ type: 'call-success' }));
  });
});
