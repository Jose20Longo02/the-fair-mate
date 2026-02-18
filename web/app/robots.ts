import type { MetadataRoute } from "next";

const SITE_URL = "https://thefairmate.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/how-it-works", "/fair-play", "/ranking", "/support", "/terms", "/privacy"],
        disallow: ["/admin", "/api", "/account", "/game", "/play", "/login", "/register", "/feedback", "/verify-email", "/forgot-password", "/reset-password", "/test-game"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
