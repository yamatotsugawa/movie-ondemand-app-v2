/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['image.tmdb.org'], // ここにTMDBの画像ドメインを追加
  },
};

module.exports = nextConfig;