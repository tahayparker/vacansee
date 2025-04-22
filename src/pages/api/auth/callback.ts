// pages/api/auth/callback.ts
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import type { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'cookie';
import { URL } from 'url'; // Import URL for robust URL construction

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const rawCookieHeader = req.headers.cookie || '';
    console.log('--- Callback Debug START ---');
    console.log('[Callback] Raw Cookie Header:', rawCookieHeader);
    const parsedCookies = parse(rawCookieHeader);
    // Basic logging (keep minimal in production)
    const pkceCookieKey = Object.keys(parsedCookies).find(key => key.includes('-auth-token-code-verifier'));
    console.log(`[Callback] PKCE Cookie ${pkceCookieKey ? 'Found' : 'Not Found'}.`);
    console.log(`[Callback] Redirect Cookie ${parsedCookies['supabase-redirect-path'] ? 'Found' : 'Not Found'}.`);
    console.log('[Callback] Received Query Params:', req.query);
    console.log('--- Callback Debug END ---');

    // --- Get Base URL ---
    const getBaseUrl = () => {
        // Prefer NEXT_PUBLIC_SITE_URL if set, otherwise derive from headers
        const forwardedProto = req.headers['x-forwarded-proto'];
        const proto = typeof forwardedProto === 'string' ? forwardedProto : 'http';
        const host = req.headers.host || 'localhost:3000';
        return process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;
    };
    const baseUrl = getBaseUrl();
    console.log('[Callback] Base URL:', baseUrl);

    // --- Check for Specific 'signup_disabled' Error FIRST ---
    const errorCode = req.query.error_code;
    const errorDescription = req.query.error_description; // For logging

    if (errorCode === 'signup_disabled') {
        console.warn(`[Callback] Detected signup_disabled error. Redirecting to /unauthorized. Description: ${errorDescription}`);
        const unauthorizedUrl = new URL('/unauthorized', baseUrl);
        res.redirect(unauthorizedUrl.toString()).end();
        return; // Stop processing immediately
    }
    // --- End Specific Error Check ---

    // --- Proceed with Code Exchange if no specific error blocked us ---
    const code = req.query.code;

    if (typeof code !== 'string') {
        console.error('[Callback] Error: No valid authentication code received.');
        const loginUrl = new URL('/auth/login', baseUrl);
        // Provide a more generic error for the user on the login page
        loginUrl.searchParams.set('error', 'Authentication process failed. No code received.');
        res.redirect(loginUrl.toString()).end();
        return;
    }

    // Initialize Supabase client for code exchange
    const supabase = createSupabaseRouteHandlerClient(req, res);

    try {
        console.log('[Callback] Attempting to exchange code for session...');
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
            console.error('[Callback] Error exchanging code:', exchangeError.message);
            const loginUrl = new URL('/auth/login', baseUrl);
            // Pass a user-friendly error message back to the login page
            loginUrl.searchParams.set('error', `Authentication failed: ${exchangeError.message}. Please try again.`);
            res.redirect(loginUrl.toString()).end();
            return;
        }

        // Successful exchange, determine redirect path
        let finalRedirectUrlPath = '/'; // Default to homepage
        const redirectPathCookie = parsedCookies['supabase-redirect-path'];

        if (typeof redirectPathCookie === 'string' && redirectPathCookie.startsWith('/')) {
            finalRedirectUrlPath = redirectPathCookie;
            console.log(`[Callback] Found redirect path in cookie: ${finalRedirectUrlPath}`);
        } else {
            console.log(`[Callback] No valid redirect path cookie found, defaulting to '/'`);
        }

        // Construct final URL safely
        const finalRedirectUrl = new URL(finalRedirectUrlPath, baseUrl);
        console.log('[Callback] Authentication successful. Redirecting to:', finalRedirectUrl.toString());
        // NOTE: The 'supabase-redirect-path' cookie should be cleared client-side AFTER successful redirect.

        res.redirect(finalRedirectUrl.toString()).end();

    } catch (err: any) {
        console.error('[Callback] Unexpected error during code exchange process:', err);
        const loginUrl = new URL('/auth/login', baseUrl);
        loginUrl.searchParams.set('error', 'An unexpected error occurred during login. Please try again.');
        res.redirect(loginUrl.toString()).end();
    }
}