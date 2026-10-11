import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";

/**
 * The browser always talks to the API through this origin (/api/*), so auth
 * cookies are first-party. On Vercel this rewrite is the proxy to the API on
 * Render; locally it points at the API on port 4100. The address is fixed when
 * the app is built, so changing API_INTERNAL_URL needs a new build.
 */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4100";
// Where stored pictures are shown from and uploaded to: one origin, or several separated by spaces
// (Cloudinary shows pictures from res.cloudinary.com and takes uploads at api.cloudinary.com).
const MEDIA_ORIGIN = (process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? "http://localhost:9100").split(/[\s,]+/).filter(Boolean).join(" ");
const isProd = process.env.NODE_ENV === "production";

const csp = [
  "default-src 'self'",
  // Razorpay Checkout is loaded from its CDN and opens in an iframe.
  `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src 'self' data: blob: ${MEDIA_ORIGIN} https://*.razorpay.com`,
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' ${MEDIA_ORIGIN} https://*.razorpay.com${isProd ? "" : " ws: http://localhost:*"}`,
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/*
 * One identifier per production build. A browser tab that was opened before a
 * new build still runs the old code; with the identifier, Next notices on the
 * tab's next click that the site has changed and reloads the page, instead of
 * drawing the new page and stylesheet with the old components (which showed as
 * broken controls: dropdowns with repeated arrows).
 *
 * `next build` makes the identifier and keeps it in .deployment-id beside this
 * file; `next start` reads it back, so the pages and the server agree. A deploy
 * pipeline can set NEXT_DEPLOYMENT_ID for both instead.
 *
 * On Vercel the platform names its deployments itself: where its Skew
 * Protection is on it sets NEXT_DEPLOYMENT_ID and answers 404 to an identifier
 * it does not know, so none is made here.
 */
const DEPLOYMENT_FILE = join(process.cwd(), ".deployment-id");

function deploymentId(phase: string): string | undefined {
  if (process.env.VERCEL) return process.env.NEXT_DEPLOYMENT_ID;
  if (phase === PHASE_PRODUCTION_BUILD) {
    const id = process.env.NEXT_DEPLOYMENT_ID ?? Date.now().toString(36);
    // The build's worker processes load this file too and must get the same answer.
    process.env.NEXT_DEPLOYMENT_ID = id;
    writeFileSync(DEPLOYMENT_FILE, id);
    return id;
  }
  if (phase === PHASE_PRODUCTION_SERVER) return process.env.NEXT_DEPLOYMENT_ID ?? (existsSync(DEPLOYMENT_FILE) ? readFileSync(DEPLOYMENT_FILE, "utf8").trim() || undefined : undefined);
  // Development: there are no builds to tell apart.
  return undefined;
}

const config = (phase: string): NextConfig => ({
  reactStrictMode: true,
  deploymentId: deploymentId(phase),
  poweredByHeader: false,
  // Product images are already optimised to WebP/AVIF sizes and served by image storage (R2 or Cloudinary) and its CDN.
  images: { unoptimized: true },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // The POS needs the camera for scanning; nothing else does.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\")" },
        ],
      },
    ];
  },
});

export default config;
