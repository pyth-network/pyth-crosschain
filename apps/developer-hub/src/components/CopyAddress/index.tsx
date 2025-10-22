"use client";

import { CopyButton } from "@pythnetwork/component-library/CopyButton";
import { Link } from "@pythnetwork/component-library/Link";
import { useMemo } from "react";

import styles from "./index.module.scss";

const truncate = (value: string, maxLength?: number) => {
  if (!maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...${value.slice(-maxLength)}`;
};

const CopyAddress = ({
  address,
  maxLength,
  url,
}: {
  address: string;
  maxLength?: number;
  url?: string;
}) => {
  const formattedAddress = useMemo(
    () => truncate(address, maxLength),
    [address, maxLength],
  );

  return url ? (
    <div className={styles.address}>
      <Link href={url} target="_blank" rel="noreferrer">
        {formattedAddress}
      </Link>
      <CopyButton text={address} iconOnly />
    </div>
  ) : (
    <CopyButton text={address}>{formattedAddress}</CopyButton>
  );
};

export default CopyAddress;
