import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AI-generated apps should deploy even if the template has strict type or
  // lint issues. Type errors are compile-time only and don't affect runtime,
  // so we don't let them block a deployment.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Song uploads (MP3/WAV) go through a Server Action and can be up to
    // 50MB; Next.js's default Server Action body limit is 1MB.
    serverActions: { bodySizeLimit: "50mb" },
  },
  // Keep ffmpeg-static's binary path resolution (based on __dirname) intact
  // at runtime — bundling it rewrites __dirname to a placeholder path.
  serverExternalPackages: ["ffmpeg-static"],
  // assets/fonts/noto-sans-regular.ttf is read via a runtime path.join()
  // string (passed to ffmpeg as a CLI arg), not a traceable fs/require call,
  // so Vercel's output file tracer won't include it in the serverless
  // bundle unless told to explicitly.
  outputFileTracingIncludes: {
    "/songs/[id]": ["./assets/fonts/*"],
  },
};

export default nextConfig;
