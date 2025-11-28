import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  allowedDevOrigins: [
    "http://localhost:3000",       // Développement local
    "http://192.168.1.75:3000",    // Remplace par ton IP locale si différente
  ],
};

export default nextConfig;
