import type { Metadata } from "next";
import { Suspense } from "react";
import ViewComponent from "@/views/sso";

export const metadata: Metadata = {
  title: "Authenticating...",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ViewComponent />
    </Suspense>
  );
}
