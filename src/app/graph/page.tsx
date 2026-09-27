import type { Metadata } from "next";
import ViewComponent from "@/views/graph";

export const metadata: Metadata = {
  title: "Schedule Graph",
};

export default function Page() {
  return <ViewComponent />;
}
