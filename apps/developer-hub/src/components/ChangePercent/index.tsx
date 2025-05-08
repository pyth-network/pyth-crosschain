import type { ComponentProps } from "react";

import { omitKeys } from "../../omit-keys";
import { ChangeValue } from "../ChangeValue";
import { FormattedNumber } from "../FormattedNumber";

type PriceDifferenceProps = Omit<
  ComponentProps<typeof ChangeValue>,
  "children" | "direction" | "isLoading"
> & {
  className?: string | undefined;
} & (
    | { isLoading: true }
    | {
        isLoading?: false;
        currentValue: number;
        previousValue: number;
      }
  );

export const ChangePercent = (props: PriceDifferenceProps) =>
  props.isLoading ? (
    <ChangeValue {...props} />
  ) : (
    <ChangeValue
      direction={getDirection(props.currentValue, props.previousValue)}
      {...omitKeys(props, ["currentValue", "previousValue"])}
    >
      <FormattedNumber
        maximumFractionDigits={2}
        value={
          (100 * Math.abs(props.currentValue - props.previousValue)) /
          props.previousValue
        }
      />
      %
    </ChangeValue>
  );

const getDirection = (currentValue: number, previousValue: number) => {
  if (currentValue < previousValue) {
    return "down";
  } else if (currentValue > previousValue) {
    return "up";
  } else {
    return "flat";
  }
};
