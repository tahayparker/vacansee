import type { Metadata } from "next";
import ViewComponent from "@/views/available-now";

export const metadata: Metadata = {
  title: "Available Now",
};

export default function Page() {
  return <ViewComponent />;
}
