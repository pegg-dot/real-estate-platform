import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Local dev convenience: the repo-root .env is the single place env lives for BOTH the engine CLIs
// and this app, so load it here if present (values already in the environment win). Docker and
// hosted deploys inject env directly and ship no .env, so this is a no-op there.
const rootEnv = resolve(process.cwd(), "..", ".env");
if (existsSync(rootEnv) && typeof process.loadEnvFile === "function") {
  try { process.loadEnvFile(rootEnv); } catch { /* malformed .env → fall through to plain env */ }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};
export default nextConfig;
