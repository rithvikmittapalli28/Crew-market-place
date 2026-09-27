import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crewn.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/marketplace", "/creators/", "/login", "/register", "/forgot-password"],
        disallow: [
          "/api/",
          "/admin/",
          "/business/",
          "/freelancer/",
          "/projects/",
          "/messages/",
          "/settings/",
          "/onboarding/",
        ],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
