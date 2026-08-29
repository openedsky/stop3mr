import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimitFromEdge, rateLimitResponse } from "@/lib/rate-limit-edge";
import {
  buildContentSecurityPolicy,
  createCspNonce,
  getTrustedClientIp,
  isMutatingMethod,
  isSameOriginRequest,
} from "@/lib/security-edge";
import { AppRole, homePathForRole } from "@/lib/roles";

const protectedPagePaths = [
  "/dashboard",
  "/operator",
  "/admin",
  "/clients",
  "/ventes",
  "/profile",
  "/crm",
  "/production",
  "/catalogue",
  "/commercial",
  "/controle",
  "/carte",
  "/rapports",
  "/performances",
];

const publicApiPrefixes = ["/api/auth", "/api/register"];

const adminApiPrefixes = ["/api/admin", "/api/export", "/api/stats"];

const pageRoleMap: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: "/admin", roles: ["ADMINISTRATEUR"] },
  { prefix: "/operator", roles: ["OPERATEUR", "ADMINISTRATEUR"] },
  { prefix: "/production", roles: ["OPERATEUR", "ADMINISTRATEUR"] },
  { prefix: "/controle", roles: ["AGENT_CT", "ADMINISTRATEUR"] },
  { prefix: "/commercial", roles: ["COMMERCIAL", "ADMINISTRATEUR"] },
  { prefix: "/catalogue", roles: ["OPERATEUR", "ADMINISTRATEUR", "COMMERCIAL"] },
  { prefix: "/crm", roles: ["ADMINISTRATEUR"] },
  { prefix: "/ventes", roles: ["ADMINISTRATEUR", "COMMERCIAL"] },
  { prefix: "/clients", roles: ["ADMINISTRATEUR", "COMMERCIAL"] },
  { prefix: "/rapports", roles: ["COMMERCIAL", "AGENT_CT", "ADMINISTRATEUR"] },
  { prefix: "/performances", roles: ["ADMINISTRATEUR", "COMMERCIAL", "AGENT_CT"] },
  { prefix: "/carte", roles: ["ADMINISTRATEUR", "OPERATEUR"] },
];

function isPublicApi(pathname: string): boolean {
  return publicApiPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function getRateLimitKey(request: NextRequest, suffix: string): string {
  const ip = getTrustedClientIp(request);
  return `${suffix}:${ip}`;
}

function withCsp(request: NextRequest, response: NextResponse): NextResponse {
  const nonce = createCspNonce();
  const csp = buildContentSecurityPolicy(nonce);
  request.headers.set("x-nonce", nonce);
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  return response;
}

function nextWithCsp(request: NextRequest): NextResponse {
  const nonce = createCspNonce();
  const csp = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function jsonWithCsp(request: NextRequest, body: unknown, status: number): NextResponse {
  const res = NextResponse.json(body, { status });
  return withCsp(request, res);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/internal/rate-limit")) {
    return nextWithCsp(request);
  }

  if (pathname.startsWith("/api/") && isMutatingMethod(request.method) && !isSameOriginRequest(request)) {
    return jsonWithCsp(request, { error: "Origine refusée" }, 403);
  }

  if (pathname.startsWith("/backup")) {
    return withCsp(request, new NextResponse("Not Found", { status: 404 }));
  }

  if (pathname.startsWith("/verify") || pathname.startsWith("/register")) {
    const rl = await rateLimitFromEdge(
      request,
      getRateLimitKey(request, "public-verify"),
      20,
      15 * 60 * 1000
    );
    if (!rl.success) {
      const limited = rateLimitResponse(rl.resetAt);
      return withCsp(
        request,
        new NextResponse(limited.body, {
          status: 429,
          headers: Object.fromEntries(limited.headers),
        })
      );
    }
    return nextWithCsp(request);
  }

  if (pathname.startsWith("/api/auth") && request.method !== "GET") {
    const rl = await rateLimitFromEdge(request, getRateLimitKey(request, "auth"), 30, 15 * 60 * 1000);
    if (!rl.success) {
      const limited = rateLimitResponse(rl.resetAt);
      return withCsp(request, new NextResponse(limited.body, {
        status: 429,
        headers: Object.fromEntries(limited.headers),
      }));
    }
  }

  if (pathname.startsWith("/api/register")) {
    const rl = await rateLimitFromEdge(
      request,
      getRateLimitKey(request, "register"),
      30,
      15 * 60 * 1000
    );
    if (!rl.success) {
      const limited = rateLimitResponse(rl.resetAt);
      return withCsp(request, new NextResponse(limited.body, {
        status: 429,
        headers: Object.fromEntries(limited.headers),
      }));
    }
  }

  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname)) {
      return nextWithCsp(request);
    }

    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token || token.invalid) {
      return jsonWithCsp(request, { error: "Non authentifié" }, 401);
    }

    const isAdminRoute = adminApiPrefixes.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    if (isAdminRoute && token.role !== "ADMINISTRATEUR") {
      const allowedGet =
        (pathname.startsWith("/api/admin/sites") && request.method === "GET") ||
        (pathname.startsWith("/api/admin/centres") && request.method === "GET");
      if (!allowedGet) {
        return jsonWithCsp(request, { error: "Accès refusé" }, 403);
      }
    }

    if (pathname.startsWith("/api/settings") && request.method !== "GET") {
      if (token.role !== "ADMINISTRATEUR") {
        return jsonWithCsp(request, { error: "Accès refusé" }, 403);
      }
    }

    return nextWithCsp(request);
  }

  const isProtectedPage = protectedPagePaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!isProtectedPage) {
    return nextWithCsp(request);
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token || token.invalid) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return withCsp(request, NextResponse.redirect(loginUrl));
  }

  const role = token.role as AppRole;
  const restriction = pageRoleMap.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)
  );
  if (restriction && !restriction.roles.includes(role)) {
    return withCsp(request, NextResponse.redirect(new URL(homePathForRole(role), request.url)));
  }

  return nextWithCsp(request);
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/login/:path*",
    "/api/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/operator",
    "/operator/:path*",
    "/admin",
    "/admin/:path*",
    "/clients",
    "/clients/:path*",
    "/ventes",
    "/ventes/:path*",
    "/profile",
    "/profile/:path*",
    "/crm",
    "/crm/:path*",
    "/production",
    "/production/:path*",
    "/catalogue",
    "/catalogue/:path*",
    "/commercial",
    "/commercial/:path*",
    "/controle",
    "/controle/:path*",
    "/carte",
    "/carte/:path*",
    "/rapports",
    "/rapports/:path*",
    "/performances",
    "/performances/:path*",
    "/verify",
    "/verify/:path*",
    "/register",
    "/register/:path*",
    "/backup",
    "/backup/:path*",
  ],
};
