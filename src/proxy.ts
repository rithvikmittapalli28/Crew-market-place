import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { logger } from "@/lib/logger";

export const SESSION_COOKIE_NAME = "crewn_session";

function getAllowedOrigins(): string[] {
  const allowed = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    ...(process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(",") : []),
  ].filter(Boolean) as string[];

  if (process.env.NODE_ENV !== "production") {
    allowed.push("http://localhost:3000", "http://127.0.0.1:3000");
  }

  return allowed.map((o) => o.replace(/\/$/, ""));
}

function handleCors(
  request: NextRequest,
  pathname: string
): { response?: NextResponse; corsHeaders?: Record<string, string> } {
  if (!pathname.startsWith("/api")) {
    return {};
  }

  // Exempt Razorpay webhook and health endpoints from browser CORS origin checks
  if (pathname.startsWith("/api/webhooks/razorpay") || pathname === "/api/health" || pathname === "/api/ready") {
    return {};
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return {};
  }

  const allowedOrigins = getAllowedOrigins();
  const isAllowed = allowedOrigins.includes(origin.replace(/\/$/, ""));

  if (!isAllowed) {
    if (request.method === "OPTIONS") {
      return {
        response: new NextResponse(JSON.stringify({ error: "CORS origin forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      };
    }
    if (["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
      return {
        response: new NextResponse(JSON.stringify({ error: "Cross-origin request forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      };
    }
    return {};
  }

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-request-id",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };

  if (request.method === "OPTIONS") {
    return {
      response: new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
      }),
    };
  }

  return { corsHeaders };
}

function addSecurityHeaders(
  response: NextResponse,
  requestId?: string,
  nonce?: string
): NextResponse {
  const isProd = process.env.NODE_ENV === "production";

  // Production removes unsafe-eval; uses cryptographically random nonce
  const scriptDirectives = [
    "'self'",
    nonce ? `'nonce-${nonce}'` : "",
    isProd ? "" : "'unsafe-eval'",
    "https://checkout.razorpay.com",
  ]
    .filter(Boolean)
    .join(" ");

  const cspHeader = [
    "default-src 'self'",
    `script-src ${scriptDirectives}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
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

  if (requestId) {
    response.headers.set("x-request-id", requestId);
  }
  if (nonce) {
    response.headers.set("x-nonce", nonce);
  }

  if (isProd) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  return response;
}

/**
 * Next.js 16 Proxy Convention
 * Handles request correlation (x-request-id), API latency observability,
 * restrictive CORS, CSP nonces, fast optimistic redirects, and production security headers.
 */
export function proxy(request: NextRequest) {
  const startTime = Date.now();
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // 1. Request Correlation: sanitize incoming or generate safe UUID
  const incomingReqId = request.headers.get("x-request-id");
  const requestId = incomingReqId && /^[a-zA-Z0-9_-]{8,64}$/.test(incomingReqId)
    ? incomingReqId
    : `req_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  // 2. CSP Nonce Generation
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // 3. Restrictive CORS Check
  const corsResult = handleCors(request, pathname);
  if (corsResult.response) {
    addSecurityHeaders(corsResult.response, requestId, nonce);
    return corsResult.response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-nonce", nonce);

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

  let response: NextResponse;

  // 4. Fast optimistic redirect: unauthenticated user trying to access protected route
  if (!sessionToken && isProtectedPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    response = NextResponse.redirect(loginUrl);
  } else if (sessionToken && isAuthPage) {
    // 5. Fast optimistic redirect: user with active session token visiting auth pages
    const homeUrl = new URL("/", request.url);
    response = NextResponse.redirect(homeUrl);
  } else {
    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // 6. Attach security headers and any CORS headers
  addSecurityHeaders(response, requestId, nonce);
  if (corsResult.corsHeaders) {
    for (const [header, val] of Object.entries(corsResult.corsHeaders)) {
      response.headers.set(header, val);
    }
  }

  // 7. API Latency Observability (never logs request bodies)
  const durationMs = Date.now() - startTime;
  logger.info({
    category: "API",
    message: `${request.method} ${pathname} ${response.status} (${durationMs}ms)`,
    requestId,
    details: {
      route: pathname,
      method: request.method,
      status: response.status,
      durationMs,
    },
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static assets)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image/font extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
