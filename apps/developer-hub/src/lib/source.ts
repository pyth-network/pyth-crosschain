import {
  ArrowsClockwise,
  Book,
  Bug,
  CardsThree,
  ChartLine,
  Code,
  CurrencyDollar,
  DiceSix,
  FileText,
  FolderSimpleDashed,
  Gauge,
  Gavel,
  Lightning,
  MagnifyingGlass,
  RocketLaunch,
  Shield,
  ShieldCheck,
  Shuffle,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { InferMetaType, InferPageType } from "fumadocs-core/source";
import { loader } from "fumadocs-core/source";
import { openapiPlugin } from "fumadocs-openapi/server";
import { createElement } from "react";

import { docs } from "../../.source/server";

const icons: Record<string, React.ComponentType> = {
  ArrowsClockwise,
  Book,
  Bug,
  CardsThree,
  ChartLine,
  Code,
  CurrencyDollar,
  DiceSix,
  FileText,
  Gauge,
  Gavel,
  Lightning,
  MagnifyingGlass,
  RocketLaunch,
  Shield,
  ShieldCheck,
  Shuffle,
  Sparkle,
  WarningCircle,
};

export const source = loader({
  baseUrl: "/",
  icon(icon) {
    return icon ? createElement(icons[icon] ?? FolderSimpleDashed) : undefined;
  },
  plugins: [openapiPlugin()],
  source: docs.toFumadocsSource(),
});

export type Page = InferPageType<typeof source>;
export type Meta = InferMetaType<typeof source>;
