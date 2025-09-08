"use client";

import { CopyButton } from "@pythnetwork/component-library/CopyButton";
import { Link } from "@pythnetwork/component-library/Link";

import styles from "./index.module.scss";

const CopyAddress = ({ address, url }: { address: string; url?: string }) => {
  return url ? (
    <div className={styles.address}>
      <Link href={url} target="_blank" rel="noreferrer">
        {address}
      </Link>
      <CopyButton text={address} iconOnly />
    </div>
  ) : (
    <CopyButton text={address}>{address}</CopyButton>
  );
};

export default CopyAddress;
