// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  server: {
    port: 3004,
  },
  vite: {
    define: {
      // TODO: This is a HACK and should be removed.
      // this is necessary due to our component library being tightly-couple
      // to next.js and importing things from it 😭
      'process.env.NODE_ENV': '"development"',
    },
  },
});
