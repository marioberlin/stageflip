// apps/stageflip-slide/next.config.mjs
// Next.js 15 app config for StageFlip.Slide (T-122 walking skeleton).
// Transpile the workspace packages consumed by the shell so Next's
// bundler applies its React JSX runtime + SWC transforms to their
// source rather than expecting pre-built dist output.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@stageflip/app-agent', '@stageflip/editor-shell', '@stageflip/schema'],
  // sharp is LGPL-3.0 and excluded via pnpm `ignoredOptionalDependencies`
  // at the workspace root (CLAUDE.md §3 license whitelist). Disable the
  // image optimizer so Next.js doesn't try to require the missing
  // binary. Walking-skeleton content does not ship optimized images.
  images: { unoptimized: true },
};

export default nextConfig;
