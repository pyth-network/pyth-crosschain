import type { Metadata, Viewport } from "next";

export const metadata = {
  applicationName: "Pyth Network API Reference",
  description:
    "API reference, interactive explorer, and documentation for Pyth network products.",
  icons: {
    apple: {
      sizes: "180x180",
      url: "/apple-touch-icon.png",
    },
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
        sizes: "32x32",
        type: "image/png",
        url: "/favicon-32x32.png",
      },
      {
        sizes: "16x16",
        type: "image/png",
        url: "/favicon-16x16.png",
      },
    ],
  },
  metadataBase: new URL("https://api-reference.pyth.network"),
  openGraph: {
    type: "website",
  },
  referrer: "strict-origin-when-cross-origin",
  title: {
    default: "Pyth Network API Reference",
    template: "%s | Pyth Network API Reference",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@PythNetwork",
  },
} satisfies Metadata;

export const viewport = {
  themeColor: "#242235",
} satisfies Viewport;
