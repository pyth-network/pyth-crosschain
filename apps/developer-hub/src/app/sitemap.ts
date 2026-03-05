import type { MetadataRoute } from "next";

import { LLM_FILES } from "../data/llm-files";
import { source } from "../lib/source";

const BUILD_DATE = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://docs.pyth.network";

  const docPages = source.getPages().map((page) => ({
    changeFrequency: "weekly" as const,
    lastModified: BUILD_DATE,
    url: `${baseUrl}${page.url}`,
  }));

  const llmPages = LLM_FILES.filter((f) => !f.deprecated).map((f) => ({
    changeFrequency: f.changeFrequency,
    lastModified: BUILD_DATE,
    url: `${baseUrl}${f.path}`,
  }));

  const manifestPage = {
    changeFrequency: "weekly" as const,
    lastModified: BUILD_DATE,
    url: `${baseUrl}/llms-manifest.json`,
  };

  return [...docPages, ...llmPages, manifestPage];
}
