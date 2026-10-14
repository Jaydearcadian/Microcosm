/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingExcludes: {
    "*": [
      ".env*",
      "**/.env*",
      ".env",
      ".env.local",
      ".env.example",
      "../.env*",
      "../../.env*",
      "**/*.env*"
    ]
  }
};

export default nextConfig;
