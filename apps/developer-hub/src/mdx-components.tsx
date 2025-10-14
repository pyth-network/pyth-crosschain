import { InfoBox } from "@pythnetwork/component-library/InfoBox";
import type { ApiPageProps } from "fumadocs-openapi/ui";
import { APIPage } from "fumadocs-openapi/ui";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

import { openapi } from "./lib/openapi";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    APIPage: (props: ApiPageProps) => (
      <APIPage {...openapi.getAPIPageProps(props)} />
    ),
    Tabs,
    Tab,
    ...components,
    InfoBox: InfoBox,
  };
}
