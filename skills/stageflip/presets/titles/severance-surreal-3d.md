---
id: severance-surreal-3d
cluster: titles
clipKind: titleSequence
source: docs/compass_artifact.md#severance
status: stub
preferredFont:
  family: Severance custom (Helvetica + mid-century corporate identity)
  license: proprietary-byo
fallbackFont:
  family: Inter Display
  weight: 500
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Severance — surreal 3D corporate title sequence

## Visual tokens
- Hyper-realistic 3D-rendered human bodies and faces (approach: high-fidelity CGI heads, mid-century corporate-identity-manual color palette)
- Sterile color palette: muted neutrals, desaturated greens, occasional bright accent
- Bodies melt through walls, get trapped in office furniture, liquify into ooze (per S1)
- S2 introduces darker register: final shot of a character trying to pry open their own head ("jump scare" canon)
- Cloth simulation, hyper-detail rendering

## Typography
- Custom typeface inspired by Helvetica + mid-century corporate identity manuals (Massimo Vignelli era)
- Title: Bold, ALL CAPS, scaled large, very tight tracking
- Credits: Regular, 24–30 pt, wide tracking
- Fallback: Inter Display preserves the Helvetica-adjacent humanism

## Animation
- 3D cinematic — Cinema 4D + Houdini + Octane render quality
- Surreal vignettes: ~60 s, scripted not generated
- Camera holds, dolly-ins, no rapid cuts
- Use `ThreeSceneClip` for the live 3D path; static fallback is a hero frame from the canonical season variant

## Rules
- This is the highest-fidelity preset in the catalogue. Demands premium 3D pipeline — not for low-tier renders.
- Season variant matters: `seasonVariant: 1 | 2` declared in compose. S1 is sterile-surreal; S2 is darker / body-horror.
- Hidden plot clues are part of the canon (Severance hid clues in S1 visible only on rewatch). Preset compose accepts an optional `hiddenClues: string[]` for tenants who want this canon faithfully.
- Mid-century corporate-identity register is non-negotiable; "modern minimalism" looks wrong — this is specifically Vignelli-era.

## Acceptance (parity)
- Reference frames: 0 (entry), 240 (vignette mid-shot), 480 (climax shot), 720 (resolution)
- PSNR ≥ 34 dB (high-fidelity 3D varies), SSIM ≥ 0.91

## References
- `docs/compass_artifact.md` § Severance
- Oliver Latta (Extraweg); typography by Teddy Blanks; SIGGRAPH 2022 Electronic Theater
- Two Emmys for Outstanding Main Title Design (2022 + 2025)
- Frontier: `ThreeSceneClip` (ADR-005)
- ADR-004
