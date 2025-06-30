// src/pages/auth/login.tsx
import GradientBackground from "@/components/GradientBackground";
import { JSX, SVGProps, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/router";
import type { Provider, Session } from "@supabase/supabase-js";
import Cookies from "js-cookie";
import { AlertCircle } from "lucide-react";

// --- SVG Icons ---
export function Google(
  props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>,
) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M21.5939 11.0792H12.3209V13.8256H18.9768C18.6214 17.6382 15.5196 19.286 12.5148 19.286C8.70223 19.286 5.30969 16.3135 5.30969 12.0162C5.30969 7.88057 8.54068 4.74651 12.5148 4.74651C15.5519 4.74651 17.3936 6.71741 17.3936 6.71741L19.2676 4.74651C19.2676 4.74651 16.7474 2.00016 12.3856 2.00016C6.6344 1.96785 2.24023 6.78203 2.24023 11.9839C2.24023 17.0243 6.37592 22 12.4825 22C17.8783 22 21.7554 18.349 21.7554 12.8886C21.7877 11.7578 21.5939 11.0792 21.5939 11.0792Z"
        fill="#ffffff"
      />
    </svg>
  );
}

export function Github(
  props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>,
) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M12 2.24902C6.51613 2.24902 2 6.70064 2 12.249C2 16.6361 4.87097 20.3781 8.87097 21.7329C9.3871 21.8297 9.54839 21.5071 9.54839 21.2813C9.54839 21.0555 9.54839 20.4103 9.51613 19.5393C6.74194 20.1845 6.16129 18.1845 6.16129 18.1845C5.70968 17.0555 5.03226 16.7329 5.03226 16.7329C4.12903 16.0877 5.06452 16.0877 5.06452 16.0877C6.06452 16.12 6.6129 17.12 6.6129 17.12C7.48387 18.6684 8.96774 18.2168 9.51613 17.9264C9.6129 17.2813 9.87097 16.8297 10.1613 16.5716C7.96774 16.3458 5.6129 15.4748 5.6129 11.6684C5.6129 10.5716 6.03226 9.70064 6.64516 9.02322C6.54839 8.79741 6.19355 7.76515 6.74194 6.37806C6.74194 6.37806 7.6129 6.11999 9.51613 7.41031C10.3226 7.18451 11.1613 7.05548 12.0323 7.05548C12.9032 7.05548 13.7742 7.15225 14.5484 7.41031C16.4516 6.15225 17.2903 6.37806 17.2903 6.37806C17.8387 7.73289 17.5161 8.79741 17.3871 9.02322C18.0323 9.70064 18.4194 10.6039 18.4194 11.6684C18.4194 15.4748 16.0645 16.3458 13.871 16.5716C14.2258 16.8942 14.5484 17.5393 14.5484 18.4426C14.5484 19.7974 14.5161 20.8619 14.5161 21.1845C14.5161 21.4426 14.7097 21.7329 15.1935 21.6361C19.129 20.3135 22 16.6039 22 12.1845C21.9677 6.70064 17.4839 2.24902 12 2.24902Z"
        fill="#ffffff"
      />
    </svg>
  );
}

export function Azure(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 448 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fill="#ffffff"
        d="M0 32h214.6v214.6H0V32zm233.4 0H448v214.6H233.4V32zM0 265.4h214.6V480H0V265.4zm233.4 0H448V480H233.4V265.4z"
      />
    </svg>
  );
}

// --- Login Page Component ---
export default function LoginPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (router.isReady) {
      const errorQuery = router.query.error;
      if (typeof errorQuery === "string") {
        const decodedError = decodeURIComponent(errorQuery.replace(/\+/g, " "));
        console.log("Login page received error query:", decodedError);
        setErrorMessage(decodedError);
        const { pathname, query } = router;
        delete query.error;
        router.replace({ pathname, query }, undefined, { shallow: true });
      }
    }
  }, [router.isReady, router.query.error, router]);

  const getRedirectPathFromQuery = (): string => {
    const nextPath = router.query.next;
    if (typeof nextPath === "string" && nextPath.startsWith("/")) {
      return nextPath;
    }
    return "/";
  };

  const handleOAuthLogin = async (provider: Provider) => {
    setIsLoading(true);
    setErrorMessage(null);
    const redirectURL = window.location.origin + "/api/auth/callback";

    const redirectPath = getRedirectPathFromQuery();
    if (redirectPath && redirectPath !== "/") {
      Cookies.set("supabase-redirect-path", redirectPath, {
        path: "/",
        expires: 1 / 288,
      });
      console.log("Stored redirect path in cookie:", redirectPath);
    } else {
      Cookies.remove("supabase-redirect-path", { path: "/" });
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo: redirectURL },
    });

    if (error) {
      console.error(`Error initiating login with ${provider}:`, error.message);
      setErrorMessage(
        `Failed to start login with ${provider}: ${error.message}. Please try again.`,
      );
      Cookies.remove("supabase-redirect-path", { path: "/" });
      setIsLoading(false);
    } else {
      console.log(`Redirecting to ${provider} for authentication...`);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const cookieRedirectPath = Cookies.get("supabase-redirect-path");
        const finalRedirectUrl = cookieRedirectPath || "/";
        Cookies.remove("supabase-redirect-path", { path: "/" });
        console.log(
          "User already logged in (useEffect check), redirecting to:",
          finalRedirectUrl,
        );
        router.replace(finalRedirectUrl);
      }
    };
    checkSession();
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event: string, session: Session | null) => {
        if (event === "SIGNED_IN" && session) {
          const cookieRedirectPath = Cookies.get("supabase-redirect-path");
          const finalRedirectUrl = cookieRedirectPath || "/";
          Cookies.remove("supabase-redirect-path", { path: "/" });
          console.log(
            "Auth state changed to SIGNED_IN (listener), redirecting to:",
            finalRedirectUrl,
          );
          router.replace(finalRedirectUrl);
        } else if (event === "SIGNED_OUT") {
          console.log("Auth state changed to SIGNED_OUT (listener)");
        }
      },
    );
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, router]);

  return (
    <div className={`relative min-h-screen`}>
      <GradientBackground />
      <div className="relative z-10 grid min-h-screen place-items-center p-4">
        <div className="w-full max-w-md space-y-6 rounded-xl border border-white/20 bg-white/10 p-8 shadow-lg backdrop-blur-lg">
          <div className="space-y-2 text-center text-white">
            <h1 className="text-3xl font-bold tracking-tight">Sign In</h1>
            <p className="text-md text-gray-300">
              Choose your preferred provider to continue
            </p>
          </div>

          {errorMessage && (
            <div className="rounded-md border border-red-500/60 bg-red-950/50 p-4 text-center text-sm text-red-200 flex items-center justify-center gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Google Button */}
            <button
              type="button"
              onClick={() => handleOAuthLogin("google")}
              disabled={isLoading}
              className="w-full rounded-full border border-solid border-white/[.3] transition-colors flex items-center justify-center gap-3 hover:bg-white/[.1] hover:border-white/[.5] font-medium text-base h-12 px-5 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Google className="size-5" />
              <span>{isLoading ? "Processing..." : "Sign in with Google"}</span>
            </button>

            {/* GitHub Button */}
            <button
              type="button"
              onClick={() => handleOAuthLogin("github")}
              disabled={isLoading}
              className="w-full rounded-full border border-solid border-white/[.3] transition-colors flex items-center justify-center gap-3 hover:bg-white/[.1] hover:border-white/[.5] font-medium text-base h-12 px-5 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Github className="size-5" />
              <span>{isLoading ? "Processing..." : "Sign in with GitHub"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuthLogin("azure")}
              disabled={isLoading}
              className="w-full rounded-full border border-solid border-white/[.3] transition-colors flex items-center justify-center gap-3 hover:bg-white/[.1] hover:border-white/[.5] font-medium text-base h-12 px-5 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Azure className="size-5" />
              <span>{isLoading ? "Processing..." : "Sign in with Azure"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
