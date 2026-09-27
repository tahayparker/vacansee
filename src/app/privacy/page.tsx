import type { Metadata } from "next";
import ViewComponent from "@/views/privacy";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function Page() {
  return <ViewComponent />;
}
