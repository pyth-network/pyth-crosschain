import { InfoBox } from "@pythnetwork/component-library/InfoBox";
import { createAPIPage } from "fumadocs-openapi/ui";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { ImgHTMLAttributes } from "react";

import { APICard, APICards } from "./components/APICard";
import { BinaryFormatCards } from "./components/BinaryFormatCards";
import { FieldCodePanel } from "./components/FieldCodePanel";
import { PropertyCard } from "./components/PropertyCard";
import { PropertyFieldLinker } from "./components/PropertyFieldLinker";
import { YouTubeEmbed } from "./components/YouTubeEmbed";
import { openapi } from "./lib/openapi";

const OpenAPIPage = createAPIPage(openapi);
const { img: FumadocsImage, ...defaultMdxComponentsWithoutImage } =
  defaultMdxComponents;

function Image(props: ImgHTMLAttributes<HTMLImageElement>) {
  const { sizes, ...rest } = props;

  return sizes === undefined ? (
    <FumadocsImage {...rest} />
  ) : (
    <FumadocsImage {...rest} sizes={sizes} />
  );
}

const overridableMdxComponents = {
  APICard,
  APICards,
  APIPage: OpenAPIPage,
  Tab,
  Tabs,
} satisfies MDXComponents;

const requiredMdxComponents = {
  BinaryFormatCards,
  FieldCodePanel,
  InfoBox: InfoBox,
  PropertyCard,
  PropertyFieldLinker,
  YouTubeEmbed,
} satisfies MDXComponents;

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponentsWithoutImage,
    img: Image,
    ...overridableMdxComponents,
    ...components,
    ...requiredMdxComponents,
  };
}
