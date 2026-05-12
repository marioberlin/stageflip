// apps/audience-join/next.config.mjs
// Next.js 15 config for the audience-join voter landing page (T-456).
// Transpiles the workspace packages the voter app imports so Next's
// SWC pipeline applies to their TS source rather than expecting
// pre-built dist output.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@stageflip/audience-contract',
    '@stageflip/audience-join-shared',
    '@stageflip/runtimes-audience',
  ],
  // sharp is LGPL-3.0 and excluded via pnpm `ignoredOptionalDependencies`
  // at the workspace root. Disable the optimizer so Next.js doesn't try
  // to require the missing binary.
  images: { unoptimized: true },
};

export default nextConfig;
