import type { Metadata } from "next";
import ViewComponent from "@/views/profile";

export const metadata: Metadata = {
  title: "Profile",
};

export default function Page() {
  return <ViewComponent />;
}
