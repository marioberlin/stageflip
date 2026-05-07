---
'@stageflip/parity-cli': patch
---

T-370 — Add `tiktok-follow-pulse` preset binding (Cluster G third preset; first `followPrompt` clipKind consumer; first production consumer of T-318's `follow-prompt` primitive AND its `'tiktok'` platform branch).

`PRESET_ID_BINDINGS['tiktok-follow-pulse']` → `tiktokFollowPulseBinding` → `follow-prompt` primitive on `frame-runtime`. New `TIKTOK_FOLLOW_PULSE_PROPS` export ships the canonical TikTok native follow-prompt mobile-CTA canon (3 fields: `platform: 'tiktok'`, `position: { x: 1180, y: 504 }` right-thumb-zone anchor on 1280×720, `phase: 'pulsing'` mid-pulse register). Brand canon dominates theme on the TikTok branch (D-T318-6) — white avatar surface (`#FFFFFF`) / TikTok-Pink badge (`#FE2C55`) / TikTok Sans 700 font / 40 px diameter / 30%-alpha expanding pulse ring all inherit from `renderTiktok` defaults; minimal 3-field snapshot follows D-T370-2 budget. Parity golden rendered at `--frame=30` (overrides cluster-norm `--frame=60`; under T-318 cycle math `cycleFrames=45`/`pulseRepeat=1`, frame 60 is past `totalFrames=45` and renders settled-baseline equivalent to `'idle'`). `DEFAULT_CLIP_KIND_RESOLVER` UNCHANGED — no `'followPrompt'` clipKind-default arm added. All 22 prior `PRESET_ID_BINDINGS` entries UNCHANGED. Cluster G goes from 2/5 → 3/5 substantive + signed.
