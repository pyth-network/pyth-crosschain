type Props = {
  assetClass?: string | undefined;
  uppercase?: boolean | undefined;
  plural?: boolean | undefined;
};

export const PriceName = ({ assetClass, uppercase, plural }: Props) =>
  getLabels(assetClass)[plural ? "plural" : "singular"][
    uppercase ? "upcase" : "title"
  ];

const getLabels = (assetClass?: string) => {
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
      upcase: "RATES",
      title: "Rates",
    },
    singular: {
      upcase: "RATE",
      title: "Rate",
    },
  },
  ambiguous: {
    plural: {
      upcase: "PRICES / RATES",
      title: "Prices / Rates",
    },
    singular: {
      upcase: "PRICE / RATE",
      title: "Price / Rate",
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
