import type { MetadataRoute } from "next";

import { IS_PRODUCTION_SERVER } from "../config/server";

const robots = (): MetadataRoute.Robots => ({
  rules: IS_PRODUCTION_SERVER
    ? {
        allow: "/",
        disallow: ["/pyth-feeds-demo"],
        userAgent: "*",
      }
    : {
        disallow: "/",
        userAgent: "*",
      },
});
export default robots;
