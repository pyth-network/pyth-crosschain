import {
  CardsThree,
  ChartLine,
  FolderSimpleDashed,
  Gavel,
  Lightning,
  Shuffle,
} from "@phosphor-icons/react/dist/ssr";
import type { InferMetaType, InferPageType } from "fumadocs-core/source";
import { loader } from "fumadocs-core/source";
import { createElement } from "react";

import { docs } from "../.source";

const icons: Record<string, React.ComponentType> = {
  CardsThree,
  ChartLine,
  Gavel,
  Lightning,
  Shuffle,
};

export const source = loader({
  baseUrl: "/",
  icon(icon) {
    return icon ? createElement(icons[icon] ?? FolderSimpleDashed) : undefined;
  },
  source: docs.toFumadocsSource(),
});

export type Page = InferPageType<typeof source>;
export type Meta = InferMetaType<typeof source>;
