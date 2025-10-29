// src/hooks/useRequireAuth.ts
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Custom hook to protect pages requiring authentication.
 * Redirects to login if user is not authenticated.
 * 
 * @returns Object containing user, loading state, and authenticated status
 */
export function useRequireAuth() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (!session) {
          // No session - redirect to login with return URL
          console.log("[useRequireAuth] No session found, redirecting to login");
          const returnUrl = router.asPath;
          router.replace(`/auth/login?next=${encodeURIComponent(returnUrl)}`);
          setIsAuthenticated(false);
        } else {
          // Session exists
          console.log("[useRequireAuth] Session found, user authenticated");
          setUser(session.user);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("[useRequireAuth] Error checking authentication:", error);
        if (isMounted) {
          router.replace("/auth/login");
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        console.log(`[useRequireAuth] Auth state changed: ${event}`);

        if (event === "SIGNED_OUT" || !session) {
          // User signed out - redirect to login
          setUser(null);
          setIsAuthenticated(false);
          router.replace("/auth/login");
        } else if (event === "SIGNED_IN" && session) {
          // User signed in
          setUser(session.user);
          setIsAuthenticated(true);
        }
      }
    );

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [router, supabase]);

  return { user, loading, isAuthenticated };
}
