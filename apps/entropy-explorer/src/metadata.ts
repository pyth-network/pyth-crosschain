import type { Metadata, Viewport } from "next";

export const metadata = {
  metadataBase: new URL("https://entropy-explorer.pyth.network"),
  title: {
    default: "Pyth Network Entropy Explorer",
    template: "%s | Pyth Network Entropy Explorer",
  },
  applicationName: "Pyth Network Entropy Explorer",
  description:
    "Explore interactions with the Pyth Network Entropy on-chain random number generator.",
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
} satisfies Metadata;

export const viewport = {
  themeColor: "#242235",
} satisfies Viewport;
