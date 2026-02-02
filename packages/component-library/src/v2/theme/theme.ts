import { omitKeys } from "@pythnetwork/shared-lib/util";
import Color from "color";
import type { SimpleStyleRules } from "simplestyle-js/ssr";

/** util functions */
const spacing = (increment: number) => `${(increment * 0.25).toString()}rem`;
const lightDark = (light: string, dark: string) =>
  `light-dark(${light}, ${dark})`;
/**
 * Normalize theme color tokens to a CSS-ready value.
 * Use this in createStyles callbacks to handle light/dark tokens consistently.
 */
const resolveThemeColor = (
  value:
    | string
    | {
        light: string;
        dark: string;
      },
  flip = false,
) =>
  typeof value === "string"
    ? value
    : lightDark(
        flip ? value.dark : value.light,
        flip ? value.light : value.dark,
      );

const breakpoints = {
  lg: "1024px",
  md: "768px",
  sm: "640px",
  xl: "1280px",
  xl2: "1536px",
} as const;

const buttonSizes = {
  lg: {
    borderRadius: "1.5rem",
    fontSize: "1.25rem",
    gap: "0.75rem",
    height: "3.5rem",
    iconSize: "1.5rem",
    padding: "1rem",
  },
  md: {
    borderRadius: "0.75rem",
    fontSize: "1rem",
    gap: "0.5rem",
    height: "3rem",
    iconSize: "1.5rem",
    padding: "0.75rem",
  },
  sm: {
    borderRadius: "0.5rem",
    fontSize: "0.875rem",
    gap: "0.5rem",
    height: "2.25rem",
    iconSize: "1.25rem",
    padding: "0.5rem",
  },
  xs: {
    borderRadius: "0.375rem",
    fontSize: "0.6875rem",
    gap: "0.25rem",
    height: "1.5rem",
    iconSize: "1rem",
    padding: "0.25rem",
  },
} as const;

const palette = {
  amber: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
    950: "#451a03",
  },
  beige: {
    50: "#f7f4f4",
    100: "#f3eded",
    200: "#e9dfdf",
    300: "#d9c8c8",
    400: "#c1a8a8",
    500: "#a98a8a",
    600: "#927070",
    700: "#795c5c",
    800: "#664e4e",
    900: "#574545",
    950: "#2d2222",
  },
  black: "#000",
  blue: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
    950: "#172554",
  },
  cyan: {
    50: "#ecfeff",
    100: "#cffafe",
    200: "#a5f3fc",
    300: "#67e8f9",
    400: "#22d3ee",
    500: "#06b6d4",
    600: "#0891b2",
    700: "#0e7490",
    800: "#155e75",
    900: "#164e63",
    950: "#083344",
  },
  emerald: {
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
    800: "#065f46",
    900: "#064e3b",
    950: "#022c22",
  },
  fuchsia: {
    50: "#fdf4ff",
    100: "#fae8ff",
    200: "#f5d0fe",
    300: "#f0abfc",
    400: "#e879f9",
    500: "#d946ef",
    600: "#c026d3",
    700: "#a21caf",
    800: "#86198f",
    900: "#701a75",
    950: "#4a044e",
  },
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
    950: "#030712",
  },
  green: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
    700: "#15803d",
    800: "#166534",
    900: "#14532d",
    950: "#052e16",
  },
  indigo: {
    50: "#eef2ff",
    100: "#e0e7ff",
    200: "#c7d2fe",
    300: "#a5b4fc",
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
    800: "#3730a3",
    900: "#312e81",
    950: "#1e1b4b",
  },
  lime: {
    50: "#f7fee7",
    100: "#ecfccb",
    200: "#d9f99d",
    300: "#bef264",
    400: "#a3e635",
    500: "#84cc16",
    600: "#65a30d",
    700: "#4d7c0f",
    800: "#3f6212",
    900: "#365314",
    950: "#1a2e05",
  },
  neutral: {
    50: "#fafafa",
    100: "#f5f5f5",
    200: "#e5e5e5",
    300: "#d4d4d4",
    400: "#a3a3a3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#171717",
    950: "#0a0a0a",
  },
  orange: {
    50: "#fff7ed",
    100: "#ffedd5",
    200: "#fed7aa",
    300: "#fdba74",
    400: "#fb923c",
    500: "#f97316",
    600: "#ea580c",
    700: "#c2410c",
    800: "#9a3412",
    900: "#7c2d12",
    950: "#431407",
  },
  pink: {
    50: "#fdf2f8",
    100: "#fce7f3",
    200: "#fbcfe8",
    300: "#f9a8d4",
    400: "#f472b6",
    500: "#ec4899",
    600: "#db2777",
    700: "#be185d",
    800: "#9d174d",
    900: "#831843",
    950: "#500724",
  },
  purple: {
    50: "#faf5ff",
    100: "#f3e8ff",
    200: "#e9d5ff",
    300: "#d8b4fe",
    400: "#c084fc",
    500: "#a855f7",
    600: "#9333ea",
    700: "#7e22ce",
    800: "#6b21a8",
    900: "#581c87",
    950: "#3b0764",
  },
  red: {
    50: "#fef2f2",
    100: "#fee2e2",
    200: "#fecaca",
    300: "#fca5a5",
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
    700: "#b91c1c",
    800: "#991b1b",
    900: "#7f1d1d",
    950: "#450a0a",
  },
  rose: {
    50: "#fff1f2",
    100: "#ffe4e6",
    200: "#fecdd3",
    300: "#fda4af",
    400: "#fb7185",
    500: "#f43f5e",
    600: "#e11d48",
    700: "#be123c",
    800: "#9f1239",
    900: "#881337",
    950: "#4c0519",
  },
  sky: {
    50: "#f0f9ff",
    100: "#e0f2fe",
    200: "#bae6fd",
    300: "#7dd3fc",
    400: "#38bdf8",
    500: "#0ea5e9",
    600: "#0284c7",
    700: "#0369a1",
    800: "#075985",
    900: "#0c4a6e",
    950: "#082f49",
  },
  slate: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e80",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#020617",
  },
  steel: {
    50: "#f8f9fc",
    100: "#f1f2f9",
    200: "#e2e3f0",
    300: "#cbcee1",
    400: "#9497b8",
    500: "#64678b",
    600: "#474a69",
    700: "#333655",
    800: "#25253e",
    900: "#27253d",
    950: "#100e23",
  },
  stone: {
    50: "#fafaf9",
    100: "#f5f5f4",
    200: "#e7e5e4",
    300: "#d6d3d1",
    400: "#a8a29e",
    500: "#78716c",
    600: "#57534e",
    700: "#44403c",
    800: "#292524",
    900: "#1c1917",
    950: "#0c0a09",
  },
  teal: {
    50: "#f0fdfa",
    100: "#ccfbf1",
    200: "#99f6e4",
    300: "#5eead4",
    400: "#2dd4bf",
    500: "#14b8a6",
    600: "#0d9488",
    700: "#0f766e",
    800: "#115e59",
    900: "#134e4a",
    950: "#042f2e",
  },
  violet: {
    50: "#f5f3ff",
    100: "#ede9fe",
    200: "#ddd6fe",
    300: "#c4b5fd",
    400: "#a78bfa",
    500: "#8b5cf6",
    600: "#7c3aed",
    700: "#6d28d9",
    800: "#5b21b6",
    900: "#4c1d95",
    950: "#2e1065",
  },
  white: "#fff",
  yellow: {
    50: "#fefce8",
    100: "#fef9c3",
    200: "#fef08a",
    300: "#fde047",
    400: "#facc15",
    500: "#eab308",
    600: "#ca8a04",
    700: "#a16207",
    800: "#854d0e",
    900: "#713f12",
    950: "#422006",
  },
  zinc: {
    50: "#fafafa",
    100: "#f4f4f5",
    200: "#e4e4e7",
    300: "#d4d4d8",
    400: "#a1a1aa",
    500: "#71717a",
    600: "#52525b",
    700: "#3f3f46",
    800: "#27272a",
    900: "#18181b",
    950: "#09090b",
  },
} as const;

const black = Color(palette.black);
const stone600 = Color(palette.stone[600]);
const violet600 = Color(palette.violet[600]);

const elevations = {
  primary: {
    2: [
      `0px 66px 18px 0px ${violet600.alpha(0).hexa()}`,
      `0px 42px 17px 0px ${violet600.alpha(0.03).hexa()}`,
      `0px 24px 14px 0px ${violet600.alpha(0.08).hexa()}`,
      `0px 11px 11px 0px ${violet600.alpha(0.14).hexa()}`,
      `0px 3px 6px 0px ${violet600.alpha(0.17).hexa()}`,
    ].join(", "),
  },
  default: {
    1: [
      `0px 4px 6px -4px ${black.alpha(0.1).hexa()}`,
      `0px 10px 15px -3px ${black.alpha(0.1).hexa()}`,
    ].join(", "),
    2: [
      `0px 29px 12px 0px ${lightDark(stone600.alpha(0.02).hexa(), black.alpha(0.08).hexa())}`,
      `0px 16px 10px 0px ${lightDark(stone600.alpha(0.06).hexa(), black.alpha(0.12).hexa())}`,
      `0px 7px 7px 0px ${lightDark(stone600.alpha(0.12).hexa(), black.alpha(0.2).hexa())}`,
      `0px 2px 4px 0px ${lightDark(stone600.alpha(0.14).hexa(), black.alpha(0.3).hexa())}`,
    ].join(", "),
  },
} as const;

const buttonOutlineColors = {
  background: {
    active: {
      dark: Color(palette.steel[50]).alpha(0.1).hexa(),
      light: Color(palette.beige[950]).alpha(0.1).hexa(),
    },
    hover: {
      dark: Color(palette.steel[50]).alpha(0.05).hexa(),
      light: Color(palette.beige[950]).alpha(0.05).hexa(),
    },
  },
  border: { dark: palette.stone[300], light: palette.steel[600] },
  foreground: { dark: palette.steel[50], light: palette.stone[900] },
} as const;

const foreground = {
  dark: palette.neutral[50],
  light: palette.neutral[900],
} as const;

const states = {
  data: {
    background: { dark: palette.violet[900], light: palette.violet[200] },
    border: { dark: palette.violet[700], light: palette.violet[400] },
    normal: { dark: palette.violet[400], light: palette.violet[700] },
  },
  error: {
    background: { dark: palette.red[950], light: palette.red[50] },
    border: { dark: palette.red[900], light: palette.red[400] },
    normal: palette.red[500],
  },
  info: {
    background: { dark: palette.indigo[950], light: palette.indigo[50] },
    border: { dark: palette.indigo[800], light: palette.indigo[400] },
    normal: { dark: palette.indigo[400], light: palette.indigo[600] },
  },
  neutral: {
    normal: {
      dark: Color(palette.beige[50]).alpha(0.2).hexa(),
      light: Color(palette.steel[900]).alpha(0.2).hexa(),
    },
    border: { dark: palette.steel[300], light: palette.steel[600] },
    background: { dark: palette.white, light: palette.steel[900] },
  },
  success: {
    background: { dark: palette.green[950], light: palette.green[50] },
    border: { dark: palette.green[800], light: palette.green[400] },
    normal: { dark: palette.green[500], light: palette.green[600] },
  },
  warning: {
    background: { dark: palette.orange[950], light: palette.orange[50] },
    border: { dark: palette.orange[700], light: palette.orange[400] },
    normal: { dark: palette.orange[400], light: palette.orange[600] },
  },
} as const;

const border = { dark: palette.steel[600], light: palette.stone[300] };

const colors = {
  background: {
    cardHighlight: { dark: palette.slate[950], light: palette.violet[50] },
    cardSecondary: { dark: palette.steel[950], light: palette.white },
    modal: { dark: palette.steel[950], light: palette.white },
    navBlur: {
      dark: Color(palette.steel[950]).alpha(0.7).hexa(),
      light: Color(palette.white).alpha(0.7).hexa(),
    },
    primary: { dark: palette.steel[950], light: palette.white },
    secondary: { dark: palette.steel[900], light: palette.beige[100] },
    tooltip: { dark: palette.steel[200], light: palette.steel[700] },
  },
  border,
  button: {
    disabled: {
      background: { dark: palette.steel[600], light: palette.stone[200] },
      foreground: { dark: palette.steel[400], light: palette.stone[400] },
    },
    ghost: omitKeys(buttonOutlineColors, ["border"]),
    outline: buttonOutlineColors,
    primary: {
      background: {
        active: { dark: palette.slate[800], light: palette.slate[900] },
        hover: { dark: palette.slate[700], light: palette.slate[800] },
        normal: { dark: palette.slate[600], light: palette.slate[700] },
      },
      foreground: palette.white,
    },
    secondary: {
      background: {
        active: palette.purple[400],
        hover: palette.purple[300],
        normal: palette.purple[200],
      },
      foreground: palette.steel[900],
    },
  },
  card: {
    background: {
      dark: Color(palette.white).alpha(0.5).hexa(),
      light: Color(palette.steel[200]).alpha(0.5).hexa(),
    },
  },
  chart: {
    series: {
      neutral: { dark: palette.steel[300], light: palette.stone[500] },
      primary: { dark: palette.violet[400], light: palette.violet[500] },
    },
  },
  focus: { dark: palette.violet[500], light: palette.violet[700] },
  focusDim: {
    dark: Color(palette.violet[500]).alpha(0.3).hexa(),
    light: Color(palette.violet[700]).alpha(0.3).hexa(),
  },
  foreground,
  forms: {
    input: {
      border,
      disabled: {
        background: {
          dark: palette.zinc[800],
          light: palette.zinc[200],
        },
        foreground: {
          dark: palette.neutral[500],
          light: palette.neutral[500],
        },
        placeholder: {
          dark: palette.neutral[600],
          light: palette.neutral[400],
        },
      },
      focusRing: {
        dark: palette.violet[500],
        light: palette.violet[500],
      },
      foreground,
      hover: {
        border: { dark: palette.steel[500], light: palette.stone[400] },
      },
      placeholder: foreground,
    },
  },
  heading: { dark: palette.steel[200], light: palette.steel[900] },
  highlight: { dark: palette.violet[500], light: palette.violet[600] },
  link: {
    normal: { dark: palette.steel[50], light: palette.steel[900] },
    primary: { dark: palette.violet[300], light: palette.violet[700] },
  },
  muted: { dark: palette.steel[300], light: palette.stone[700] },
  paragraph: { dark: palette.steel[300], light: palette.stone[600] },
  selection: {
    background: { dark: palette.violet[400], light: palette.violet[600] },
    foreground: { dark: palette.slate[950], light: palette.steel[50] },
  },
  states,
  tooltip: { dark: palette.steel[900], light: palette.steel[200] },
  transparent: "transparent",
} as const;

const tokens = {
  borderRadius: {
    base: "0.25rem",
    full: "9999px",
    lg: "0.5rem",
    md: "0.375rem",
    none: "0px",
    sm: "0.125rem",
    xl: "0.75rem",
    xxl: "1rem",
    xxxl: "1.5rem",
  },
  fontFamilies: {
    monospace:
      '"ui-monospace", "sfmono-regular", "consolas", "Liberation Mono", "menlo", "monospace"',
    normal:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  },
  fontSizes: {
    base: "1rem",
    lg: "1.125rem",
    sm: "0.875rem",
    xl: "1.25rem",
    xxl: "1.5rem",
    xxxl: "1.875rem",
    xxxxl: "2.25rem",
    xxxxxl: "3rem",
    xxxxxxl: "3.75rem",
    xxxxxxxl: "4.5rem",
    xxxxxxxxl: "6rem",
    xxxxxxxxxl: "8rem",
    xs: "0.75rem",
    xxs: "0.6875rem",
  },
  fontWeights: {
    black: 900,
    bold: 700,
    extrabold: 800,
    extralight: 200,
    light: 300,
    medium: 500,
    normal: 400,
    semibold: 600,
    thin: 100,
  },
  letterSpacing: {
    normal: "0em",
    tight: "-0.025em",
    tighter: "-0.05em",
    wide: "0.025em",
    wider: "0.05em",
    widest: "0.1em",
  },
} as const;

/**
 * Supporting Types
 */
export type BreakpointSize = keyof typeof breakpoints;
export type ButtonSizes = keyof typeof buttonSizes;
export type InputSize = "xs" | "sm" | "md" | "lg";
export type ThemeColor = keyof typeof colors;
export type Elevation = keyof typeof elevations;
export type PaletteColor = keyof typeof palette;
export type ThemeState = keyof typeof states;

const popoverTooltipStyles = (): SimpleStyleRules["key"] => ({
  backgroundColor: lightDark(
    colors.background.modal.light,
    colors.background.modal.dark,
  ),
  border: `1px solid ${lightDark(colors.border.light, colors.border.dark)}`,
  borderRadius: tokens.borderRadius.xl,
  boxShadow: elevations.default[2],
  color: lightDark(colors.foreground.light, colors.foreground.dark),
  minWidth: "160px",
  padding: spacing(2),
});

const flexHorizontalCenter = (
  opts?: Partial<{ inline: boolean }>,
): SimpleStyleRules["key"] => ({
  alignItems: "center",
  display: `${opts?.inline ? "inline-" : ""}flex`,
});

const alphaColor = (inputColor: string, alpha: number) => {
  if (alpha > 1) {
    throw new Error(
      "cannot specify an alpha / opacity greater than 1 (which is equal to 100%)",
    );
  }
  if (alpha < 0) {
    throw new Error(
      "cannot specify an alpha / opacity less than 0 (which is equal to 0%)",
    );
  }

  return Color(inputColor).alpha(alpha).hexa();
};

/**
 * The Unified Theme Object
 */
export const ThemeV2 = {
  alphaColor,

  /**
   * Breakpoints for responsive design
   */
  breakpoints,

  /**
   * Button Size Tokens
   */
  buttonSizes,

  /**
   * Functional Color Tokens (Light/Dark support)
   */
  colors,

  /**
   * Box Shadows and Elevations
   */
  elevations,

  flexHorizontalCenter,

  lightDark,

  resolveThemeColor,

  /**
   * Media Query Methods
   */
  mediaQueries: {
    down: (
      size: BreakpointSize,
      rules: SimpleStyleRules["key"],
    ): SimpleStyleRules["key"] => ({
      [`@media (max-width: ${ThemeV2.breakpoints[size]})`]: rules,
    }),
    prefersDark: (rules: SimpleStyleRules["key"]): SimpleStyleRules["key"] => ({
      "@media (prefers-color-scheme: dark)": rules,
    }),
    prefersLight: (
      rules: SimpleStyleRules["key"],
    ): SimpleStyleRules["key"] => ({
      "@media (prefers-color-scheme: light)": rules,
    }),
    up: (
      size: BreakpointSize,
      rules: SimpleStyleRules["key"],
    ): SimpleStyleRules["key"] => ({
      [`@media (min-width: ${ThemeV2.breakpoints[size]})`]: rules,
    }),
  },

  /**
   * Raw Color Palette
   */
  palette,

  popoverTooltipStyles,

  spacing,

  /**
   * General Design Tokens
   */
  tokens,
} as const;
