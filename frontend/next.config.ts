import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Настраиваем прокси для разработки
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*', // Перенаправляем на Django
      },
      {
        source: '/media/:path*',
        destination: 'http://127.0.0.1:8000/media/:path*', // Чтобы фронтенд мог грузить картинки
      }
    ];
  },
};

export default nextConfig;