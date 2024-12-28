"use client";

import { Switch } from "@pythnetwork/component-library/Switch";
import { type ComponentProps, useState, useMemo } from "react";

import { PriceComponentsCard } from "../PriceComponentsCard";

type OwnProps = {
  priceComponents: (ComponentProps<
    typeof PriceComponentsCard
  >["priceComponents"][number] & {
    isTest: boolean;
  })[];
};

type Props = Omit<ComponentProps<typeof PriceComponentsCard>, keyof OwnProps> &
  OwnProps;

export const PublishersCard = ({ priceComponents, ...props }: Props) => {
  const [includeTestComponents, setIncludeTestComponents] = useState(false);

  const filteredPriceComponents = useMemo(
    () =>
      includeTestComponents
        ? priceComponents
        : priceComponents.filter((component) => !component.isTest),
    [includeTestComponents, priceComponents],
  );

  return (
    <PriceComponentsCard
      priceComponents={filteredPriceComponents}
      toolbar={
        <Switch
          isSelected={includeTestComponents}
          onChange={setIncludeTestComponents}
        >
          Show test components
        </Switch>
      }
      {...props}
    />
  );
};
