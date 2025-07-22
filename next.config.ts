// next.config.js (プロジェクトルート)
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'image.tmdb.org', // TMDBのポスター画像
      // もし使用しているなら、WatchModeのロゴ画像など
      // 'cdn.watchmode.com',
      // 'assets.stream-cinema.com' // 他にも使用しているドメインがあれば追加
    ],
  },
};

module.exports = nextConfig;