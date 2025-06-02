// pages/_document.tsx
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      {/* Apply inline style for initial dark background */}
      <body style={{ backgroundColor: "#0a0a0a" }}>
        {" "}
        {/* Use your dark theme's background hex */}
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
