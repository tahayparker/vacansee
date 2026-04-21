// src/lib/supabase/server.ts
//
// Wrappers around @supabase/ssr for the Pages Router.
// Public signatures preserved so downstream imports did not need to change
// when migrating off @supabase/auth-helpers-nextjs.

import { createServerClient, serializeCookieHeader } from "@supabase/ssr";
import type {
  GetServerSidePropsContext,
  NextApiRequest,
  NextApiResponse,
} from "next";

function makeClient(req: NextApiRequest, res: NextApiResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.entries(req.cookies ?? {}).map(([name, value]) => ({
            name,
            value: value ?? "",
          }));
        },
        setAll(cookiesToSet) {
          res.setHeader(
            "Set-Cookie",
            cookiesToSet.map(({ name, value, options }) =>
              serializeCookieHeader(name, value, options),
            ),
          );
        },
      },
    },
  );
}

export function createSupabaseServerClient(context: GetServerSidePropsContext) {
  return makeClient(
    context.req as unknown as NextApiRequest,
    context.res as unknown as NextApiResponse,
  );
}

export function createSupabaseRouteHandlerClient(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  return makeClient(req, res);
}
