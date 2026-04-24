// apps/stageflip-display/next.config.mjs
// Next.js 15 app config for StageFlip.Display (T-207 walking skeleton).
// Mirrors apps/stageflip-video: transpile workspace packages so Next's
// bundler applies React JSX + SWC transforms to source, and disable
// the sharp-backed image optimizer (LGPL-3.0 — excluded at workspace
// root per CLAUDE.md §3 / THIRD_PARTY.md).

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@stageflip/app-agent',
    '@stageflip/editor-shell',
    '@stageflip/profiles-display',
    '@stageflip/schema',
  ],
  images: { unoptimized: true },
};

export default nextConfig;
