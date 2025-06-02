// next.config.mjs (or next.config.ts)
import { NextConfig } from "next"; // Import type if using TypeScript

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Use NextConfig type
  reactStrictMode: true,
  // Add other configurations if you have them

  async redirects() {
    return [
      // --- Redirects for "/available-now" ---
      {
        source: "/CurrentlyAvailable",
        destination: "/available-now",
        permanent: true,
      },
      {
        source: "/availablenow",
        destination: "/available-now",
        permanent: true,
      },
      {
        source: "/AvailableNow",
        destination: "/available-now",
        permanent: true,
      },
      {
        source: "/currentlyavailable",
        destination: "/available-now",
        permanent: true,
      },
      { source: "/available", destination: "/available-now", permanent: true }, // Common shortening
      { source: "/now", destination: "/available-now", permanent: true }, // Common shortening

      // --- Redirects for "/check" ---
      { source: "/CheckAvailability", destination: "/check", permanent: true },
      { source: "/checkAvailability", destination: "/check", permanent: true }, // camelCase
      { source: "/checkavailability", destination: "/check", permanent: true },
      { source: "/check-availability", destination: "/check", permanent: true },
      { source: "/availability", destination: "/check", permanent: true }, // Could redirect here too
      { source: "/search", destination: "/check", permanent: true }, // Based on icon

      // --- Redirects for "/rooms" ---
      { source: "/RoomDetails", destination: "/rooms", permanent: true },
      { source: "/roomdetails", destination: "/rooms", permanent: true },
      { source: "/details", destination: "/rooms", permanent: true }, // Common shortening
      { source: "/deets", destination: "/rooms", permanent: true }, // Possible alternative
      { source: "/room", destination: "/rooms", permanent: true }, // Singular to plural

      // --- Redirects for "/graph" (Optional additions) ---
      { source: "/GraphPage", destination: "/graph", permanent: true }, // From old example maybe
      { source: "/graphs", destination: "/graph", permanent: true }, // Plural to singular

      // --- Redirects for "/available-soon" (Optional additions) ---
      {
        source: "/AvailableSoon",
        destination: "/available-soon",
        permanent: true,
      },
      {
        source: "/availablesoon",
        destination: "/available-soon",
        permanent: true,
      },
      { source: "/soon", destination: "/available-soon", permanent: true },

      // --- Redirect for root variations (Optional but good) ---
      { source: "/home", destination: "/", permanent: true },
      { source: "/index", destination: "/", permanent: true },
      { source: "/test", destination: "/", permanent: true },

      // Add more redirects as needed following this pattern
    ];
  },
};

// Use default export for .mjs or .ts
export default nextConfig;
