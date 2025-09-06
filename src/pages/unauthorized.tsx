// src/pages/unauthorized.tsx
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/router";
import { LogOut, OctagonMinus } from "lucide-react";
import { useState } from "react";

export default function UnauthorizedPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [isSignOutLoading, setIsSignOutLoading] = useState(false);

  const handleSignOut = async () => {
    setIsSignOutLoading(true);
    console.log("Signing out...");
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
      setIsSignOutLoading(false);
    } else {
      console.log("Sign out successful, redirecting to /");
      router.push("/");
    }
  };

  return (
    <div className="relative text-center max-w-2xl py-10">
      {/* Background Glow */}
      <div className="absolute inset-0 -z-10 overflow-visible">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-red-600/20 rounded-full blur-[120px]" />
      </div>

      {/* Content */}
      <div className="space-y-8 rounded-xl border border-red-500/60 bg-red-950/25 p-8 shadow-lg backdrop-blur-lg">
        <OctagonMinus className="mx-auto h-12 w-12 text-red-400" />
        <h1 className="text-3xl font-bold tracking-tight text-red-200">
          Unauthorized Access
        </h1>
        <p className="text-md text-red-100/90">
          Your account is not authorized to access vacansee.
        </p>
        <p className="text-sm text-red-100/90">
          If you have been given access, please try using the account you
          signed up with.
          <br />
          <br />
          If you believe this is an error, please contact the administrator
          for assistance.
          <br />
          <br />
          Please click the button below to go home. Your account will be signed out.
        </p>
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={handleSignOut}
            disabled={isSignOutLoading}
            className="rounded-full border-white/40 bg-transparent px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-white/10 hover:border-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 flex items-center gap-2 disabled:opacity-60"
          >
            {isSignOutLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}
