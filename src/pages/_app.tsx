// src/pages/_app.tsx
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Montserrat } from "next/font/google";
import GradientBackground from "@/components/GradientBackground";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useEffect, useState, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/router";
import type { Session } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { PUBLIC_PATHS } from "@/lib/paths";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const NO_LAYOUT_PAGES = ["/auth/login"]; // Add any other pages that shouldn't have header/footer

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

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (isMounted) {
          console.log(`[_app Client] onAuthStateChange event: ${event}`);
          handleSessionUpdate(session);
          if (initialCheckDone.current && sessionLoading) {
            setSessionLoading(false);
          }
        }
      },
    );

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
      console.log("[_app Client] Unsubscribed from auth state changes.");
    };
  }, [supabase, sessionLoading]);

  const isClientSideProtectedPath = isProtectedClientSide(router.pathname);
  const showLoader =
    sessionLoading && isClientSideProtectedPath && !isMaintenanceMode;

  if (showLoader) {
    return (
      <div
        className={`${montserrat.className} bg-background text-foreground min-h-screen flex flex-col relative`}
      >
        <GradientBackground />
        <div className="flex flex-grow items-center justify-center z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/50"></div>
        </div>
      </div>
    );
  }

  if (NO_LAYOUT_PAGES.includes(router.pathname)) {
    return (
      <div className={`${montserrat.variable} font-sans`}>
        {router.pathname === "/auth/login" && <GradientBackground />}
        <Component {...pageProps} />
        <Analytics />
        <SpeedInsights />
      </div>
    );
  }

  return (
    <div
      className={`${montserrat.className} bg-background text-foreground min-h-screen flex flex-col relative`}
    >
      <GradientBackground />
      <SiteHeader maintenanceMode={isMaintenanceMode} />
      <main
        className={cn(
          "flex flex-col flex-grow items-center z-10 w-full px-4 sm:px-8",
          router.pathname === "/" && !isMaintenanceMode
            ? "md:justify-center pt-16 md:pt-0"
            : router.pathname === "/maintenance"
              ? "justify-center pt-16" // Ensure maintenance page content is also centered
              : "pt-4", // Default for other pages needing header space
        )}
      >
        <Component {...pageProps} />
      </main>
      <SiteFooter />
      <Analytics />
      <SpeedInsights />
    </div>
  );
}
