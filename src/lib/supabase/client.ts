import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";

// Use ReturnType to correctly infer the client type
let browserClient: ReturnType<typeof createPagesBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  // Check if the client already exists.
  if (!browserClient) {
    browserClient = createPagesBrowserClient();
  }
  return browserClient;
}
