import type { AdvancedIndex } from "fumadocs-core/search/server";
import { createSearchAPI } from "fumadocs-core/search/server";

import { source } from "../../../lib/source";

export const { GET } = createSearchAPI("advanced", {
  indexes: () => {
    return source.getPages().map((page) => ({
      title: page.data.title,
      description: page.data.description,
      url: page.url,
      id: page.url,
      structuredData: page.data.structuredData,
    })) as AdvancedIndex[];
  },
});
