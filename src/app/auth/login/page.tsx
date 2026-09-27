import type { Metadata } from "next";
import { Suspense } from "react";
import ViewComponent from "@/views/login";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ViewComponent />
    </Suspense>
  );
}
