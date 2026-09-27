import type { Metadata } from "next";
import { Suspense } from "react";
import ViewComponent from "@/views/unauthorized";

export const metadata: Metadata = {
  title: "Unauthorized",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ViewComponent />
    </Suspense>
  );
}
