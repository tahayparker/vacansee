import type { Metadata } from "next";
import ViewComponent from "@/views/available-soon";

export const metadata: Metadata = {
  title: "Available Soon",
};

export default function Page() {
  return <ViewComponent />;
}
