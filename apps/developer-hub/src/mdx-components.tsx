import { InfoBox } from "@pythnetwork/component-library/InfoBox";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Tabs,
    Tab,
    ...components,
    InfoBox: InfoBox,
    // Fuma has a Callout component in `defaultMdxComponents` which we still want to overwrite
    Callout: InfoBox,
  };
}
