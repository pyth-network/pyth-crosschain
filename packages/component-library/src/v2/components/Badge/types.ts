import type { ThemeState } from "../../theme";

export const BadgeStyles = ["filled", "outline"] as const;
export const BadgeSizes = ["xs", "md", "lg"] as const;

export type BadgeStyle = (typeof BadgeStyles)[number];
export type BadgeSize = (typeof BadgeSizes)[number];
export type BadgeVariant = ThemeState;
