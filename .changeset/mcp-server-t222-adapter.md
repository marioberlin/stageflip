---
"@stageflip/mcp-server": minor
---

T-222: `@stageflip/mcp-server` — adapter between the engine's tool
registry and MCP. Exposes:

- `createMcpServer({ registry, router, buildContext, allowedBundles? })` —
  transport-agnostic MCP SDK `Server` ready to `.connect(transport)`.
- `buildMcpToolList` / `dispatchMcpToolCall` — pure adapter functions for
  callers wiring their own Server.
- `populateCanonicalRegistryForMcp` — happy-path helper that registers
  all 16 canonical bundles onto a fresh registry + router pair.

Tool-list filtering honours an optional `allowedBundles` scope (per
invariant I-9 and the MCP-integration skill). Router errors
(`unknown_tool`, `input_invalid`, `output_invalid`, `handler_error`,
`aborted`) map to MCP `{ isError: true }` tool-call results with
human-readable diagnostics. End-to-end coverage via `InMemoryTransport`
pairing a real SDK `Client` with the factory's `Server`.
