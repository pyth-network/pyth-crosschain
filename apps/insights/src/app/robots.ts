import type { MetadataRoute } from "next";

import { IS_PRODUCTION_SERVER } from "../config/server";

const robots = (): MetadataRoute.Robots => ({
  rules: IS_PRODUCTION_SERVER
    ? {
        userAgent: "*",
        allow: "/",
        disallow: ["/pyth-feeds-demo"],
      }
    : {
        userAgent: "*",
        disallow: "/",
      },
});
export default robots;
