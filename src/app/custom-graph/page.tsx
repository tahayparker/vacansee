import type { Metadata } from "next";
import ViewComponent from "@/views/custom-graph";

export const metadata: Metadata = {
  title: "Custom Schedule",
};

export default function Page() {
  return <ViewComponent />;
}
