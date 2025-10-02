"use client";

import { Clock } from "@phosphor-icons/react/dist/ssr/Clock";
import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle";
import clsx from "clsx";
import type { ComponentProps } from "react";
import {
  TimeField as BaseTimeField,
  DateInput,
  Label,
} from "react-aria-components";

import styles from "./index.module.scss";
import { Button } from "../unstyled/Button/index.jsx";

type Props = Omit<ComponentProps<typeof BaseTimeField>, "children"> & {
  label: string;
  hideLabel?: boolean | undefined;
  onClear?: (() => void) | undefined;
};

export const TimeField = ({
  className,
  label,
  hideLabel,
  onClear,
  ...props
}: Props) => (
  <BaseTimeField
    className={clsx(styles.timeField, className)}
    data-label-hidden={hideLabel ? "" : undefined}
    hourCycle={24}
    {...props}
  >
    <Label className={styles.label}>{label}</Label>
    <div className={styles.inputWrapper}>
      <Clock className={styles.icon} />
      <DateInput className={styles.input ?? ""}>
        {(segment) => (
          <div
            className={styles.segment}
            data-placeholder={segment.isPlaceholder ? "" : undefined}
            data-type={segment.type}
          >
            {segment.text}
          </div>
        )}
      </DateInput>
      {onClear && (
        <Button className={styles.clearButton ?? ""} onPress={onClear}>
          <XCircle weight="fill" className={styles.clearIcon} />
        </Button>
      )}
    </div>
  </BaseTimeField>
);


