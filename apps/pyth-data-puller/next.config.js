/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  logging: {
    fetches: { fullUrl: true },
  },
};
export default config;
