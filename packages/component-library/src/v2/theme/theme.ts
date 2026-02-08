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

const black = "#000000";
const white = "#ffffff";

const palette = {
  amber50: "#fffbeb",
  amber100: "#fef3c7",
  amber200: "#fde68a",
  amber300: "#fcd34d",
  amber400: "#fbbf24",
  amber500: "#f59e0b",
  amber600: "#d97706",
  amber700: "#b45309",
  amber800: "#92400e",
  amber900: "#78350f",
  amber950: "#451a03",
  beige50: "#f7f4f4",
  beige100: "#f3eded",
  beige200: "#e9dfdf",
  beige300: "#d9c8c8",
  beige400: "#c1a8a8",
  beige500: "#a98a8a",
  beige600: "#927070",
  beige700: "#795c5c",
  beige800: "#664e4e",
  beige900: "#574545",
  beige950: "#2d2222",
  black,
  blue50: "#eff6ff",
  blue100: "#dbeafe",
  blue200: "#bfdbfe",
  blue300: "#93c5fd",
  blue400: "#60a5fa",
  blue500: "#3b82f6",
  blue600: "#2563eb",
  blue700: "#1d4ed8",
  blue800: "#1e40af",
  blue900: "#1e3a8a",
  blue950: "#172554",
  cyan50: "#ecfeff",
  cyan100: "#cffafe",
  cyan200: "#a5f3fc",
  cyan300: "#67e8f9",
  cyan400: "#22d3ee",
  cyan500: "#06b6d4",
  cyan600: "#0891b2",
  cyan700: "#0e7490",
  cyan800: "#155e75",
  cyan900: "#164e63",
  cyan950: "#083344",
  emerald50: "#ecfdf5",
  emerald100: "#d1fae5",
  emerald200: "#a7f3d0",
  emerald300: "#6ee7b7",
  emerald400: "#34d399",
  emerald500: "#10b981",
  emerald600: "#059669",
  emerald700: "#047857",
  emerald800: "#065f46",
  emerald900: "#064e3b",
  emerald950: "#022c22",
  fuchsia50: "#fdf4ff",
  fuchsia100: "#fae8ff",
  fuchsia200: "#f5d0fe",
  fuchsia300: "#f0abfc",
  fuchsia400: "#e879f9",
  fuchsia500: "#d946ef",
  fuchsia600: "#c026d3",
  fuchsia700: "#a21caf",
  fuchsia800: "#86198f",
  fuchsia900: "#701a75",
  fuchsia950: "#4a044e",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray800: "#1f2937",
  gray900: "#111827",
  gray950: "#030712",
  green50: "#f0fdf4",
  green100: "#dcfce7",
  green200: "#bbf7d0",
  green300: "#86efac",
  green400: "#4ade80",
  green500: "#22c55e",
  green600: "#16a34a",
  green700: "#15803d",
  green800: "#166534",
  green900: "#14532d",
  green950: "#052e16",
  indigo50: "#eef2ff",
  indigo100: "#e0e7ff",
  indigo200: "#c7d2fe",
  indigo300: "#a5b4fc",
  indigo400: "#818cf8",
  indigo500: "#6366f1",
  indigo600: "#4f46e5",
  indigo700: "#4338ca",
  indigo800: "#3730a3",
  indigo900: "#312e81",
  indigo950: "#1e1b4b",
  lime50: "#f7fee7",
  lime100: "#ecfccb",
  lime200: "#d9f99d",
  lime300: "#bef264",
  lime400: "#a3e635",
  lime500: "#84cc16",
  lime600: "#65a30d",
  lime700: "#4d7c0f",
  lime800: "#3f6212",
  lime900: "#365314",
  lime950: "#1a2e05",
  neutral50: "#fafafa",
  neutral100: "#f5f5f5",
  neutral200: "#e5e5e5",
  neutral300: "#d4d4d4",
  neutral400: "#a3a3a3",
  neutral500: "#737373",
  neutral600: "#525252",
  neutral700: "#404040",
  neutral800: "#262626",
  neutral900: "#171717",
  neutral950: "#0a0a0a",
  orange50: "#fff7ed",
  orange100: "#ffedd5",
  orange200: "#fed7aa",
  orange300: "#fdba74",
  orange400: "#fb923c",
  orange500: "#f97316",
  orange600: "#ea580c",
  orange700: "#c2410c",
  orange800: "#9a3412",
  orange900: "#7c2d12",
  orange950: "#431407",
  pink50: "#fdf2f8",
  pink100: "#fce7f3",
  pink200: "#fbcfe8",
  pink300: "#f9a8d4",
  pink400: "#f472b6",
  pink500: "#ec4899",
  pink600: "#db2777",
  pink700: "#be185d",
  pink800: "#9d174d",
  pink900: "#831843",
  pink950: "#500724",
  purple50: "#faf5ff",
  purple100: "#f3e8ff",
  purple200: "#e9d5ff",
  purple300: "#d8b4fe",
  purple400: "#c084fc",
  purple500: "#a855f7",
  purple600: "#9333ea",
  purple700: "#7e22ce",
  purple800: "#6b21a8",
  purple900: "#581c87",
  purple950: "#3b0764",
  red50: "#fef2f2",
  red100: "#fee2e2",
  red200: "#fecaca",
  red300: "#fca5a5",
  red400: "#f87171",
  red500: "#ef4444",
  red600: "#dc2626",
  red700: "#b91c1c",
  red800: "#991b1b",
  red900: "#7f1d1d",
  red950: "#450a0a",
  rose50: "#fff1f2",
  rose100: "#ffe4e6",
  rose200: "#fecdd3",
  rose300: "#fda4af",
  rose400: "#fb7185",
  rose500: "#f43f5e",
  rose600: "#e11d48",
  rose700: "#be123c",
  rose800: "#9f1239",
  rose900: "#881337",
  rose950: "#4c0519",
  sky50: "#f0f9ff",
  sky100: "#e0f2fe",
  sky200: "#bae6fd",
  sky300: "#7dd3fc",
  sky400: "#38bdf8",
  sky500: "#0ea5e9",
  sky600: "#0284c7",
  sky700: "#0369a1",
  sky800: "#075985",
  sky900: "#0c4a6e",
  sky950: "#082f49",
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",
  slate950: "#020617",
  steel50: "#f8f9fc",
  steel100: "#f1f2f9",
  steel200: "#e2e3f0",
  steel300: "#cbcee1",
  steel400: "#9497b8",
  steel500: "#64678b",
  steel600: "#474a69",
  steel700: "#333655",
  steel800: "#25253e",
  steel900: "#27253d",
  steel950: "#100e23",
  stone50: "#fafaf9",
  stone100: "#f5f5f4",
  stone200: "#e7e5e4",
  stone300: "#d6d3d1",
  stone400: "#a8a29e",
  stone500: "#78716c",
  stone600: "#57534e",
  stone700: "#44403c",
  stone800: "#292524",
  stone900: "#1c1917",
  stone950: "#0c0a09",
  teal50: "#f0fdfa",
  teal100: "#ccfbf1",
  teal200: "#99f6e4",
  teal300: "#5eead4",
  teal400: "#2dd4bf",
  teal500: "#14b8a6",
  teal600: "#0d9488",
  teal700: "#0f766e",
  teal800: "#115e59",
  teal900: "#134e4a",
  teal950: "#042f2e",
  violet50: "#f5f3ff",
  violet100: "#ede9fe",
  violet200: "#ddd6fe",
  violet300: "#c4b5fd",
  violet400: "#a78bfa",
  violet500: "#8b5cf6",
  violet600: "#7c3aed",
  violet700: "#6d28d9",
  violet800: "#5b21b6",
  violet900: "#4c1d95",
  violet950: "#2e1065",
  white,
  yellow50: "#fefce8",
  yellow100: "#fef9c3",
  yellow200: "#fef08a",
  yellow300: "#fde047",
  yellow400: "#facc15",
  yellow500: "#eab308",
  yellow600: "#ca8a04",
  yellow700: "#a16207",
  yellow800: "#854d0e",
  yellow900: "#713f12",
  yellow950: "#422006",
  zinc50: "#fafafa",
  zinc100: "#f4f4f5",
  zinc200: "#e4e4e7",
  zinc300: "#d4d4d8",
  zinc400: "#a1a1aa",
  zinc500: "#71717a",
  zinc600: "#52525b",
  zinc700: "#3f3f46",
  zinc800: "#27272a",
  zinc900: "#18181b",
  zinc950: "#09090b",
} as const;

const blackBase = Color(palette.black);
const stone600 = Color(palette.stone600);
const violet600 = Color(palette.violet600);

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
      `0px 4px 6px -4px ${blackBase.alpha(0.1).hexa()}`,
      `0px 10px 15px -3px ${blackBase.alpha(0.1).hexa()}`,
    ].join(", "),
    2: [
      `0px 29px 12px 0px ${lightDark(stone600.alpha(0.02).hexa(), blackBase.alpha(0.08).hexa())}`,
      `0px 16px 10px 0px ${lightDark(stone600.alpha(0.06).hexa(), blackBase.alpha(0.12).hexa())}`,
      `0px 7px 7px 0px ${lightDark(stone600.alpha(0.12).hexa(), blackBase.alpha(0.2).hexa())}`,
      `0px 2px 4px 0px ${lightDark(stone600.alpha(0.14).hexa(), blackBase.alpha(0.3).hexa())}`,
    ].join(", "),
  },
} as const;

const buttonOutlineColors = {
  background: {
    active: {
      dark: Color(palette.steel50).alpha(0.1).hexa(),
      light: Color(palette.beige950).alpha(0.1).hexa(),
    },
    hover: {
      dark: Color(palette.steel50).alpha(0.05).hexa(),
      light: Color(palette.beige950).alpha(0.05).hexa(),
    },
  },
  border: { dark: palette.stone300, light: palette.steel600 },
  foreground: { dark: palette.steel50, light: palette.stone900 },
} as const;

const foreground = {
  dark: palette.neutral50,
  light: palette.neutral900,
} as const;

const states = {
  data: {
    background: { dark: palette.violet900, light: palette.violet200 },
    border: { dark: palette.violet700, light: palette.violet400 },
    normal: { dark: palette.violet400, light: palette.violet700 },
  },
  error: {
    background: { dark: palette.red950, light: palette.red50 },
    border: { dark: palette.red900, light: palette.red400 },
    normal: palette.red500,
  },
  info: {
    background: { dark: palette.indigo950, light: palette.indigo50 },
    border: { dark: palette.indigo800, light: palette.indigo400 },
    normal: { dark: palette.indigo400, light: palette.indigo600 },
  },
  neutral: {
    normal: {
      dark: Color(palette.beige50).alpha(0.2).hexa(),
      light: Color(palette.steel900).alpha(0.2).hexa(),
    },
    border: { dark: palette.steel300, light: palette.steel600 },
    background: { dark: palette.white, light: palette.steel900 },
  },
  success: {
    background: { dark: palette.green950, light: palette.green50 },
    border: { dark: palette.green800, light: palette.green400 },
    normal: { dark: palette.green500, light: palette.green600 },
  },
  warning: {
    background: { dark: palette.orange950, light: palette.orange50 },
    border: { dark: palette.orange700, light: palette.orange400 },
    normal: { dark: palette.orange400, light: palette.orange600 },
  },
} as const;

const border = { dark: palette.stone800, light: palette.stone300 };

const colors = {
  background: {
    cardHighlight: { dark: palette.slate950, light: palette.violet50 },
    cardSecondary: { dark: palette.steel950, light: palette.white },
    backdrop: {
      dark: Color(palette.black).alpha(0.6).hexa(),
      light: Color(palette.black).alpha(0.4).hexa(),
    },
    modal: { dark: palette.steel950, light: palette.white },
    navBlur: {
      dark: Color(palette.steel950).alpha(0.7).hexa(),
      light: Color(palette.white).alpha(0.7).hexa(),
    },
    primary: { dark: palette.black, light: palette.white },
    secondary: { dark: palette.steel900, light: palette.beige100 },
    tooltip: { dark: palette.steel200, light: palette.steel700 },
  },
  border,
  button: {
    disabled: {
      background: { dark: palette.steel600, light: palette.stone200 },
      foreground: { dark: palette.steel400, light: palette.stone400 },
    },
    ghost: omitKeys(buttonOutlineColors, ["border"]),
    outline: buttonOutlineColors,
    navlink: {
      background: {
        active: buttonOutlineColors.background.active,
        disabled: {
          dark: "transparent",
          light: "transparent",
        },
        normal: "transparent",
        hover: buttonOutlineColors.background.hover,
      },
      border: {
        active: {
          dark: palette.stone600,
          light: palette.stone500,
        },
        normal: "transparent",
        hover: {
          dark: palette.stone600,
          light: palette.stone500,
        },
      },
      foreground: {
        disabled: {
          dark: Color(foreground.dark).lighten(0.1).hexa(),
          light: Color(foreground.light).darken(0.1).hexa(),
        },
        normal: foreground,
      },
    },
    primary: {
      background: {
        active: { dark: palette.violet800, light: palette.violet900 },
        hover: { dark: palette.violet700, light: palette.violet800 },
        normal: { dark: palette.violet600, light: palette.violet700 },
      },
      foreground: palette.white,
    },
    secondary: {
      background: {
        active: palette.purple400,
        hover: palette.purple300,
        normal: palette.purple200,
      },
      foreground: palette.steel900,
    },
  },
  card: {
    background: {
      dark: palette.steel800,
      light: palette.steel50,
    },
  },
  chart: {
    series: {
      neutral: { dark: palette.steel300, light: palette.stone500 },
      primary: { dark: palette.violet400, light: palette.violet500 },
    },
  },
  focus: { dark: palette.violet500, light: palette.violet700 },
  focusDim: {
    dark: Color(palette.violet500).alpha(0.3).hexa(),
    light: Color(palette.violet700).alpha(0.3).hexa(),
  },
  foreground,
  forms: {
    input: {
      border,
      disabled: {
        background: {
          dark: palette.zinc800,
          light: palette.zinc200,
        },
        foreground: {
          dark: palette.neutral500,
          light: palette.neutral500,
        },
        placeholder: {
          dark: palette.neutral600,
          light: palette.neutral400,
        },
      },
      focusRing: {
        dark: palette.violet500,
        light: palette.violet500,
      },
      foreground,
      hover: {
        border: { dark: palette.steel500, light: palette.stone400 },
      },
      placeholder: foreground,
    },
  },
  heading: { dark: palette.steel200, light: palette.steel900 },
  highlight: { dark: palette.violet500, light: palette.violet600 },
  link: {
    normal: { dark: palette.steel50, light: palette.steel900 },
    primary: { dark: palette.violet300, light: palette.violet700 },
  },
  muted: { dark: palette.steel300, light: palette.stone700 },
  paragraph: { dark: palette.steel300, light: palette.stone600 },
  selection: {
    background: { dark: palette.violet400, light: palette.violet600 },
    foreground: { dark: palette.slate950, light: palette.steel50 },
  },
  states,
  tooltip: { dark: palette.steel900, light: palette.steel200 },
  transparent: "transparent",
} as const;

const fontSizes = {
  base: "1rem",
  lg: "1.125rem",
  sm: "0.875rem",
  xl: "1.25rem",
  xl2: "1.5rem",
  xl3: "1.875rem",
  xl4: "2.25rem",
  xl5: "3rem",
  xl6: "3.75rem",
  xl7: "4.5rem",
  xl8: "6rem",
  xl9: "8rem",
  xs: "0.75rem",
  xs2: "0.6875rem",
} as const;
export type FontSize = keyof typeof fontSizes;

const tokens = {
  borderRadius: {
    base: "0.25rem",
    full: "9999px",
    lg: "0.5rem",
    md: "0.375rem",
    none: "0px",
    sm: "0.125rem",
    xl: "0.75rem",
    xl2: "1rem",
    xl3: "1.5rem",
  },
  fontFamilies: {
    monospace:
      '"ui-monospace", "sfmono-regular", "consolas", "Liberation Mono", "menlo", "monospace"',
    normal:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  },
  fontSizes,
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

const cardSizes = {
  sm: {
    borderRadius: tokens.borderRadius.lg,
    padding: spacing(3),
  },
  md: {
    borderRadius: tokens.borderRadius.xl,
    padding: spacing(4),
  },
  lg: {
    borderRadius: tokens.borderRadius.xl2,
    padding: spacing(6),
  },
} as const;

const formFieldSizes = {
  xs: {
    fontSize: tokens.fontSizes.xs2,
    padding: `${spacing(0.5)} ${spacing(2)}`,
    height: buttonSizes.xs.height,
  },
  sm: {
    fontSize: tokens.fontSizes.xs,
    padding: `${spacing(0.75)} ${spacing(2.5)}`,
    height: buttonSizes.sm.height,
  },
  md: {
    fontSize: tokens.fontSizes.sm,
    padding: `${spacing(1)} ${spacing(3)}`,
    height: buttonSizes.md.height,
  },
  lg: {
    fontSize: tokens.fontSizes.base,
    padding: `${spacing(1.25)} ${spacing(4)}`,
    height: buttonSizes.lg.height,
  },
} as const;

const spinnerSizes = {
  xs: {
    borderWidth: "2px",
    fontSize: tokens.fontSizes.xs,
    height: buttonSizes.sm.height,
  },
  sm: {
    borderWidth: "3px",
    fontSize: tokens.fontSizes.sm,
    height: buttonSizes.sm.height,
  },
  md: {
    borderWidth: "4px",
    fontSize: tokens.fontSizes.base,
    height: buttonSizes.md.height,
  },
  lg: {
    borderWidth: "5px",
    fontSize: tokens.fontSizes.lg,
    height: buttonSizes.lg.height,
  },
} as const;

/**
 * Supporting Types
 */
export type BreakpointSize = keyof typeof breakpoints;
export type ButtonSizes = keyof typeof buttonSizes;
export type CardSizes = keyof typeof cardSizes;
export type InputSize = keyof typeof formFieldSizes;
export type ThemeColor = keyof typeof colors;
export type Elevation = keyof typeof elevations;
export type PaletteColor = keyof typeof palette;
export type ThemeState = keyof typeof states;
export type SpinnerSize = keyof typeof spinnerSizes;

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

const flexVertical = (
  opts?: Partial<{ inline: boolean }>,
): SimpleStyleRules["key"] => ({
  display: `${opts?.inline ? "inline-" : ""}flex`,
  flexFlow: "column",
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
   * Consolidated Size Tokens
   */
  sizes: {
    button: buttonSizes,
    card: cardSizes,
    checkbox: formFieldSizes,
    formField: formFieldSizes,
    spinner: spinnerSizes,
  },

  /**
   * Functional Color Tokens (Light/Dark support)
   */
  colors,

  /**
   * Box Shadows and Elevations
   */
  elevations,

  flexHorizontalCenter,
  flexVertical,

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
