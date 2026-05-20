"use client";

import {
  parseAsStringLiteral,
  useQueryState,
} from "@pythnetwork/react-hooks/nuqs";

export const MIGRATION_PATHS = ["now", "wait"] as const;
export type MigrationPath = (typeof MIGRATION_PATHS)[number];

export const useMigrationPath = () =>
  useQueryState(
    "path",
    parseAsStringLiteral(MIGRATION_PATHS).withDefault("now"),
  );
