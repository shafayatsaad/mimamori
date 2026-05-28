import createNextIntlPlugin from 'next-intl/plugin';
import { existsSync } from 'fs';
import { resolve } from 'path';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Req 1.5: Warn if .env.local is present in the repository (should be gitignored)
const envLocalPath = resolve(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  console.warn(
    '\x1b[33m⚠ WARNING: .env.local file detected in the repository.\n' +
    '  This file must be excluded from version control.\n' +
    '  Ensure .env.local is listed in .gitignore.\x1b[0m'
  );
}

const cspDirectives = process.env.CSP_DIRECTIVES || "default-src 'self'; script-src 'none'; sandbox;";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: cspDirectives,
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SESSION_JWT_SECRET: process.env.SESSION_JWT_SECRET,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
