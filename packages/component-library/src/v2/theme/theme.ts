import type { SimpleStyleRules } from "simplestyle-js/ssr";

function spacing(increment: number) {
  return `${(increment * 0.25).toString()}rem`;
}

/**
 * blends a color by a given decimal amount with another color
 */
function blendColor(colorInput: string, blendedWith: string, amount = 0.05) {
  return `color-mix(in srgb, ${colorInput}, ${blendedWith} ${(amount * 100).toString()}%)`;
}

/**
 * preps a css light-dark() function to use
 * as a color value
 */
function lightDark(light: string, dark: string) {
  return `light-dark(${light}, ${dark})`;
}

const lightPalette = {
  background: "#f7f4f4",
  badgeBadgeDefaultBg: "#1b1b1b1a",
  badgeBadgeDefaultFg: "#1b1b1bb2",
  border: "#e4e4e4",
  borderGlass: "#ffffff",
  brandPythPrimary: "#844ff5",
  card: "#ffffff",
  cardGlass: "#ffffff80",
  debugBg: "#d9d6d6",
  foreground: "#1b1b1b",
  inputFocusRing: "#844ff533",
  inputInputBg: "#ffffff",
  inputInputBorder: "#e4e4e4",
  inputInputBorderFocus: "#844ff5",
  inputInputBorderHover: "#bfbfbf",
  muted: "#1b1b1b99",
  paragraph: "#1b1b1be5",
  sky: "#BAE6FD",
  stateHover: "#1b1b1b0d",
  stateHoverInverted: "#f7f6f526",
  statePressed: "#1b1b1b1a",
  statePressedInverted: "#f7f6f540",
} as const;

const darkPalette = {
  background: "#22222a",
  badgeBadgeDefaultBg: "#f7f6f51a",
  badgeBadgeDefaultFg: "#f7f6f5b2",
  border: "#3b3b45",
  borderGlass: "#3e3e49",
  brandPythPrimary: "#8655f1",
  card: "#2c2c35",
  cardGlass: "#2c2c3580",
  debugBg: "#54545c",
  foreground: "#f7f6f5",
  inputFocusRing: "#a782f833",
  inputInputBg: "#2c2c35",
  inputInputBorder: "#3b3b45",
  inputInputBorderFocus: "#a782f8",
  inputInputBorderHover: "#545463",
  muted: "#f7f6f599",
  paragraph: "#f7f6f5e5",
  sky: "#BAE6FD",
  stateHover: "#f7f6f50d",
  stateHoverInverted: "#1b1b1b26",
  statePressed: "#f7f6f51a",
  statePressedInverted: "#1b1b1b40",
} as const;

const palette = {
  background: { light: lightPalette.background, dark: darkPalette.background },
  badgeBadgeDefaultBg: {
    light: lightPalette.badgeBadgeDefaultBg,
    dark: darkPalette.badgeBadgeDefaultBg,
  },
  badgeBadgeDefaultFg: {
    light: lightPalette.badgeBadgeDefaultFg,
    dark: darkPalette.badgeBadgeDefaultFg,
  },
  border: { light: lightPalette.border, dark: darkPalette.border },
  borderGlass: {
    light: lightPalette.borderGlass,
    dark: darkPalette.borderGlass,
  },
  brandPythPrimary: {
    light: lightPalette.brandPythPrimary,
    dark: darkPalette.brandPythPrimary,
  },
  card: { light: lightPalette.card, dark: darkPalette.card },
  cardGlass: { light: lightPalette.cardGlass, dark: darkPalette.cardGlass },
  debugBg: { light: lightPalette.debugBg, dark: darkPalette.debugBg },
  foreground: { light: lightPalette.foreground, dark: darkPalette.foreground },
  inputFocusRing: {
    light: lightPalette.inputFocusRing,
    dark: darkPalette.inputFocusRing,
  },
  inputInputBg: {
    light: lightPalette.inputInputBg,
    dark: darkPalette.inputInputBg,
  },
  inputInputBorder: {
    light: lightPalette.inputInputBorder,
    dark: darkPalette.inputInputBorder,
  },
  inputInputBorderFocus: {
    light: lightPalette.inputInputBorderFocus,
    dark: darkPalette.inputInputBorderFocus,
  },
  inputInputBorderHover: {
    light: lightPalette.inputInputBorderHover,
    dark: darkPalette.inputInputBorderHover,
  },
  muted: { light: lightPalette.muted, dark: darkPalette.muted },
  paragraph: { light: lightPalette.paragraph, dark: darkPalette.paragraph },
  stateHover: { light: lightPalette.stateHover, dark: darkPalette.stateHover },
  stateHoverInverted: {
    light: lightPalette.stateHoverInverted,
    dark: darkPalette.stateHoverInverted,
  },
  statePressed: {
    light: lightPalette.statePressed,
    dark: darkPalette.statePressed,
  },
  statePressedInverted: {
    light: lightPalette.statePressedInverted,
    dark: darkPalette.statePressedInverted,
  },
} as const;

const heights = {
  avatar: spacing(10),
} as const;

const widths = {
  avatar: heights.avatar,
  leftNav: {
    collapsed: spacing(18),
    desktop: "256px",
    mobile: "256px",
  },
} as const;

const color = {
  background: {
    primary: lightDark(palette.background.light, palette.background.dark),
  },
  dialog: {
    background: lightDark(palette.card.light, palette.card.dark),
    border: lightDark(palette.border.light, palette.border.dark),
    description: lightDark(palette.paragraph.light, palette.paragraph.dark),
    foreground: lightDark(palette.foreground.light, palette.foreground.dark),
  },
  overlay: {
    backdrop: lightDark(palette.statePressed.light, palette.statePressed.dark),
  },
  button: {
    ghost: {
      background: {
        hover: lightDark(palette.stateHover.light, palette.stateHover.dark),
        primary: "transparent",
      },
      foreground: {
        hover: lightDark(palette.foreground.light, palette.foreground.dark),
        primary: lightDark(palette.foreground.light, palette.foreground.dark),
      },
      outline: "none",
    },
    outline: {
      background: {
        hover: lightDark(palette.stateHover.light, palette.stateHover.dark),
        primary: "transparent",
      },
      foreground: {
        hover: lightDark(palette.foreground.light, palette.foreground.dark),
        primary: lightDark(palette.foreground.light, palette.foreground.dark),
      },
      outline: `1px solid ${lightDark(palette.border.light, palette.border.dark)}`,
    },
    primary: {
      background: {
        hover: lightDark(
          blendColor(palette.brandPythPrimary.light, "black"),
          blendColor(palette.brandPythPrimary.dark, "white"),
        ),
        primary: lightDark(
          palette.brandPythPrimary.light,
          palette.brandPythPrimary.dark,
        ),
      },
      foreground: {
        hover: lightDark(palette.card.light, palette.foreground.dark),
        primary: lightDark(palette.card.light, palette.foreground.dark),
      },
      outline: `1px solid ${lightDark(
        palette.brandPythPrimary.light,
        palette.brandPythPrimary.dark,
      )}`,
    },
    secondary: {
      background: {
        hover: lightDark(palette.stateHover.light, palette.stateHover.dark),
        primary: lightDark(palette.card.light, palette.card.dark),
      },
      foreground: {
        hover: lightDark(palette.foreground.light, palette.foreground.dark),
        primary: lightDark(palette.foreground.light, palette.foreground.dark),
      },
      outline: "none",
    },
    success: {
      background: {
        hover: lightDark(palette.stateHover.light, palette.stateHover.dark),
        primary: lightDark(
          palette.badgeBadgeDefaultBg.light,
          palette.badgeBadgeDefaultBg.dark,
        ),
      },
      foreground: {
        hover: lightDark(
          palette.badgeBadgeDefaultFg.light,
          palette.badgeBadgeDefaultFg.dark,
        ),
        primary: lightDark(
          palette.badgeBadgeDefaultFg.light,
          palette.badgeBadgeDefaultFg.dark,
        ),
      },
      outline: "none",
    },
    warning: {
      background: {
        hover: lightDark(palette.stateHover.light, palette.stateHover.dark),
        primary: lightDark(
          palette.badgeBadgeDefaultBg.light,
          palette.badgeBadgeDefaultBg.dark,
        ),
      },
      foreground: {
        hover: lightDark(
          palette.badgeBadgeDefaultFg.light,
          palette.badgeBadgeDefaultFg.dark,
        ),
        primary: lightDark(
          palette.badgeBadgeDefaultFg.light,
          palette.badgeBadgeDefaultFg.dark,
        ),
      },
      outline: "none",
    },
    danger: {
      background: {
        hover: lightDark(palette.stateHover.light, palette.stateHover.dark),
        primary: lightDark(
          palette.badgeBadgeDefaultBg.light,
          palette.badgeBadgeDefaultBg.dark,
        ),
      },
      foreground: {
        hover: lightDark(
          palette.badgeBadgeDefaultFg.light,
          palette.badgeBadgeDefaultFg.dark,
        ),
        primary: lightDark(
          palette.badgeBadgeDefaultFg.light,
          palette.badgeBadgeDefaultFg.dark,
        ),
      },
      outline: "none",
    },
  },
  leftNav: {
    background: {
      primary: lightDark(palette.background.light, palette.background.dark),
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
  xxl: "1.5rem",
  xxxl: "1.875rem",
  xxxxl: "2.25rem",
  xxxxxl: "3rem",
  xxxxxxl: "3.75rem",
  xxxxxxxl: "4.5rem",
  xxxxxxxxl: "6rem",
  xxxxxxxxxl: "8rem",
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
  avatar: "40px",
  badge: "24px",
  button: "8px",
  card: "16px",
  cardNested: "12px",
  popover: "8px",
} as const;

const elevationColor = lightDark(
  "rgba(15, 23, 42, 0.16)",
  "rgba(0, 0, 0, 0.6)",
);

const elevationColorSoft = lightDark(
  "rgba(15, 23, 42, 0.08)",
  "rgba(0, 0, 0, 0.45)",
);

const elevation = {
  sm: `0 1px 2px ${elevationColorSoft}`,
  md: `0 2px 6px ${elevationColor}, 0 1px 2px ${elevationColorSoft}`,
  lg: `0 6px 16px ${elevationColor}, 0 2px 4px ${elevationColorSoft}`,
  xl: `0 12px 28px ${elevationColor}, 0 4px 8px ${elevationColorSoft}`,
} as const;

const flexRow = (): SimpleStyleRules["key"] => ({
  display: "flex",
  flexFlow: "row",
});

const flexRowCenter = (gap?: string): SimpleStyleRules["key"] => {
  const out: SimpleStyleRules["key"] = { alignItems: "center", ...flexRow() };

  if (gap) {
    out.gap = gap;
  }

  return out;
};

const flexVertical = (): SimpleStyleRules["key"] => ({
  display: "flex",
  flexFlow: "column",
});

const flexVerticalCenter = (gap?: string): SimpleStyleRules["key"] => {
  const out: SimpleStyleRules["key"] = {
    ...flexVertical(),
    justifyContent: "center",
  };

  if (gap) {
    out.gap = gap;
  }

  return out;
};

const tooltipStyles = (): SimpleStyleRules["key"] => ({
  /**
   * class name applied to the menu popover that
   * holds all of the menu items
   */
  backgroundColor: lightDark(palette.card.light, palette.card.dark),
  borderRadius: borderRadius.popover,
  boxShadow: elevation.md,
  padding: spacing(2),
});

function labelStyles(
  yourStyles?: SimpleStyleRules["key"],
): SimpleStyleRules["key"] {
  return {
    color: lightDark(palette.muted.light, palette.muted.dark),
    fontSize: fontSize.xs,
    ...yourStyles,
  };
}

export const ThemeV2 = {
  blendColor,
  borderRadius,
  color,
  elevation,
  flexRow,
  flexRowCenter,
  flexVertical,
  flexVerticalCenter,
  fontFamily,
  fontSize,
  fontWeight,
  heights,
  labelStyles,
  letterSpacing,
  lightDark,
  palette,
  spacing,
  tooltipStyles,
  widths,
};
