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
  ambiguous: {
    plural: {
      title: "Prices / Rates",
      upcase: "PRICES / RATES",
    },
    singular: {
      title: "Price / Rate",
      upcase: "PRICE / RATE",
    },
  },
  default: {
    plural: {
      title: "Prices",
      upcase: "PRICES",
    },
    singular: {
      title: "Price",
      upcase: "PRICE",
    },
  },
  Rates: {
    plural: {
      title: "Rates",
      upcase: "RATES",
    },
    singular: {
      title: "Rate",
      upcase: "RATE",
    },
  },
};
