// pages/_document.tsx
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <link rel="icon" href="/favicon.ico" />
      <link rel="manifest" href="/manifest.json" />
      <body style={{ backgroundColor: "#0a0a0a" }}>
        {" "}
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
