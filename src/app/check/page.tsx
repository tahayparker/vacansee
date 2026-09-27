import type { Metadata } from "next";
import ViewComponent from "@/views/check";

export const metadata: Metadata = {
  title: "Check Availability",
};

export default function Page() {
  return <ViewComponent />;
}
