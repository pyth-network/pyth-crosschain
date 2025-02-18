type Props = {
  assetClass?: string | undefined;
  uppercase?: boolean | undefined;
  plural?: boolean | undefined;
};

export const PriceName = ({ assetClass, uppercase, plural }: Props) =>
  getLabels(assetClass)[plural ? "plural" : "singular"][
    uppercase ? "upcase" : "title"
  ];

const getLabels = (assetClass?: string | undefined) => {
  if (assetClass === undefined) {
    return LABELS.ambiguous;
  } else {
    return assetClass in LABELS
      ? LABELS[assetClass as keyof typeof LABELS]
      : LABELS.default;
  }
};

const LABELS = {
  Rates: {
    plural: {
      upcase: "YIELDS",
      title: "Yields",
    },
    singular: {
      upcase: "YIELD",
      title: "Yield",
    },
  },
  ambiguous: {
    plural: {
      upcase: "PRICES / YIELDS",
      title: "Prices / Yields",
    },
    singular: {
      upcase: "PRICE / YIELD",
      title: "Price / Yield",
    },
  },
  default: {
    plural: {
      upcase: "PRICES",
      title: "Prices",
    },
    singular: {
      upcase: "PRICE",
      title: "Price",
    },
  },
};
