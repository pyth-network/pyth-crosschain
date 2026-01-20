import type { SimpleStyleRules } from "simplestyle-js/ssr";

const spacing = (increment: number): string =>
  `${(increment * 0.25).toString()}rem`;

const fontWeight = {
  black: 900,
  bold: 700,
  extrabold: 800,
  extralight: 200,
  light: 300,
  medium: 500,
  normal: 400,
  semibold: 600,
  thin: 100,
} as const;

const fontFamily = {
  monospace: [
    "ui-monospace",
    "sfmono-regular",
    "consolas",
    "Liberation Mono",
    "menlo",
    "monospace",
  ],
} as const;

const fontSize = {
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
  "5xl": "3rem",
  "6xl": "3.75rem",
  "7xl": "4.5rem",
  "8xl": "6rem",
  "9xl": "8rem",
  base: "1rem",
  lg: "1.125rem",
  sm: "0.875rem",
  xl: "1.25rem",
  xs: "0.75rem",
  xxs: "0.6875rem",
} as const;

const letterSpacing = {
  normal: "0em",
  tight: "-0.025em",
  tighter: "-0.05em",
  wide: "0.025em",
  wider: "0.05em",
  widest: "0.1em",
} as const;

const borderRadius = {
  "2xl": "1rem",
  "3xl": "1.5rem",
  base: "0.25rem",
  full: "9999px",
  lg: "0.5rem",
  md: "0.375rem",
  none: "0px",
  sm: "0.125rem",
  xl: "0.75rem",
} as const;

const colorPalette = {
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
    200: "#e2e8f0",
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

const color = {
  background: {
    cardHighlight: `light-dark(${colorPalette.violet[100]}, ${colorPalette.violet[950]})`,
    cardSecondary: `light-dark(${colorPalette.white}, ${colorPalette.steel[950]})`,
    modal: `light-dark(${colorPalette.white}, ${colorPalette.steel[950]})`,
    navBlur: `light-dark(rgb(from ${colorPalette.white} r g b / 70%), rgb(from ${colorPalette.steel[950]} r g b / 70%))`,
    primary: `light-dark(${colorPalette.white}, ${colorPalette.steel[950]})`,
    secondary: `light-dark(${colorPalette.beige[100]}, ${colorPalette.steel[900]})`,
    tooltip: `light-dark(${colorPalette.steel[700]}, ${colorPalette.steel[200]})`,
  },
  border: `light-dark(${colorPalette.stone[300]}, ${colorPalette.steel[600]})`,
  button: {
    disabled: {
      background: `light-dark(${colorPalette.stone[200]}, ${colorPalette.steel[600]})`,
      foreground: `light-dark(${colorPalette.stone[400]}, ${colorPalette.steel[400]})`,
    },
    outline: {
      background: {
        active: `light-dark(rgb(from ${colorPalette.beige[950]} r g b / 10%), rgb(from ${colorPalette.steel[50]} r g b / 10%))`,
        hover: `light-dark(rgb(from ${colorPalette.beige[950]} r g b / 5%), rgb(from ${colorPalette.steel[50]} r g b / 5%))`,
      },
      border: `light-dark(${colorPalette.stone[300]}, ${colorPalette.steel[600]})`,
      foreground: `light-dark(${colorPalette.stone[900]}, ${colorPalette.steel[50]})`,
    },
    primary: {
      background: {
        active: `light-dark(${colorPalette.violet[900]}, ${colorPalette.violet[800]})`,
        hover: `light-dark(${colorPalette.violet[800]}, ${colorPalette.violet[700]})`,
        normal: `light-dark(${colorPalette.violet[700]}, ${colorPalette.violet[600]})`,
      },
      foreground: colorPalette.white,
    },
    secondary: {
      background: {
        active: colorPalette.purple[400],
        hover: colorPalette.purple[300],
        normal: colorPalette.purple[200],
      },
      foreground: colorPalette.steel[900],
    },
    solid: {
      background: {
        active: `light-dark(${colorPalette.steel[900]}, ${colorPalette.steel[50]})`,
        hover: `light-dark(${colorPalette.steel[600]}, ${colorPalette.steel[200]})`,
        normal: `light-dark(${colorPalette.steel[900]}, ${colorPalette.steel[50]})`,
      },
      foreground: `light-dark(${colorPalette.steel[50]}, ${colorPalette.steel[900]})`,
    },
  },
  chart: {
    series: {
      neutral: `light-dark(${colorPalette.stone[500]}, ${colorPalette.steel[300]})`,
      primary: `light-dark(${colorPalette.violet[500]}, ${colorPalette.violet[400]})`,
    },
  },
  focus: `light-dark(${colorPalette.violet[700]}, ${colorPalette.violet[500]})`,
  focusDim: `light-dark(rgb(from ${colorPalette.violet[700]} r g b / 30%), rgb(from ${colorPalette.violet[500]} r g b / 30%))`,
  foreground: `light-dark(${colorPalette.steel[900]}, ${colorPalette.steel[50]})`,
  forms: {
    input: {
      hover: {
        border: `light-dark(${colorPalette.stone[400]}, ${colorPalette.steel[500]})`,
      },
    },
  },
  heading: `light-dark(${colorPalette.steel[800]}, ${colorPalette.steel[200]})`,
  highlight: `light-dark(${colorPalette.violet[600]}, ${colorPalette.violet[500]})`,
  link: {
    normal: `light-dark(${colorPalette.steel[800]}, ${colorPalette.steel[50]})`,
    primary: `light-dark(${colorPalette.violet[700]}, ${colorPalette.purple[300]})`,
  },
  muted: `light-dark(${colorPalette.stone[700]}, ${colorPalette.steel[300]})`,
  paragraph: `light-dark(${colorPalette.steel[700]}, ${colorPalette.steel[300]})`,
  selection: {
    background: `light-dark(${colorPalette.violet[600]}, ${colorPalette.violet[400]})`,
    foreground: `light-dark(${colorPalette.steel[50]}, ${colorPalette.steel[950]})`,
  },
  states: {
    data: {
      background: `light-dark(${colorPalette.violet[100]}, ${colorPalette.violet[950]})`,
      border: `light-dark(${colorPalette.violet[200]}, ${colorPalette.violet[800]})`,
      normal: `light-dark(${colorPalette.violet[600]}, ${colorPalette.violet[400]})`,
    },
    error: {
      active: colorPalette.red[700],
      background: `light-dark(${colorPalette.red[100]}, ${colorPalette.red[950]})`,
      base: `light-dark(${colorPalette.red[600]}, ${colorPalette.red[400]})`,
      border: `light-dark(${colorPalette.red[400]}, ${colorPalette.red[900]})`,
      color: `light-dark(${colorPalette.red[500]}, ${colorPalette.red[400]})`,
      hover: colorPalette.red[600],
      normal: colorPalette.red[500],
    },
    info: {
      background: `light-dark(${colorPalette.indigo[100]}, ${colorPalette.indigo[950]})`,
      backgroundOpaque: `light-dark(rgb(from ${colorPalette.indigo[200]} r g b / 80%), rgb(from ${colorPalette.indigo[950]} r g b / 80%))`,
      border: `light-dark(${colorPalette.indigo[400]}, ${colorPalette.indigo[800]})`,
      icon: `light-dark(${colorPalette.indigo[600]}, ${colorPalette.indigo[500]})`,
      normal: `light-dark(${colorPalette.indigo[600]}, ${colorPalette.indigo[400]})`,
    },
    lime: {
      background: `light-dark(${colorPalette.lime[100]}, ${colorPalette.lime[900]})`,
      normal: colorPalette.lime[500],
    },
    neutral: {
      background: `light-dark(${colorPalette.white}, ${colorPalette.steel[900]})`,
      border: `light-dark(${colorPalette.stone[300]}, ${colorPalette.steel[600]})`,
      normal: `light-dark(${colorPalette.steel[900]}, ${colorPalette.steel[50]})`,
    },
    success: {
      active: colorPalette.emerald[800],
      background: `light-dark(${colorPalette.emerald[100]}, ${colorPalette.emerald[950]})`,
      base: `light-dark(${colorPalette.emerald[600]}, ${colorPalette.emerald[500]})`,
      border: `light-dark(${colorPalette.emerald[400]}, ${colorPalette.emerald[800]})`,
      hover: colorPalette.emerald[700],
      normal: `light-dark(${colorPalette.emerald[600]}, ${colorPalette.emerald[500]})`,
    },
    warning: {
      background: `light-dark(${colorPalette.orange[100]}, ${colorPalette.orange[950]})`,
      border: `light-dark(${colorPalette.orange[400]}, ${colorPalette.orange[700]})`,
      normal: `light-dark(${colorPalette.orange[600]}, ${colorPalette.orange[400]})`,
    },
    yellow: {
      background: `light-dark(${colorPalette.yellow[100]}, ${colorPalette.yellow[900]})`,
      normal: colorPalette.yellow[500],
    },
  },
  tooltip: `light-dark(${colorPalette.steel[200]}, ${colorPalette.steel[800]})`,
  transparent: "transparent",
} as const;

const buttonSizes = {
  lg: {
    borderRadius: borderRadius["2xl"],
    fontSize: fontSize.xl,
    gap: spacing(3),
    height: spacing(14),
    iconSize: spacing(6),
    padding: spacing(4),
  },
  md: {
    borderRadius: borderRadius.xl,
    fontSize: fontSize.base,
    gap: spacing(2),
    height: spacing(12),
    iconSize: spacing(6),
    padding: spacing(3),
  },
  sm: {
    borderRadius: borderRadius.lg,
    fontSize: fontSize.sm,
    gap: spacing(2),
    height: spacing(9),
    iconSize: spacing(5),
    padding: spacing(2),
  },
  xs: {
    borderRadius: borderRadius.md,
    fontSize: fontSize.xxs,
    gap: spacing(1),
    height: spacing(6),
    iconSize: spacing(4),
    padding: spacing(1),
  },
} as const;

const maxWidth = spacing(372);
const maxWidthPadding = "var(--max-width-padding)";

const elevations = {
  default: {
    1: `0px 4px 6px -4px rgb(from black r g b / 10%),
0px 10px 15px -3px rgb(from black r g b / 10%)`,
    2: `0px 29px 12px 0px light-dark(rgb(from #564848 r g b / 2%), rgb(from black r g b / 8%)),
0px 16px 10px 0px light-dark(rgb(from #564848 r g b / 6%), rgb(from black r g b / 12%)),
0px 7px 7px 0px light-dark(rgb(from #564848 r g b / 12%), rgb(from black r g b / 20%)),
0px 2px 4px 0px light-dark(rgb(from #564848 r g b / 14%), rgb(from black r g b / 30%))`,
  },
  primary: {
    2: `0px 66px 18px 0px rgb(112 66 206 / 0%),
0px 42px 17px 0px rgb(112 66 206 / 3%),
0px 24px 14px 0px rgb(112 66 206 / 8%),
0px 11px 11px 0px rgb(112 66 206 / 14%),
0px 3px 6px 0px rgb(112 66 206 / 17%)`,
  },
} as const;

const breakpoints = {
  "2xl": "1536px",
  lg: "1024px",
  md: "768px",
  sm: "640px",
  xl: "1280px",
} as const;

const breakpoint = (
  point: Breakpoint,
  nestedRules: SimpleStyleRules["key"],
): SimpleStyleRules["key"] => ({
  [`@media (min-width: ${breakpoints[point]})`]: nestedRules,
});

const headerHeight = "var(--header-height)";
const root = {
  colorScheme: "light dark",
} as const;

export type PaletteKey = keyof typeof colorPalette;
export type Color = typeof color;
export type ButtonSize = keyof typeof buttonSizes;
export type Breakpoint = keyof typeof breakpoints;

type CssVarMap = Record<string, string>;

const getFontWeight = (weight: keyof typeof fontWeight) => fontWeight[weight];
const getFontFamily = (family: keyof typeof fontFamily) => fontFamily[family];
const getFontSize = (size: keyof typeof fontSize = "base") => fontSize[size];
const getLetterSpacing = (spacingKey: keyof typeof letterSpacing = "normal") =>
  letterSpacing[spacingKey];
const getBorderRadius = (radius: keyof typeof borderRadius = "base") =>
  borderRadius[radius];

const buttonPadding = (size: ButtonSize, includeGap: boolean) => {
  const button = buttonSizes[size];
  const paddingValue = button.padding;

  if (!includeGap) {
    return paddingValue;
  }

  return `calc(${paddingValue} + ${button.gap})`;
};

const buttonIconSize = (size: ButtonSize) => buttonSizes[size].iconSize;
const buttonBorderRadius = (size: ButtonSize) => buttonSizes[size].borderRadius;

const srOnly = (): SimpleStyleRules["key"] => ({
  borderWidth: 0,
  clip: "rect(0, 0, 0, 0)",
  height: "1px",
  margin: "-1px",
  padding: 0,
  overflow: "hidden",
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
});

const row = (): SimpleStyleRules["key"] => ({
  alignItems: "center",
  display: "flex",
  flexFlow: "row nowrap",
});

const elevation = (
  variant: keyof typeof elevations,
  level: keyof (typeof elevations)[keyof typeof elevations],
): SimpleStyleRules["key"] => ({
  boxShadow: elevations[variant][level],
});

const h3 = (): SimpleStyleRules["key"] => ({
  fontWeight: fontWeight.semibold.toString(),
  fontSize: fontSize.xl,
  fontStyle: "normal",
  letterSpacing: letterSpacing.tighter,
  lineHeight: "125%",
  margin: 0,
  ...breakpoint("sm", {
    fontSize: fontSize["2xl"],
  }),
});

const h4 = (): SimpleStyleRules["key"] => ({
  fontSize: fontSize.xl,
  fontStyle: "normal",
  fontWeight: fontWeight.medium.toString(),
  letterSpacing: letterSpacing.tight,
  lineHeight: "125%",
  margin: 0,
});

const text = (
  size: keyof typeof fontSize = "base",
  weight: keyof typeof fontWeight = "normal",
): SimpleStyleRules["key"] => ({
  fontSize: fontSize[size],
  fontStyle: "normal",
  fontWeight: fontWeight[weight].toString(),
  lineHeight: 1,
  margin: 0,
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const exportCssVars = (mapValue: Record<string, unknown>, prefix = "") => {
  const vars: CssVarMap = {};

  for (const [key, value] of Object.entries(mapValue)) {
    const varName = prefix ? `${prefix}-${key}` : key;

    if (isPlainObject(value)) {
      Object.assign(vars, exportCssVars(value, varName));
      continue;
    }

    vars[`--${varName}`] = String(value);
  }

  return vars;
};

export const theme = {
  borderRadius,
  breakpoint,
  buttonBorderRadius,
  buttonIconSize,
  buttonPadding,
  buttonSizes,
  color,
  colorPalette,
  elevation,
  elevations,
  exportCssVars,
  fontFamily,
  fontSize,
  fontWeight,
  getBorderRadius,
  getFontFamily,
  getFontSize,
  getFontWeight,
  getLetterSpacing,
  h3,
  h4,
  headerHeight,
  letterSpacing,
  maxWidth,
  maxWidthPadding,
  root,
  row,
  spacing,
  srOnly,
  text,
} as const;

export type Theme = typeof theme;
