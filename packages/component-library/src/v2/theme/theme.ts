function spacing(increment: number) {
  return `${(increment * 0.25).toString()}rem`;
}

/**
 * preps a css light-dark() function to use
 * as a color value
 */
function lightDark(light: string, dark: string) {
  return `light-dark(${light}, ${dark})`;
}

const palette = {
  accent: {
    primary: { light: "#f7f7f4", dark: "#1e293b" },
  },
  accentForeground: {
    primary: { light: "#1a1d2e", dark: "#f1f5f9" },
  },
  background: {
    primary: { light: "#fff", dark: "#020617" },
  },
  border: {
    primary: { light: "#3328281a", dark: "#1e293b" },
  },
  card: {
    primary: { light: "#f7f7f4", dark: "#0f172a" },
  },
  cardForeground: {
    primary: { light: "#1a1d2e", dark: "#f8fafc" },
  },
  chart1: {
    primary: { light: "#0dbbdc", dark: "#22d3ee" },
  },
  chart2: {
    primary: { light: "#f2f316", dark: "#eab308" },
  },
  chart3: {
    primary: { light: "#b8dcf6", dark: "#38bdf8" },
  },
  chart4: {
    primary: { light: "#22d38c", dark: "#34d399" },
  },
  chart5: {
    primary: {
      light: "oklch(76.9% 0.188 70.08)",
      dark: "oklch(65% 0.15 70.08)",
    },
  },
  destructive: {
    primary: { light: "#d4183d", dark: "#7f1d1d" },
  },
  destructiveForeground: {
    primary: { light: "#fff", dark: "#fef2f2" },
  },
  fontSize: {
    primary: { light: "16px", dark: "16px" },
  },
  fontWeightMedium: {
    primary: { light: 500, dark: 500 },
  },
  fontWeightNormal: {
    primary: { light: 400, dark: 400 },
  },
  foreground: {
    primary: { light: "#1a1d2e", dark: "#f8fafc" },
  },
  input: {
    primary: { light: "transparent", dark: "transparent" },
  },
  inputBackground: {
    primary: { light: "#f7f7f4", dark: "#0f172a" },
  },
  muted: {
    primary: { light: "#f7f7f4", dark: "#1e293b" },
  },
  mutedForeground: {
    primary: { light: "#727270", dark: "#94a3b8" },
  },
  popover: {
    primary: { light: "#fff", dark: "#0f172a" },
  },
  popoverForeground: {
    primary: { light: "#1a1d2e", dark: "#f8fafc" },
  },
  primary: {
    primary: { light: "#8b5cf6", dark: "#a78bfa" },
  },
  primaryForeground: {
    primary: { light: "#fff", dark: "#0f172a" },
  },
  radius: {
    primary: { light: ".625rem", dark: ".625rem" },
  },
  ring: {
    primary: { light: "#8b5cf6", dark: "#a78bfa" },
  },
  secondary: {
    primary: { light: "#f7f7f4", dark: "#1e293b" },
  },
  secondaryForeground: {
    primary: { light: "#1a1d2e", dark: "#f1f5f9" },
  },
  sidebar: {
    primary: { light: "#fff", dark: "#020617" },
  },
  sidebarAccent: {
    primary: { light: "#f7f7f4", dark: "#1e293b" },
  },
  sidebarAccentForeground: {
    primary: { light: "#1a1d2e", dark: "#f1f5f9" },
  },
  sidebarBorder: {
    primary: { light: "#3328281a", dark: "#1e293b" },
  },
  sidebarForeground: {
    primary: { light: "#1a1d2e", dark: "#f8fafc" },
  },
  sidebarPrimary: {
    primary: { light: "#8b5cf6", dark: "#a78bfa" },
  },
  sidebarPrimaryForeground: {
    primary: { light: "#fff", dark: "#0f172a" },
  },
  sidebarRing: {
    primary: { light: "#8b5cf6", dark: "#a78bfa" },
  },
  switchBackground: {
    primary: { light: "#cbced4", dark: "#334155" },
  },
} as const;

const color = {
  background: {
    primary: lightDark(
      palette.background.primary.light,
      palette.background.primary.dark,
    ),
  },
  button: {
    primary: {
      background: {
        hover: lightDark(palette.ring.primary.light, palette.ring.primary.dark),
        primary: lightDark(
          palette.background.primary.light,
          palette.background.primary.dark,
        ),
      },
      foreground: {
        hover: lightDark("#fff", palette.foreground.primary.dark),
        primary: lightDark(
          palette.ring.primary.light,
          palette.ring.primary.dark,
        ),
      },
      outline: `1px solid ${lightDark(palette.ring.primary.light, palette.ring.primary.dark)}`,
    },
  },
} as const;

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
  monospace:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  normal:
    'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
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

export const ThemeV2 = {
  borderRadius,
  color,
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  palette,
  spacing,
};
