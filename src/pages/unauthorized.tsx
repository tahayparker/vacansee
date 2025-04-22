// src/pages/unauthorized.tsx
// No longer needs useState or useEffect for verification
import GradientBackground from '@/components/GradientBackground';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/router';
import { LogOut, AlertTriangle } from 'lucide-react'; // Added AlertTriangle
import { useState } from 'react';

export default function UnauthorizedPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  // Removed isLoading and isVerifiedUnauthorized states

  // Removed the entire useEffect hook for verification

  const handleSignOut = async () => {
    // Keep the existing sign out logic
    setIsLoading(true); // Optional: Add loading state for sign out action
    console.log("Signing out...");
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Error signing out:", error);
        // Maybe show an error message to the user here?
        setIsLoading(false);
    } else {
        console.log("Sign out successful, redirecting to /");
        router.push('/'); // Redirect to home page after sign out
    }
  };

  // Optional loading state for sign out button
  const [isSignOutLoading, setIsLoading] = useState(false);

  // --- Render Static Content ---
  return (
    <div className="relative min-h-screen">
      <GradientBackground />
      <div className="relative z-10 grid min-h-screen place-items-center p-4 text-center text-white">
        {/* --- Display Static "Signups Disabled" Message --- */}
        <div className="space-y-8 rounded-xl border border-red-500/60 bg-red-950/30 p-8 shadow-lg backdrop-blur-md max-w-lg">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
            <h1 className="text-3xl font-bold tracking-tight text-red-200">Unauthorized Access</h1>
            <p className="text-md text-red-100/90">
                Your account is not authorized to acccess vacansee.
            </p>
            <p className="text-sm text-red-100/80">
                If you have been given access, please try using the account you signed up with.
                <br/><br/>
                If you believe this is an error, please contact the administrator for assistance.
            </p>
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleSignOut}
                disabled={isSignOutLoading} // Disable while signing out
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
    </div>
  );
}