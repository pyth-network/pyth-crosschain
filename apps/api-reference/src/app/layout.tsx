import type { Metadata, Viewport } from "next";

import "../tailwind.css";

export { Root as default } from "../components/Root";

export const metadata: Metadata = {
  metadataBase: new URL("https://api-reference.pyth.network"),
  title: {
    default: "Pyth Network API Reference",
    template: "%s | Pyth Network API Reference",
  },
  applicationName: "Pyth Network API Reference",
  description:
    "API reference, interactive explorer, and documentation for Pyth network products.",
  referrer: "strict-origin-when-cross-origin",
  openGraph: {
    type: "website",
  },
  twitter: {
    creator: "@PythNetwork",
    card: "summary_large_image",
  },
  icons: {
    icon: [
      {
        media: "(prefers-color-scheme: light)",
        type: "image/x-icon",
        url: "/favicon.ico",
      },
      {
        media: "(prefers-color-scheme: dark)",
        type: "image/x-icon",
        url: "/favicon-light.ico",
      },
      {
        type: "image/png",
        sizes: "32x32",
        url: "/favicon-32x32.png",
      },
      {
        type: "image/png",
        sizes: "16x16",
        url: "/favicon-16x16.png",
      },
    ],
    apple: {
      url: "/apple-touch-icon.png",
      sizes: "180x180",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#242235",
};
