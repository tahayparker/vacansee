// pages/500.tsx
import Link from "next/link";
import React from "react";
import { BadgeAlert } from "lucide-react";

export default function Custom500() {
  // Return only the content container. Centering handled by <main> in _app.tsx
  return (
    <div className="space-y-4 text-center">
      {" "}
      <BadgeAlert className="mx-auto h-16 w-16 text-red-500" />
      <h1 className="text-4xl sm:text-5xl font-bold text-white/90">
        Error 500
      </h1>
      <p className="text-lg text-white/70">
        Oops! Something went wrong on our end.
      </p>
      <Link
        href="/"
        className="inline-block mt-6 px-6 py-2 rounded-full bg-purple-500 text-white hover:bg-purple-500 transition-colors"
      >
        Go back home
      </Link>
    </div>
  );
}
