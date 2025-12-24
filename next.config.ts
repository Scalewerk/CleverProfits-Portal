import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb', // Allow large Excel file uploads
    },
    middlewareClientMaxBodySize: '50mb', // Allow large file uploads through middleware
  },
  // Allow Supabase storage domain for images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
