import type { Metadata } from "next";
import ViewComponent from "@/views/legal";

export const metadata: Metadata = {
  title: "Legal",
};

export default function Page() {
  return <ViewComponent />;
}
