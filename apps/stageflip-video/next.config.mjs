// apps/stageflip-video/next.config.mjs
// Next.js 15 app config for StageFlip.Video (T-187a walking skeleton).
// Mirrors apps/stageflip-slide: transpile workspace packages so Next's
// bundler applies React JSX + SWC transforms to source, and disable the
// sharp-backed image optimizer (LGPL-3.0 — excluded at workspace root).

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@stageflip/editor-shell',
    '@stageflip/profiles-video',
    '@stageflip/schema',
  ],
  images: { unoptimized: true },
};

export default nextConfig;
