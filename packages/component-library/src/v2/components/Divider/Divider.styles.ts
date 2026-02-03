import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("v2-divider", (theme) => {
  let sizeVariants: Record<string, Record<string, string>> = {};

  for (const [size, height] of Object.entries(theme.sizes.divider)) {
    sizeVariants = {
      ...sizeVariants,
      [`&[data-size="${size}"]`]: {
        height,
      },
    };
  }

  return {
    root: {
      ...sizeVariants,
      backgroundColor: theme.resolveThemeColor(theme.colors.border),
      border: "none",
      display: "block",
      margin: 0,
      width: "100%",
    },
  };
});
