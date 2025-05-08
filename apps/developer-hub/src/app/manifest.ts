import type { MetadataRoute } from "next";

import { metadata, viewport } from "../metadata";

const manifest = (): MetadataRoute.Manifest => ({
  name: metadata.applicationName,
  short_name: metadata.applicationName,
  description: metadata.description,
  theme_color: viewport.themeColor,
  background_color: viewport.themeColor,
  icons: [
    {
      src: "/android-chrome-192x192.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      src: "/android-chrome-512x512.png",
      sizes: "512x512",
      type: "image/png",
    },
  ],
  display: "standalone",
});
export default manifest;
