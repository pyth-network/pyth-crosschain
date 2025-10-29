import {
  CardsThree,
  ChartLine,
  FolderSimpleDashed,
  Gavel,
  Lightning,
  Shuffle,
  DiceSix,
  Sparkle,
  RocketLaunch,
  FileText,
  MagnifyingGlass,
  Shield,
  Gauge,
  Bug,
  ShieldCheck,
  ArrowsClockwise,
  WarningCircle,
  Code,
  Book,
  CurrencyDollar,
} from "@phosphor-icons/react/dist/ssr";
import type { InferMetaType, InferPageType } from "fumadocs-core/source";
import { loader } from "fumadocs-core/source";
import { openapiPlugin } from "fumadocs-openapi/server";
import { createElement } from "react";

import { docs } from "../../.source";

const icons: Record<string, React.ComponentType> = {
  CardsThree,
  ChartLine,
  Gavel,
  Lightning,
  Shuffle,
  DiceSix,
  Sparkle,
  RocketLaunch,
  FileText,
  MagnifyingGlass,
  Shield,
  Gauge,
  Bug,
  ShieldCheck,
  ArrowsClockwise,
  WarningCircle,
  Code,
  Book,
  CurrencyDollar,
};

export const source = loader({
  baseUrl: "/",
  icon(icon) {
    return icon ? createElement(icons[icon] ?? FolderSimpleDashed) : undefined;
  },
  source: docs.toFumadocsSource(),
  pageTree: {
    // @ts-expect-error - types are very similar but not exactly the same
    transformers: [openapiPlugin()],
  },
});

export type Page = InferPageType<typeof source>;
export type Meta = InferMetaType<typeof source>;
