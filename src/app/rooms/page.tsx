import type { Metadata } from "next";
import ViewComponent from "@/views/rooms";

export const metadata: Metadata = {
  title: "Rooms",
};

export default function Page() {
  return <ViewComponent />;
}
