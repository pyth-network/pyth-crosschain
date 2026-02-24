/** @type {import('tailwindcss').Config} */
import plugin from "tailwindcss/plugin";

const rotateX = plugin(function ({ addUtilities }) {
  addUtilities({
    ".-rotate-y-180": {
      transform: "rotateY(-180deg)",
    },
    ".rotate-y-0": {
      transform: "rotateY(0)",
    },
    ".rotate-y-180": {
      transform: "rotateY(180deg)",
    },
  });
});

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  mode: "jit",
  plugins: [rotateX],
  theme: {
    extend: {
      animation: {
        marquee: "marquee 50s linear infinite",
      },
      backgroundImage: {
        radial:
          "radial-gradient(100% 628.91% at 95.63% 10.42%, rgba(230, 218, 254, 0) 0%, #E6DAFE 30.71%, #E6DAFE 71.52%, rgba(230, 218, 254, 0) 100%)",
        radial2:
          "radial-gradient(91.27% 628.91% at 95.63% 10.42%, rgba(75, 52, 122, 0.15) 0%, #4B347A 30.71%, #4B347A 71.52%, rgba(75, 52, 122, 0.19) 100%)",
      },

      boxShadow: {
        purple: "inset 0px 0px 5px rgba(255, 176, 247, 0.25)",
      },
      colors: {
        beige: "#F1EAEA",
        "beige-300": "rgba(229, 231, 235, .3)",
        beige2: "#E4DADB",
        beige3: "#D6CACB",
        current: "currentColor",
        dark: "#110F23",
        "dark-300": "rgba(36, 34, 53, .3)",
        darkGray: "#252236",
        darkGray1: "#242235",
        darkGray2: "#312F47",
        darkGray3: "#2F2C4F",
        darkGray4: "#413E53",
        green: "#15AE6E",
        hoverGray: "rgba(255, 255, 255, 0.08)",
        light: "#E6DAFE",
        lightPurple: "#7731EA",
        mediumSlateBlue: "#8246FA",
        offPurple: "#745E9D",
        pythPurple: "#7142CF",
        transparent: "transparent",
      },
      container: {
        center: true,
        padding: {
          DEFAULT: "1rem",
          lg: "2rem",
          xl: "3.5rem",
        },
        screens: {
          lg: "984px",
          md: "728px",
          sm: "600px",
          xl: "1272px",
        },
      },
      fontSize: {
        base: ["14px", "22px"],
        base16: ["16px", "24px"],
        base18: ["18px", "1"],
        lg: ["24px", "30px"],
        sm: ["13px", "1"],
        xl: ["59px", "1.1"],
        xs: ["12px", "1"],
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      letterSpacing: {
        subtitle: ".15em",
        wide: ".02em",
      },
    },
    fontFamily: {
      arboria: "arboria, sans-serif",
      body: "Urbanist, sans-serif",
      inter: "inter, sans-serif",
      mono: "IBM Plex Mono, monospace",
      poppins: "poppins, sans-serif",
      roboto: "roboto, sans-serif",
      robotoMono: "roboto-mono, monospace",
    },
    screens: {
      // => @media (min-width: 1280px) { ... }

      "2xl": "1536px",
      // => @media (min-width: 1536px) { ... }

      hoverable: { raw: "(hover: hover)" },
      // => @media (min-width: 768px) { ... }

      lg: "992px",
      // => @media (min-width: 640px) { ... }

      md: "768px",
      // => @media (min-width: 375px) { ... }

      sm: "640px",
      // => @media (min-width: 992px) { ... }

      xl: "1280px",
      xs: "375px",
    },
  },
};
