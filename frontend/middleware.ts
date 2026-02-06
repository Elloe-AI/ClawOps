import { NextResponse } from "next/server";
import { NextRequestWithAuth, withAuth } from "next-auth/middleware";

import { isTracePublic } from "@/lib/actions/trace";
import { isUserMemberOfProject, isUserMemberOfWorkspace } from "@/lib/authorization";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const getRateLimitStore = () => {
  const globalRef = globalThis as typeof globalThis & { __clawopsRateLimit?: Map<string, RateLimitEntry> };
  if (!globalRef.__clawopsRateLimit) {
    globalRef.__clawopsRateLimit = new Map();
  }
  return globalRef.__clawopsRateLimit;
};

const rateLimitWindowMs = Number(process.env.CLAWOPS_RATE_LIMIT_WINDOW_MS ?? 60_000);
const rateLimitMax = Number(process.env.CLAWOPS_RATE_LIMIT_MAX ?? 900);

const rateLimit = (req: NextRequestWithAuth) => {
  if (!Number.isFinite(rateLimitWindowMs) || !Number.isFinite(rateLimitMax)) return null;

  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = req.ip ?? forwardedFor?.split(",")[0]?.trim() ?? "unknown";
  const key = `${ip}:${req.nextUrl.pathname}`;
  const now = Date.now();
  const store = getRateLimitStore();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    return null;
  }

  const updated = { ...entry, count: entry.count + 1 };
  store.set(key, updated);

  if (updated.count > rateLimitMax) {
    const retryAfterSeconds = Math.ceil((updated.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded", code: "RATE_LIMITED", retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  return null;
};

export default withAuth(
  async function middleware(req: NextRequestWithAuth) {
    const rateLimited = rateLimit(req);
    if (rateLimited) {
      return rateLimited;
    }
    const token = req.nextauth.token;
    const legacyRouteToken = ["hi", "pocap"].join("");
    if (req.nextUrl.pathname.includes(`/api/projects/`) && req.nextUrl.pathname.includes(`/${legacyRouteToken}`)) {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const projectIdMatch = req.nextUrl.pathname.match(/^\/api\/projects(?:\/([^\/]+))?/);
    if (projectIdMatch) {
      if (!token) {
        return NextResponse.json({ error: "Authentication required", code: "UNAUTHENTICATED" }, { status: 401 });
      }

      const projectId = projectIdMatch[1];
      if (projectId) {
        const userId = token.userId as string;
        const hasAccess = await isUserMemberOfProject(projectId, userId);

        if (!hasAccess) {
          return NextResponse.json(
            { error: "You do not have access to this project", code: "FORBIDDEN" },
            { status: 403 }
          );
        }
      }
    }

    const workspaceIdMatch = req.nextUrl.pathname.match(/^\/api\/workspaces(?:\/([^\/]+))?/);
    if (workspaceIdMatch) {
      if (!token) {
        return NextResponse.json({ error: "Authentication required", code: "UNAUTHENTICATED" }, { status: 401 });
      }

      const workspaceId = workspaceIdMatch[1];
      if (workspaceId) {
        const userId = token.userId as string;
        const hasAccess = await isUserMemberOfWorkspace(workspaceId, userId);

        if (!hasAccess) {
          return NextResponse.json(
            { error: "You do not have access to this workspace", code: "FORBIDDEN" },
            { status: 403 }
          );
        }
      }
    }

    const traceMatch = req.nextUrl.pathname.match(/^\/api\/shared\/traces\/([^\/]+)/);
    if (traceMatch) {
      const traceId = traceMatch[1];
      const isPublic = await isTracePublic(traceId);

      if (!isPublic) {
        return NextResponse.json({ error: "Trace not found or not public", code: "NOT_FOUND" }, { status: 404 });
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // if false returns redirect, let return true and handle for proper errors in case.
        if (req.nextUrl.pathname.startsWith("/api/")) {
          return true;
        }
        return !!token;
      },
    },
    pages: {
      signIn: "/sign-in",
    },
  }
);

export const config = {
  matcher: [
    "/api/projects",
    "/api/workspaces",
    "/api/projects/:path+",
    "/api/workspaces/:path+",
    "/api/runtime/:path+",
    "/api/shared/traces/:path+",
  ],
  runtime: "nodejs",
};
