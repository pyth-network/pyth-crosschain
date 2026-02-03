import { createStyles } from "../../styles";

export const { classes } = createStyles("auth-layout", (theme) => {
  const asideWidthSm = "320px";
  const asideWidthLg = "500px";
  const headerPadding = theme.spacing(6);

  return {
    aside: {
      background: "no-repeat center center transparent",
      backgroundImage: 'url("/img/cityscape.png")',
      backgroundSize: "cover",
      bottom: 0,
      color: theme.resolveThemeColor(theme.colors.foreground.dark),
      display: "flex",
      flexFlow: "column",
      justifyContent: "flex-end",
      padding: headerPadding,
      position: "fixed",
      right: 0,
      top: 0,
      transition: "width .2s ease",
      width: asideWidthLg,

      ...theme.mediaQueries.down("lg", {
        width: asideWidthSm,
      }),
    },
    companies: {
      ...theme.flexHorizontalCenter(),
      flexWrap: "wrap",
      gap: theme.spacing(6),
      marginTop: theme.spacing(6),

      "& > img": {
        height: "1em",
        width: "auto",
      },
    },
    form: {
      ...theme.flexVertical(),
      flexGrow: 1,
      padding: headerPadding,
      paddingRight: asideWidthLg,
      transition: "padding .2s ease",

      ...theme.mediaQueries.down("lg", {
        paddingRight: asideWidthSm,
      }),
    },
    header: {
      ...theme.flexHorizontalCenter(),
      justifyContent: "space-between",
      marginRight: asideWidthLg,
      padding: headerPadding,
      transition: "margin .2s ease",

      ...theme.mediaQueries.down("lg", {
        marginRight: asideWidthSm,
      }),
    },
    logo: {
      height: "1em",
      width: "auto",
    },
    tagline: {
      marginBottom: "27vh",
    },
    root: {
      ...theme.flexVertical(),
      backgroundColor: theme.resolveThemeColor(theme.colors.background.primary),
      color: theme.resolveThemeColor(theme.colors.foreground),
      minHeight: "100vh",
      overflowY: "auto",
      position: "relative",
      scrollBehavior: "smooth",
    },
  };
});
