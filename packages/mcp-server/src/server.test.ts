// packages/mcp-server/src/server.test.ts
// T-222 — end-to-end round-trip over the MCP wire protocol. Pairs a real
// SDK Client and Server via InMemoryTransport so we exercise the exact
// request/response path a production MCP client would take.

import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { BundleRegistry, type ToolHandler, ToolRouter } from '@stageflip/engine';
import type { ToolContext } from '@stageflip/engine';

import { createMcpServer } from './server.js';

interface TestContext extends ToolContext {
  readonly who?: string;
}

function makeHandler<I, O>(def: ToolHandler<I, O, TestContext>): ToolHandler<I, O, TestContext> {
  return def;
}

async function connectedPair(): Promise<{ client: Client; cleanup: () => Promise<void> }> {
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
          properties: { slideId: { type: 'string' } },
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
        description: 'Inserts a slide.',
        input_schema: {
          type: 'object',
          properties: { title: { type: 'string' } },
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
      description: 'Inserts a slide.',
      inputSchema: z.object({ title: z.string().optional() }),
      outputSchema: z.object({ id: z.string() }),
      handle: () => ({ id: 'slide-xyz' }),
    }),
  );

  const server = createMcpServer<TestContext>({
    registry,
    router,
    buildContext: () => ({ who: 'test-caller' }),
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '0.0.1' }, { capabilities: {} });
  await client.connect(clientTransport);

  return {
    client,
    cleanup: async () => {
      await client.close();
      await server.close();
    },
  };
}

describe('createMcpServer — end-to-end over InMemoryTransport', () => {
  let pair: Awaited<ReturnType<typeof connectedPair>>;

  beforeEach(async () => {
    pair = await connectedPair();
  });

  it('lists every registered tool via tools/list', async () => {
    const result = await pair.client.listTools();
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual(['add_slide', 'get_slide']);
    await pair.cleanup();
  });

  it('dispatches a tools/call through the router and returns the handler output', async () => {
    const result = await pair.client.callTool({
      name: 'get_slide',
      arguments: { slideId: 'hero' },
    });
    expect(result.isError).toBeFalsy();
    const blocks = result.content as Array<{ type: string; text: string }>;
    expect(blocks[0]).toMatchObject({ type: 'text' });
    expect(JSON.parse(blocks[0].text)).toEqual({ id: 'hero', title: 'Slide hero' });
    await pair.cleanup();
  });

  it('surfaces a router input_invalid as an MCP error result', async () => {
    const result = await pair.client.callTool({
      name: 'get_slide',
      arguments: { wrong: 'field' },
    });
    expect(result.isError).toBe(true);
    await pair.cleanup();
  });

  it('returns a non-error for an unknown tool but flags isError=true', async () => {
    const result = await pair.client.callTool({
      name: 'does_not_exist',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    await pair.cleanup();
  });
});

describe('createMcpServer — allowedBundles scope', () => {
  it('filters tools/list to the permitted scope and rejects calls outside it', async () => {
    const registry = new BundleRegistry();
    registry.register({
      name: 'read',
      description: 'Read-only.',
      tools: [
        {
          name: 'r',
          description: 'r',
          input_schema: { type: 'object', additionalProperties: false },
        },
      ],
    });
    registry.register({
      name: 'create-mutate',
      description: 'Mutation.',
      tools: [
        {
          name: 'm',
          description: 'm',
          input_schema: { type: 'object', additionalProperties: false },
        },
      ],
    });
    const router = new ToolRouter<TestContext>();
    router.register({
      name: 'r',
      bundle: 'read',
      description: 'r',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.literal(true) }),
      handle: () => ({ ok: true as const }),
    });
    router.register({
      name: 'm',
      bundle: 'create-mutate',
      description: 'm',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.literal(true) }),
      handle: () => ({ ok: true as const }),
    });

    const server = createMcpServer<TestContext>({
      registry,
      router,
      buildContext: () => ({}),
      allowedBundles: ['read'],
    });

    const [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st);
    const client = new Client({ name: 'scoped', version: '0.0.1' }, { capabilities: {} });
    await client.connect(ct);

    const list = await client.listTools();
    expect(list.tools.map((t) => t.name)).toEqual(['r']);

    const blocked = await client.callTool({ name: 'm', arguments: {} });
    expect(blocked.isError).toBe(true);

    await client.close();
    await server.close();
  });
});
