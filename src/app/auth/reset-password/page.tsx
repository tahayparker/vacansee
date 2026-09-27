import type { Metadata } from "next";
import { Suspense } from "react";
import ViewComponent from "@/views/reset-password";

export const metadata: Metadata = {
  title: "Reset Password",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ViewComponent />
    </Suspense>
  );
}
