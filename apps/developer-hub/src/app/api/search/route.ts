import { source } from "@/src/source";
import { createFromSource } from "fumadocs-core/search/server";

export const { GET } = createFromSource(source);
