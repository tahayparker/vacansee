// src/pages/_app.tsx
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { Montserrat } from "next/font/google";
import GradientBackground from '@/components/GradientBackground';
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useEffect, useState, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/router';
import type { Session } from '@supabase/supabase-js'; // Re-added Session type import
import { cn } from "@/lib/utils";
import { PUBLIC_PATHS } from '@/lib/paths';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from "@vercel/speed-insights/next";

// --- Font Setup ---
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", weight: ['300', '400', '500', '600', '700', '800'], });

// --- Helper to determine if a path is considered protected Client-Side ---
function isProtectedClientSide(pathname: string): boolean {
    if (
        pathname.startsWith('/_next/') || pathname.startsWith('/api/_next/') ||
        pathname.includes('/.') || pathname.endsWith('.ico') || pathname.endsWith('.png') ||
        pathname.endsWith('.jpg') || pathname.endsWith('.jpeg') || pathname.endsWith('.svg') ||
        pathname.endsWith('.css') || pathname.endsWith('.js')
    ) { return false; }
    return !PUBLIC_PATHS.includes(pathname);
}

export default function App({ Component, pageProps }: AppProps) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [sessionLoading, setSessionLoading] = useState(true);
  const initialCheckDone = useRef(false);

  // --- Effect for Handling Auth State Changes ---
  useEffect(() => {
    let isMounted = true;

    // CORRECTED: Use the specific 'Session | null' type
    const handleSessionUpdate = (session: Session | null) => {
      if (!isMounted) return;
      // Log simplified message or user ID if session exists
      console.log("[_app Client] Session update received:", session ? `User ID: ${session.user.id}` : "No session");
      if (!initialCheckDone.current) {
        setSessionLoading(false);
        initialCheckDone.current = true;
      }
    };

    // Perform initial check
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (isMounted) {
            console.log("[_app Client] Initial getSession result:", session ? `User ID: ${session.user.id}` : "No session");
            handleSessionUpdate(session);
        }
      })
      .catch(error => {
        console.error('[_app Client] Initial getSession error:', error);
        if (isMounted) {
          handleSessionUpdate(null); // Explicitly handle error case by passing null
          // Ensure loading is set to false even on initial error
          if (!initialCheckDone.current) {
            setSessionLoading(false);
            initialCheckDone.current = true;
          }
        }
      });

    // Listen for subsequent changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (isMounted) {
          console.log(`[_app Client] onAuthStateChange event: ${event}`);
          handleSessionUpdate(session);
          // Ensure loading is false if we get an event after initial load
          if (initialCheckDone.current && sessionLoading) {
              setSessionLoading(false);
          }
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
      console.log("[_app Client] Unsubscribed from auth state changes.");
    };
    // Keep sessionLoading dependency as advised by exhaustive-deps
  }, [supabase, sessionLoading]);

  // --- Loading/Rendering Logic ---
  const isClientSideProtected = isProtectedClientSide(router.pathname);
  const showLoader = sessionLoading && isClientSideProtected;

  if (showLoader) {
    return (
      <div className={`${montserrat.className} bg-background text-foreground min-h-screen flex flex-col relative`}>
        <GradientBackground />
        <div className="flex flex-grow items-center justify-center z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/50"></div>
        </div>
      </div>
    );
  }

  // Render the component
  return (
    <div className={`${montserrat.className} bg-background text-foreground min-h-screen flex flex-col relative`}>
      <GradientBackground />
      <SiteHeader />
      <main className={cn(
          "flex flex-col flex-grow items-center z-10 w-full px-4 sm:px-8",
          router.pathname === '/' ? "md:justify-center pt-16 md:pt-0" : "justify-center"
      )}>
        <Component {...pageProps} />
      </main>
      <SiteFooter />
      <Analytics />
      <SpeedInsights />
    </div>
  );
}