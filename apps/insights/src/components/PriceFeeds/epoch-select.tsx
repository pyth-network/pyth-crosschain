"use client";

import { CalendarDots } from "@phosphor-icons/react/dist/ssr/CalendarDots";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { Button } from "@pythnetwork/component-library/Button";
import { Select } from "@pythnetwork/component-library/Select";

import styles from "./epoch-select.module.scss";

export const EpochSelect = () => (
  <div className={styles.epochSelect}>
    <Button variant="outline" size="sm" beforeIcon={CaretLeft} hideText>
      Previous Epoch
    </Button>
    <Select
      variant="outline"
      size="sm"
      icon={CalendarDots}
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
