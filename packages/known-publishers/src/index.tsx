import finazonColor from "./icons/color/finazon.svg";
import sentioColor from "./icons/color/sentio.svg";
import blocksize from "./icons/monochrome/blocksize.svg";
import elfomo from "./icons/monochrome/elfomo.svg";
import finazonMonochrome from "./icons/monochrome/finazon.svg";
import sentioMonochrome from "./icons/monochrome/sentio.svg";

export const knownPublishers = {
  CfVkYofcLC1iVBcYFzgdYPeiX25SVRmWvBQVHorP1A3y: {
    name: "BLOCKSIZE",
    icon: {
      monochrome: blocksize,
      color: blocksize,
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
      color: elfomo,
    },
  },
};

export const lookup = (value: string) =>
  value in knownPublishers
    ? knownPublishers[value as keyof typeof knownPublishers]
    : undefined;
