import finazonColor from "./icons/color/finazon.svg";
import sentioColor from "./icons/color/sentio.svg";
import wooColor from "./icons/color/woo.svg";
import ltpDark from "./icons/dark/ltp.svg";
import ltpLight from "./icons/light/ltp.svg";
import blocksize from "./icons/monochrome/blocksize.svg";
import elfomo from "./icons/monochrome/elfomo.svg";
import finazonMonochrome from "./icons/monochrome/finazon.svg";
import gluex from "./icons/monochrome/gluex.svg";
import ltpMonochrome from "./icons/monochrome/ltp.svg";
import sentioMonochrome from "./icons/monochrome/sentio.svg";
import wooMonochrome from "./icons/monochrome/woo.svg";

export const knownPublishers = {
  CfVkYofcLC1iVBcYFzgdYPeiX25SVRmWvBQVHorP1A3y: {
    name: "BLOCKSIZE",
    icon: {
      monochrome: blocksize,
    },
  },
  "89ijemG1TUL2kdV2RtCrhXzY5QhyKHsWqCmP5iobvLUF": {
    name: "Sentio",
    icon: {
      monochrome: sentioMonochrome,
      color: sentioColor,
    },
  },
  Fq5zaoF76WYshMEYUn1q8cB8MrG61swhaWHRUCWeP5Vo: {
    name: "Finazon",
    icon: {
      monochrome: finazonMonochrome,
      color: finazonColor,
    },
  },
  "5giNPEh9PytXcnKNgufofmQPdS4jHoySgFpiu8f7QxP4": {
    name: "Elfomo",
    icon: {
      monochrome: elfomo,
    },
  },
  DANa2ZYtyUcSW8W8C25ZfscKdBra53npt2frmh7fUucf: {
    name: "WOO",
    icon: {
      monochrome: wooMonochrome,
      color: wooColor,
    },
  },
  GUcFC3NBuVSf9rdQqW3t2sBcP6sEp269rtPxxGyvAHoM: {
    name: "LTP",
    icon: {
      monochrome: ltpMonochrome,
      dark: ltpDark,
      light: ltpLight,
    },
  },
  "7JZm3iUVZTVTnK1Z6XqCGxUY51w1j3XkHAkA2rNpPGCo": {
    name: "GlueX Protocol",
    icon: {
      monochrome: gluex,
    },
  },
} as const;

export const lookup = (value: string) =>
  value in knownPublishers
    ? knownPublishers[value as keyof typeof knownPublishers]
    : undefined;
