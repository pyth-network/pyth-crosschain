import type { MetadataRoute } from "next";

import { IS_PRODUCTION_SERVER } from "../server-config";

const robots = (): MetadataRoute.Robots => ({
  rules: {
    userAgent: "*",
    ...(IS_PRODUCTION_SERVER ? { allow: "/" } : { disallow: "/" }),
  },
});
export default robots;
