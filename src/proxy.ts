import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "crewn_session";

function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy: Practical, safe for Next.js 16 app router hydration & inline styles
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "frame-src 'self' https://api.razorpay.com",
    "connect-src 'self' https://lumberjack.razorpay.com https://api.razorpay.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\")"
  );

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  return response;
}

/**
 * Next.js 16 Proxy Convention
 * Handles fast optimistic redirects and production security headers.
 * Note: Independent server-side authorization is strictly enforced at the
 * server component / action / API boundary (requireAuthenticatedUser, requireRole, etc.).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password";

  const isProtectedPath =
    pathname.startsWith("/business") ||
    pathname.startsWith("/freelancer") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/onboarding");

  // 1. Fast optimistic redirect: unauthenticated user trying to access protected route
  if (!sessionToken && isProtectedPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    return addSecurityHeaders(redirectResponse);
  }

  // 2. Fast optimistic redirect: user with active session token visiting auth pages
  if (sessionToken && isAuthPage) {
    // Redirect to home/dashboard router (authoritative server-side code handles exact role routing)
    const homeUrl = new URL("/", request.url);
    const redirectResponse = NextResponse.redirect(homeUrl);
    return addSecurityHeaders(redirectResponse);
  }

  const response = NextResponse.next();
  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled directly by Next.js route handlers)
     * - _next/static (static assets)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image/font extensions
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
