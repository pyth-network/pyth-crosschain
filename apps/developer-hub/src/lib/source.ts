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
import { transformerOpenAPI } from "fumadocs-openapi/server";
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
    // types are very similar but not exactly the same
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    transformers: [transformerOpenAPI()],
  },
});

export type Page = InferPageType<typeof source>;
export type Meta = InferMetaType<typeof source>;
