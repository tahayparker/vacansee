// src/pages/_app.tsx
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import PlasmaBackground from "@/components/PlasmaBackground";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { ScrollToTop } from "@/components/ScrollToTop";
import { Onboarding } from "@/components/Onboarding";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { useEffect, useState, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/router";
import type { Session } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { PUBLIC_PATHS } from "@/lib/paths";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { TimeFormatProvider } from "@/contexts/TimeFormatContext";
import { ToastProvider } from "@/components/ui/toast";
import { montserrat, fontOptimization } from "@/lib/fonts";
import { LoadingSpinner } from "@/components/LoadingSpinner";

const NO_LAYOUT_PAGES: string[] = []; // All pages now have header/footer

function isProtectedClientSide(pathname: string): boolean {
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
    pathname.endsWith(".js")
  ) {
    return false;
  }
  return (
    !PUBLIC_PATHS.includes(pathname) && !NO_LAYOUT_PAGES.includes(pathname)
  );
}

export default function App({ Component, pageProps }: AppProps) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [sessionLoading, setSessionLoading] = useState(true);
  const initialCheckDone = useRef(false);

  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";

  // Register service worker for PWA functionality
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log(
            "Service Worker registered successfully:",
            registration.scope,
          );
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }
  }, []);

  // Preload fonts for better performance
  useEffect(() => {
    fontOptimization.preloadFonts();
  }, []);

  // Ensure all pages start at the top on navigation
  useEffect(() => {
    const handleRouteChange = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };

    // Scroll immediately on route change start
    router.events.on("routeChangeStart", handleRouteChange);

    // Also scroll when route change completes (for safety)
    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeStart", handleRouteChange);
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events]);

  useEffect(() => {
    let isMounted = true;

    const handleSessionUpdate = (session: Session | null) => {
      if (!isMounted) return;
      console.log(
        "[_app Client] Session update received:",
        session ? `User ID: ${session.user.id}` : "No session",
      );
      if (!initialCheckDone.current) {
        setSessionLoading(false);
        initialCheckDone.current = true;
      }
    };

    // Only fetch session if router is ready to avoid unnecessary calls
    if (router.isReady) {
      supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          if (isMounted) {
            console.log(
              "[_app Client] Initial getSession result:",
              session ? `User ID: ${session.user.id}` : "No session",
            );
            handleSessionUpdate(session);
          }
        })
        .catch((error) => {
          console.error("[_app Client] Initial getSession error:", error);
          if (isMounted) {
            handleSessionUpdate(null);
            if (!initialCheckDone.current) {
              setSessionLoading(false);
              initialCheckDone.current = true;
            }
          }
        });
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (isMounted) {
          console.log(`[_app Client] onAuthStateChange event: ${event}`);
          handleSessionUpdate(session);
          if (initialCheckDone.current && sessionLoading) {
            setSessionLoading(false);
          }

          // Handle sign out - redirect to home for protected pages
          if (event === "SIGNED_OUT") {
            const isProtectedPath = isProtectedClientSide(router.pathname);
            if (isProtectedPath) {
              router.replace("/");
            }
          }
        }
      },
    );

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
      console.log("[_app Client] Unsubscribed from auth state changes.");
    };
  }, [supabase, sessionLoading, router.isReady, router]);

  const isClientSideProtectedPath = isProtectedClientSide(router.pathname);
  const showLoader =
    sessionLoading && isClientSideProtectedPath && !isMaintenanceMode;

  if (showLoader) {
    return (
      <div
        className={`${montserrat.className} bg-background text-foreground min-h-screen flex flex-col relative`}
      >
        <PlasmaBackground />
        <div className="flex flex-grow items-center justify-center z-10">
          <LoadingSpinner size="large" />
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div
        className={`${montserrat.className} bg-background text-foreground min-h-screen flex flex-col relative`}
      >
        <PlasmaBackground />
        <TimeFormatProvider>
          <SiteHeader maintenanceMode={isMaintenanceMode} />
          <main
            className={cn(
              "flex flex-col flex-grow items-center z-10 w-full px-4 sm:px-8",
              router.pathname === "/" && !isMaintenanceMode
                ? "justify-center pt-16 md:pt-0"
                : router.pathname === "/maintenance"
                  ? "justify-center pt-16" // Ensure maintenance page content is also centered
                  : router.pathname === "/404"
                    ? "justify-center pt-16" // Center the 404 page content
                    : router.pathname === "/500"
                      ? "justify-center pt-16" // Center the 500 page content
                      : router.pathname === "/unauthorized"
                        ? "justify-center pt-16" // Center the unauthorized page content
                        : router.pathname === "/auth/login"
                          ? "justify-center pt-16" // Center the login page content
                          : "pt-4", // Default for other pages needing header space
            )}
          >
            <Component {...pageProps} />
          </main>
          <SiteFooter />
        </TimeFormatProvider>

        {/* Global UI Components */}
        <ScrollToTop />
        <Onboarding />
        <PWAInstallPrompt />

        {/* Analytics */}
        <Analytics />
        <SpeedInsights />
      </div>
    </ToastProvider>
  );
}
