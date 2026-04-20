# RIR Golden Fixtures (T-032)

Each fixture is a matched pair:

- `inputs/<name>.json` — a canonical `Document` to feed `compileRIR`
- `goldens/<name>.json` — the expected `RIRDocument` output

The test harness at `packages/rir/src/goldens.test.ts` iterates every input,
compiles it with `compilerVersion: 'golden-v1'`, and asserts the output
matches the golden byte-for-byte.

## Regenerating goldens

When a compiler change is intended:

```sh
RIR_GOLDEN_UPDATE=1 pnpm --filter=@stageflip/rir test
```

Every golden file under `goldens/` is overwritten with the current output.
Review the resulting diff before committing — it tells you exactly what the
compiler change did to the observable output.

## Coverage

| Fixture | Exercises |
|---|---|
| `minimum-slide.json` | Smallest valid slide doc |
| `minimum-video.json` | Smallest valid video doc; frameRate derivation |
| `minimum-display.json` | Smallest valid display doc; 30fps default |
| `theme-and-variables.json` | theme-resolve + variable-resolve passes |
| `stacking-contexts.json` | embed + three + shader → 'isolate'; others → 'auto' |
| `timing-b1-b2.json` | B1 absolute + B2 relative animation resolution |
| `timing-b3-anchored.json` | B3 anchor resolve + unresolved-warn fallback |
| `nested-groups.json` | Recursive groups; zIndex per sibling level |
| `font-aggregation.json` | Dedup across text + clip font declarations |

Exhaustive combinatorics of element × animation × timing are covered by the
property-based round-trip tests in `packages/schema/src/roundtrip.test.ts`
(T-024). These goldens exist to catch compiler-observable regressions that
property tests cannot — ordering, zIndex assignment, digest stability, and
the exact shape of the RIR output.
