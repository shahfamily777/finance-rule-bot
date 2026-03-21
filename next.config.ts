import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

// Pin the app root when a parent folder also has a lockfile (avoids wrong package.json + CJS/ESM mismatch).
const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: appRoot,
  },
  outputFileTracingRoot: appRoot,
};

export default nextConfig;
