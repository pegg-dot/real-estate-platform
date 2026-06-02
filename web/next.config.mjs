/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // load the repo's .env (SUPABASE_DB_URL + NEXT_PUBLIC_MAPBOX_TOKEN live one level up)
  env: {},
};
export default nextConfig;
