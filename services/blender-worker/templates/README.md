# Blender scene templates

Each subdirectory ships:

- `template.blend` — the Blender scene file. Binary; not in this PR (T-265 ships
  the worker scaffold; scene authoring is a follow-up task per the spec
  "Out of scope" §"Blender Python scripting library for clip authors"). The
  Docker image's nightly integration test populates a minimal placeholder
  scene; production scenes are authored separately and committed via Git LFS
  in a follow-up.
- `params.schema.json` — JSON Schema that validates the `scene.params` field
  for clips that reference this template. The worker reads it for an early
  validation pass before launching Blender.

The set of templates is closed in v1 (T-265 D-T265-3, "Out of scope" §"Blender
add-on distribution"): `fluid-sim`, `product-render`, `particle-burst`.
Adding a template is a follow-up task that ships:

1. New subdir + `template.blend` + `params.schema.json`.
2. Update `SUPPORTED_TEMPLATES` in `scripts/render.py` and the matching TS
   list in `@stageflip/runtimes-blender` if a list is added there.
3. Update the skill (`skills/stageflip/concepts/runtimes/SKILL.md`).
