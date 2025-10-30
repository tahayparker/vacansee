// src/middleware.ts
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PUBLIC_PATHS } from "@/lib/paths";

const ALLOWED_DURING_MAINTENANCE: string[] = [
  "/maintenance",
  "/docs",
  "/legal",
  "/privacy",
  "/api/auth/callback", // For admin login if needed to turn off maintenance
  // Add paths for any essential static assets if not handled by matcher:
  // e.g., '/fonts/Qurova-SemiBold.otf'
];

async function requiresAuthentication(pathname: string): Promise<boolean> {
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/_next/") ||
    pathname.includes("/.") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js") ||
    pathname === "/manifest.json"
  ) {
    return false;
  }
  if (PUBLIC_PATHS.includes(pathname)) {
    console.log(`[Middleware] Path "${pathname}" is explicitly PUBLIC.`);
    return false;
  }
  console.log(
    `[Middleware] Path "${pathname}" is assumed PROTECTED (Default).`,
  );
  return true;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  console.log(`[Middleware] Method: ${req.method}, Path: "${pathname}"`);

  const isMaintenanceModeActive =
    process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";

  if (isMaintenanceModeActive) {
    if (
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/api/_next/") || // Allow Next.js API internals
      pathname.endsWith(".ico") ||
      pathname.endsWith(".png") ||
      pathname.endsWith(".jpg") ||
      pathname.endsWith(".jpeg") ||
      pathname.endsWith(".svg") ||
      pathname.endsWith(".css") ||
      pathname.endsWith(".js") ||
      pathname === "/manifest.json" ||
      pathname.startsWith("/fonts/") // Allow font files if in /public/fonts
    ) {
      console.log(
        `[Middleware] Maintenance: Allowing static/internal asset path "${pathname}".`,
      );
      return NextResponse.next();
    }

    if (!ALLOWED_DURING_MAINTENANCE.includes(pathname)) {
      console.log(
        `[Middleware] Maintenance Mode ON. Path "${pathname}" is NOT allowed. Redirecting to /maintenance.`,
      );
      const maintenanceUrl = new URL("/maintenance", req.url);
      return NextResponse.redirect(maintenanceUrl, { status: 307 });
    }
    console.log(
      `[Middleware] Maintenance Mode ON. Path "${pathname}" IS allowed.`,
    );
    return NextResponse.next();
  }

  if (req.method === "OPTIONS") {
    console.log(`[Middleware] Allowing OPTIONS request for CORS preflight.`);
    return NextResponse.next();
  }

  const needsAuth = await requiresAuthentication(pathname);

  if (needsAuth) {
    console.log(
      `[Middleware] Authentication required for "${pathname}". Checking session...`,
    );
    // Only create Supabase client when auth is actually needed
    const res = NextResponse.next();
    const supabase = createMiddlewareClient({ req, res });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? "None";
    console.log(`[Middleware] User: ${userId}`);

    if (!session) {
      console.log(`[Middleware] -> Auth REQUIRED but no session found.`);
      if (pathname.startsWith("/api/")) {
        console.log(`[Middleware] -> API route access denied (401).`);
        return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      } else {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = "/auth/login";
        redirectUrl.searchParams.set("next", pathname);
        console.log(`[Middleware] -> Redirecting page route to login.`);
        return NextResponse.redirect(redirectUrl);
      }
    } else {
      console.log(
        `[Middleware] -> Session found. Allowing authenticated user access.`,
      );
    }
  } else {
    console.log(
      `[Middleware] No authentication required for "${pathname}". Allowing request.`,
    );
  }

  console.log(`[Middleware] Proceeding with request for path "${pathname}"`);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
