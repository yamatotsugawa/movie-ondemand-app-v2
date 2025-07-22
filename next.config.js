// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ビルド時のESLintエラー無視
  },
};

module.exports = nextConfig;
