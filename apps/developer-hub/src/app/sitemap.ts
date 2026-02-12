import type { MetadataRoute } from "next";

import { source } from "../lib/source";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://docs.pyth.network";

  const docPages = source.getPages().map((page) => ({
    changeFrequency: "weekly" as const,
    lastModified: new Date(),
    url: `${baseUrl}${page.url}`,
  }));

  const llmPages = [
    { changeFrequency: "monthly" as const, url: `${baseUrl}/llms.txt` },
    {
      changeFrequency: "weekly" as const,
      url: `${baseUrl}/llms-price-feeds-core.txt`,
    },
    {
      changeFrequency: "weekly" as const,
      url: `${baseUrl}/llms-price-feeds-pro.txt`,
    },
    {
      changeFrequency: "weekly" as const,
      url: `${baseUrl}/llms-entropy.txt`,
    },
    {
      changeFrequency: "monthly" as const,
      url: `${baseUrl}/llms-price-feeds.txt`,
    },
    {
      changeFrequency: "weekly" as const,
      url: `${baseUrl}/llms-manifest.json`,
    },
    { changeFrequency: "monthly" as const, url: `${baseUrl}/SKILL.md` },
  ].map((p) => ({ ...p, lastModified: new Date() }));

  return [...docPages, ...llmPages];
}
