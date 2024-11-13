"use client";

import {
  CaretLeft,
  CaretRight,
  CalendarDots,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@pythnetwork/component-library/Button";
import { Select } from "@pythnetwork/component-library/Select";

export const EpochSelect = () => (
  <div className="flex flex-row items-center gap-2">
    <Button variant="outline" size="sm" beforeIcon={CaretLeft} hideText>
      Previous Epoch
    </Button>
    <Select
      variant="outline"
      size="sm"
      beforeIcon={CalendarDots}
      options={["27 Oct – 3 Nov"]}
      selectedKey="27 Oct – 3 Nov"
      label="Epoch"
      hideLabel
      onSelectionChange={() => {
        /* no-op */
      }}
    />
    <Button
      variant="outline"
      size="sm"
      beforeIcon={CaretRight}
      hideText
      isDisabled
    >
      Next Epoch
    </Button>
  </div>
);
