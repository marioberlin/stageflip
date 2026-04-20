// packages/frame-runtime/src/spring.ts
// Semi-implicit Euler spring integrator. Given a frame number + config,
// returns the current displacement value. Per T-043 [rev]: strict input
// validation rejects NaN outputs — invalid params throw with a useful
// message. Deterministic; scanned by check-determinism.

export interface SpringConfig {
  /** Current frame. Non-negative integer. */
  frame: number;
  /** Frames per second. Integer > 0. */
  fps: number;

  /** Starting value. Default 0. */
  from?: number;
  /** Target value. Default 1. */
  to?: number;

  /** Mass. Must be > 0. Default 1. */
  mass?: number;
  /** Spring stiffness. Must be > 0. Default 100. */
  stiffness?: number;
  /** Damping. Must be ≥ 0.01. Default 10. */
  damping?: number;
  /** Initial velocity. Default 0. */
  initialVelocity?: number;

  /**
   * If true, clamp values so the spring never crosses its target (no
   * overshoot). Useful for UI transitions. Default false.
   */
  overshootClamping?: boolean;
}

interface ResolvedConfig {
  frame: number;
  fps: number;
  from: number;
  to: number;
  mass: number;
  stiffness: number;
  damping: number;
  initialVelocity: number;
  overshootClamping: boolean;
}

function resolveConfig(config: SpringConfig): ResolvedConfig {
  const fps = config.fps;
  const frame = config.frame;
  const mass = config.mass ?? 1;
  const stiffness = config.stiffness ?? 100;
  const damping = config.damping ?? 10;

  if (!Number.isFinite(frame) || frame < 0) {
    throw new Error(`spring: frame must be a non-negative finite number (got ${frame})`);
  }
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error(`spring: fps must be a positive finite number (got ${fps})`);
  }
  if (!Number.isFinite(mass) || mass <= 0) {
    throw new Error(`spring: mass must be > 0 (got ${mass})`);
  }
  if (!Number.isFinite(stiffness) || stiffness <= 0) {
    throw new Error(`spring: stiffness must be > 0 (got ${stiffness})`);
  }
  if (!Number.isFinite(damping) || damping < 0.01) {
    throw new Error(`spring: damping must be ≥ 0.01 (got ${damping})`);
  }

  return {
    frame,
    fps,
    from: config.from ?? 0,
    to: config.to ?? 1,
    mass,
    stiffness,
    damping,
    initialVelocity: config.initialVelocity ?? 0,
    overshootClamping: config.overshootClamping ?? false,
  };
}

/**
 * Return the spring's position at a given frame. Uses semi-implicit Euler
 * integration with adaptive substepping — each outer frame tick is
 * subdivided according to the stability criterion for the configured
 * (mass, stiffness, damping) triple so the integrator doesn't diverge on
 * extreme parameter ratios. For typical animations (defaults; 60–300
 * frames) the substep count is 1–3.
 */
export function spring(config: SpringConfig): number {
  const c = resolveConfig(config);
  const outerDt = 1 / c.fps;

  // Stability criterion: dt must be smaller than 1 / max(sqrt(k/m), c/m),
  // with a safety factor. Above that, explicit / semi-implicit Euler
  // explodes. 8× oversampling keeps the integrator well-behaved across
  // the realistic parameter envelope.
  const naturalFreq = Math.sqrt(c.stiffness / c.mass);
  const dampingRate = c.damping / c.mass;
  const maxRate = Math.max(naturalFreq, dampingRate);
  const safeDt = 1 / (maxRate * 8);
  const substepsPerFrame = Math.min(1000, Math.max(1, Math.ceil(outerDt / safeDt)));
  const dt = outerDt / substepsPerFrame;

  // Internal state tracks displacement from the target (to). We start at
  // (from - to) and integrate toward 0; result is `to + x`.
  let x = c.from - c.to;
  let v = c.initialVelocity;

  const fullFrames = Math.floor(c.frame);
  const fractional = c.frame - fullFrames;
  const totalInnerSteps = fullFrames * substepsPerFrame;

  for (let i = 0; i < totalInnerSteps; i++) {
    const a = (-c.stiffness * x - c.damping * v) / c.mass;
    v += a * dt;
    x += v * dt;
  }

  // Handle fractional-frame tail with a single sub-duration Euler step.
  if (fractional > 0) {
    const fracSteps = Math.max(1, Math.floor(substepsPerFrame * fractional));
    const fracDt = (outerDt * fractional) / fracSteps;
    for (let i = 0; i < fracSteps; i++) {
      const a = (-c.stiffness * x - c.damping * v) / c.mass;
      v += a * fracDt;
      x += v * fracDt;
    }
  }

  let result = c.to + x;

  if (c.overshootClamping) {
    // Clamp so we never cross the target from either side.
    if (c.to > c.from) result = Math.min(result, c.to);
    else result = Math.max(result, c.to);
  }

  if (Number.isNaN(result)) {
    // Defense-in-depth: per T-043 the caller must never see NaN.
    throw new Error(
      `spring: produced NaN from config ${JSON.stringify({
        frame: c.frame,
        fps: c.fps,
        mass: c.mass,
        stiffness: c.stiffness,
        damping: c.damping,
      })}`,
    );
  }
  return result;
}
