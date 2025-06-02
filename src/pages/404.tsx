// pages/404.tsx
import Link from "next/link";
import React from "react";
import { AlertTriangle } from "lucide-react";

export default function Custom404() {
  // Return only the content container. Centering handled by <main> in _app.tsx
  // Added py-10 for vertical spacing
  return (
    <div className="space-y-4 text-center py-10">
      {" "}
      {/* Removed all flex/grow/h-full properties */}
      <AlertTriangle className="mx-auto h-16 w-16 text-yellow-500" />
      <h1 className="text-4xl sm:text-5xl font-bold text-white/90">
        Error 404
      </h1>
      <p className="text-lg text-white/70">
        Oops! The page you&apos;re looking for could not be found.
      </p>
      <Link
        href="/"
        className="inline-block mt-6 px-6 py-2 rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-colors"
      >
        Go back home
      </Link>
    </div>
  );
}
