// src/middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// Import the single source of truth for public paths
import { PUBLIC_PATHS } from '@/lib/paths';

/**
 * Determines if the given path requires user authentication.
 * Checks against internal Next.js paths, static assets, and the defined PUBLIC_PATHS list.
 * @param pathname The path to check.
 * @returns True if authentication is required, false otherwise.
 */
async function requiresAuthentication(pathname: string): Promise<boolean> {
    // Check if it's an internal Next.js path or a likely static file first
    if (
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/api/_next/') || // Handle API routes under _next if any
        pathname.includes('/.') ||           // Usually hidden files/folders
        pathname.endsWith('.ico') ||         // Favicon
        pathname.endsWith('.png') ||         // Common image types
        pathname.endsWith('.jpg') ||
        pathname.endsWith('.jpeg') ||
        pathname.endsWith('.svg') ||
        pathname.endsWith('.css') ||         // Stylesheets
        pathname.endsWith('.js')             // Scripts (though usually handled by _next)
    ) {
         // console.log(`[Middleware] -> Path "${pathname}" is internal/static.`); // Optional log
         return false; // Never requires auth check from our logic
    }

    // Check against the explicit public list imported from paths.ts
    if (PUBLIC_PATHS.includes(pathname)) {
        console.log(`[Middleware] -> Path "${pathname}" is explicitly PUBLIC.`);
        return false;
    }

    // Default assumption for anything else: Requires authentication
    console.log(`[Middleware] -> Path "${pathname}" is assumed PROTECTED (Default).`);
    return true;
}


export async function middleware(req: NextRequest) {
    const res = NextResponse.next();
    // Removed <Database> generic type - assuming types aren't generated or needed here
    const supabase = createMiddlewareClient({ req, res });
    const { pathname } = req.nextUrl;

    console.log(`[Middleware] Method: ${req.method}, Path: "${pathname}"`);

    // Allow OPTIONS requests early for CORS preflight (before auth checks)
    if (req.method === 'OPTIONS') {
        console.log(`[Middleware] Allowing OPTIONS request for CORS preflight.`);
        // Add required CORS headers here if not handled globally
        // res.headers.set('Access-Control-Allow-Origin', '*');
        // res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
        // res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res;
    }

    // Determine if authentication is needed based on the path
    const needsAuth = await requiresAuthentication(pathname);

    if (needsAuth) {
        console.log(`[Middleware] Authentication required for "${pathname}". Checking session...`);
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id ?? 'None';
        console.log(`[Middleware] User: ${userId}`);

        // If auth is needed but no session exists, redirect or deny
        if (!session) {
            console.log(`[Middleware] -> Auth REQUIRED but no session found.`);
            if (pathname.startsWith('/api/')) {
                // Deny API access for unauthenticated users on protected routes
                console.log(`[Middleware] -> API route access denied (401).`);
                return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
            } else {
                // Redirect page routes to login
                const redirectUrl = req.nextUrl.clone();
                redirectUrl.pathname = '/auth/login';
                redirectUrl.searchParams.set('redirectedFrom', pathname); // Pass original path
                console.log(`[Middleware] -> Redirecting page route to login.`);
                return NextResponse.redirect(redirectUrl);
            }
        } else {
             // User has a session and needsAuth is true - allow access
             console.log(`[Middleware] -> Session found. Allowing authenticated user access.`);
        }
    } else {
        // No authentication needed for this path
         console.log(`[Middleware] No authentication required for "${pathname}". Allowing request.`);
    }

    // If we reach here, the request is allowed to proceed
    console.log(`[Middleware] Proceeding with request for path "${pathname}"`);
    return res;
}

// --- Simplified Matcher ---
export const config = {
  /*
   * Match all request paths except for the ones starting with:
   * - _next/static (static files)
   * - _next/image (image optimization files)
   * - favicon.ico (favicon file)
   * We let the `requiresAuthentication` function handle the logic for public/private paths.
   */
  matcher: [
      '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};