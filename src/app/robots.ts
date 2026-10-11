import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/pos", "/account", "/checkout", "/cart", "/api/", "/order-confirmation"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
