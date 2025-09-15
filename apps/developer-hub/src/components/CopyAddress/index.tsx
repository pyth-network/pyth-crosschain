"use client";

import { CopyButton } from "@pythnetwork/component-library/CopyButton";
import { Link } from "@pythnetwork/component-library/Link";

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
  return url ? (
    <div className={styles.address}>
      <Link href={url} target="_blank" rel="noreferrer">
        {truncate(address, maxLength)}
      </Link>
      <CopyButton text={address} iconOnly />
    </div>
  ) : (
    <CopyButton text={address}>{truncate(address, maxLength)}</CopyButton>
  );
};

export default CopyAddress;
