// src/lib/supabase/server.ts
import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import type {
  GetServerSidePropsContext,
  NextApiRequest,
  NextApiResponse,
} from "next";

// Define cookie options specifically for development vs production
const cookieOptions = {
  // In development on HTTP, Secure must be false.
  // In production on HTTPS, Secure should be true (default usually works).
  secure: process.env.NODE_ENV === "production",
  // HttpOnly should generally be true for auth-related cookies.
  httpOnly: true,
  // Optional: Set sameSite if needed, 'lax' is common
  sameSite: "lax" as const, // Use 'as const' for type correctness
  // Optional: Set path if needed, default '/' is usually fine
  // path: '/',
};

export function createSupabaseServerClient(context: GetServerSidePropsContext) {
  console.log(
    "[createSupabaseServerClient] Using cookie options:",
    cookieOptions,
  ); // Add log
  return createPagesServerClient(context, {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  });
}

export function createSupabaseRouteHandlerClient(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log(
    "[createSupabaseRouteHandlerClient] Using cookie options:",
    cookieOptions,
  ); // Add log
  return createPagesServerClient(
    { req, res },
    {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
  );
}
