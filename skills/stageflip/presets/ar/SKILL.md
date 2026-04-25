---
title: Cluster H — AR & environmental overlays
id: skills/stageflip/presets/ar
tier: cluster
status: substantive
last_updated: 2026-04-25
owner_task: T-379
related:
  - skills/stageflip/presets/sports/SKILL.md
---

# Cluster H — AR & environmental overlays

AR-integrated register: Sky Sports AR formations, Hawk-Eye VAR 3D skeletal, Olympic swim-lane track, NBA AR replay. Depends on `ThreeSceneClip` from the frontier catalogue (ADR-005). Most presets in this cluster require camera-tracking data or pre-composited background plates.

## When to invoke

Invoke any `compose_*` tool in this cluster when the brief cites:

- Live AR-composited sports broadcast
- VAR / officiating overlay (decision reveal, 3D skeletal)
- Stadium / jumbotron environmental graphic
- Data-integrated AR (swim-lane tracking, race-position pointer)

Do **not** invoke for generic 3D overlays that aren't camera-tracked or environmentally anchored — those can often use simpler `ThreeSceneClip` compositions from cluster E or B.

## Presets

- [`sky-sports-ar-formations`](sky-sports-ar-formations.md) — AR formation overlay, football-pitch anchored
- [`hawkeye-var-3d-skeletal`](hawkeye-var-3d-skeletal.md) — offside 3D skeletal wireframe, decision reveal
- [`olympic-swim-lane-track`](olympic-swim-lane-track.md) — virtual lane graphics, world-record line
- [`nba-ar-replay`](nba-ar-replay.md) — court-anchored trajectory / shot-arc overlay

## Semantic tools

- `compose_ar_overlay(sport, content, camera_track, brand)` — picks preset by sport + required AR payload
- `compose_var_skeletal(freeze_frame, player_tracking, brand)` — Hawk-Eye register, used with `compose_var_call` from cluster B
- `compose_swim_lane_track(lane_count, record_time, brand)` — Olympic register

## Cluster conventions (from the compass canon)

- **AR requires camera-tracking input.** Every preset in this cluster takes a `cameraTrack` input — either from a live tracking feed or a pre-baked take. Without it, fall back to a static composite from cluster B.
- **Virtual-line graphics read as authoritative.** The Olympic swim-lane world-record line is one of the most dramatic graphics in sport because it renders as if projected on the water. Presets in this cluster must render with the camera, not on top of it. The `ThreeSceneClip` (ADR-005) is the mechanism.
- **Frame-deterministic 3D is possible.** ShaderClip and ThreeSceneClip (ADR-003 §D2) are frame-deterministic within the interactive tier. Use the `frame` uniform / `scene.tick(frame)` path; never read `performance.now()` in any uniform updater.
- **Decision reveals use pause + flash.** Hawk-Eye VAR: animated loading pulse during review, then brief pause, then green-flash (goal confirmed) or red-flash (overturned). Don't collapse this to a single cut; the pause is the suspense.
- **AR is broadcast-first, not mobile-first.** AR formations were designed to look authoritative on a 65-inch TV; on a 6-inch phone they can feel cluttered. Presets take a `displayTier: broadcast | mobile` input; mobile tier auto-reduces complexity.
- **Pre-composited background plates are still in scope.** Not everything needs a real live AR pipeline. Several of the compass-cited overlays can be pre-composited during post-production; the preset outputs instructions for the compositor (markers, anchor points) alongside the overlay itself.

## Escalation

If the brief requires AR for a sport we don't have a preset for (tennis Hawk-Eye ball-tracker, cycling TdF 3D topographic), escalate. Each sport's AR convention is highly specific.

If the tenant has not enabled the frontier posture for interactive clips (ADR-005 §D3), AR presets cannot mount live; they fall back to their `staticFallback` composite.

## Type-design — no cluster-wide batch review

This cluster uses mostly open or platform fonts. Individual presets escalate if they cite bespoke type.

## Related

- ADR-003 (interactive runtime tier — `ThreeSceneClip`)
- ADR-005 (frontier clip catalogue — AR presets are interactive)
- `skills/stageflip/presets/sports/SKILL.md` (cluster B — pairs for composite broadcast)
- `skills/stageflip/runtimes/three/SKILL.md` — underlying runtime
- Compass canon: `docs/compass_artifact.md` §§ Premier League / Sky Sports AR, VAR, Olympic swimming lane tracker, Tour de France tracker
