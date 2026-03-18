import type { Metadata, Viewport } from "next";

export const metadata = {
  applicationName: "Pyth Network Insights",
  description:
    "Learn more about the Pyth network and explore data about the network's publishers and price feeds.",
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
  metadataBase: new URL("https://insights.pyth.network"),
  openGraph: {
    type: "website",
  },
  referrer: "strict-origin-when-cross-origin",
  title: {
    default: "Pyth Network Insights",
    template: "%s | Pyth Network Insights",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@PythNetwork",
  },
} satisfies Metadata;

export const viewport = {
  themeColor: "#242235",
} satisfies Viewport;
