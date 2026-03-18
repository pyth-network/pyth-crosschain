import type { MetadataRoute } from "next";

import { metadata, viewport } from "../metadata";

const manifest = (): MetadataRoute.Manifest => ({
  background_color: viewport.themeColor,
  description: metadata.description,
  display: "standalone",
  icons: [
    {
      sizes: "192x192",
      src: "/android-chrome-192x192.png",
      type: "image/png",
    },
    {
      sizes: "512x512",
      src: "/android-chrome-512x512.png",
      type: "image/png",
    },
  ],
  name: metadata.applicationName,
  short_name: metadata.applicationName,
  theme_color: viewport.themeColor,
});
export default manifest;
