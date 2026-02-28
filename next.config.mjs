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
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: cspDirectives,
  },
  env: {
    APP_REGION: process.env.APP_REGION,
    APP_S3_BUCKET_NAME: process.env.APP_S3_BUCKET_NAME,
    APP_SES_FROM_EMAIL: process.env.APP_SES_FROM_EMAIL,
    APP_BEDROCK_ROUTER_ARN: process.env.APP_BEDROCK_ROUTER_ARN,
    MIMAMORI_USERS_TABLE: process.env.MIMAMORI_USERS_TABLE,
    MIMAMORI_DATA_TABLE: process.env.MIMAMORI_DATA_TABLE,
    APP_ACCESS_KEY_ID: process.env.APP_ACCESS_KEY_ID,
    APP_SECRET_ACCESS_KEY: process.env.APP_SECRET_ACCESS_KEY,
    SESSION_JWT_SECRET: process.env.SESSION_JWT_SECRET,
  },
};

export default withNextIntl(nextConfig);
