import alenoColor from "./icons/color/aleno.svg";
import finazonColor from "./icons/color/finazon.svg";
import lotechColor from "./icons/color/lotech.svg";
import nobiColor from "./icons/color/nobi.svg";
import orcaColor from "./icons/color/orca.svg";
import sentioColor from "./icons/color/sentio.svg";
import wooColor from "./icons/color/woo.svg";
import amberDark from "./icons/dark/amber.svg";
import ltpDark from "./icons/dark/ltp.svg";
import amberLight from "./icons/light/amber.svg";
import ltpLight from "./icons/light/ltp.svg";
import alenoMonochrome from "./icons/monochrome/aleno.svg";
import alphanonce from "./icons/monochrome/alphanonce.svg";
import amberMonochrome from "./icons/monochrome/amber.svg";
import blocksize from "./icons/monochrome/blocksize.svg";
import elfomo from "./icons/monochrome/elfomo.svg";
import finazonMonochrome from "./icons/monochrome/finazon.svg";
import gluex from "./icons/monochrome/gluex.svg";
import kronosResearchMonochrome from "./icons/monochrome/kronos-research.svg";
import lotechMonochrome from "./icons/monochrome/lotech.svg";
import ltpMonochrome from "./icons/monochrome/ltp.svg";
import nobiMonochrome from "./icons/monochrome/nobi.svg";
import orcaMonochrome from "./icons/monochrome/orca.svg";
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
  J5tVeMzhJf5EWH2Y8fNiREpmBaBEhUxVk9evcWBmkcNT: {
    name: "Orca",
    icon: {
      color: orcaColor,
      monochrome: orcaMonochrome,
    },
  },
  EJT2CiSFR84yoVtqfB1LVC79MSS1wyZggaV6LHJB5nS2: {
    name: "Aleno",
    icon: {
      color: alenoColor,
      monochrome: alenoMonochrome,
    },
  },
  "2mTD1b3ZG3YL86DgnPm4hwEQQZPej8D6Vb4pRso1RFJi": {
    name: "Alphanonce",
    icon: {
      monochrome: alphanonce,
    },
  },
  "7YQg8Tz9KHKsg7yHiAFRBsDkLoKvZbMXt7VbW44F7QM": {
    name: "LO:TECH",
    icon: {
      monochrome: lotechMonochrome,
      color: lotechColor,
    },
  },
  "6DNocjFJjocPLZnKBZyEJAC5o2QaiT5Mx8AkphfxDm5i": {
    name: "NOBI Labs",
    icon: {
      monochrome: nobiMonochrome,
      color: nobiColor,
    },
  },
  A7ULyKhnyCW3yfSNCiHCt7gUEMVwYBeRdgYKV1BRYPVH: {
    name: "Kronos Research",
    icon: {
      monochrome: kronosResearchMonochrome,
    },
  },
  "2ehFijXkacypZL4jdfPm38BJnMKsN2nMHm8xekbujjdx": {
    name: "Amber Group",
    icon: {
      monochrome: amberMonochrome,
      dark: amberDark,
      light: amberLight,
    },
  },
} as const;

export const lookup = (value: string) =>
  value in knownPublishers
    ? knownPublishers[value as keyof typeof knownPublishers]
    : undefined;
