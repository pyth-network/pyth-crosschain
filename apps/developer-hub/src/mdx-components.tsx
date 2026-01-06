import { InfoBox } from "@pythnetwork/component-library/InfoBox";
import { createAPIPage } from "fumadocs-openapi/ui";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

import { APICard, APICards } from "./components/APICard";
import { YouTubeEmbed } from "./components/YouTubeEmbed";
import { openapi } from "./lib/openapi";

const APIPage = createAPIPage(openapi);

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    APIPage,
    APICard,
    APICards,
    Tabs,
    Tab,
    ...components,
    InfoBox: InfoBox,
    YouTubeEmbed,
  };
}
