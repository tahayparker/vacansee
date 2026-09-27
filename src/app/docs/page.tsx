import type { Metadata } from "next";
import ViewComponent from "@/views/docs";

export const metadata: Metadata = {
  title: "Documentation",
};

export default function Page() {
  return <ViewComponent />;
}
