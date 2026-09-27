import type { Metadata } from "next";
import ViewComponent from "@/views/maintenance";

export const metadata: Metadata = {
  title: "Maintenance",
};

export default function Page() {
  return <ViewComponent />;
}
