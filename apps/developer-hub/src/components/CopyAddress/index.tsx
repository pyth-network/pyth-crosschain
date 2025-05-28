"use client";

import { CopyButton } from "@pythnetwork/component-library/CopyButton";

import TruncateToMiddle from "../TruncateToMiddle";

const CopyAddress = ({ address, url }: { address: string; url?: string }) => {
  return Boolean(url) ? (
    <form>
      <CopyButton text={address} formAction={url as string} type="submit">
        <TruncateToMiddle text={address} />
      </CopyButton>
    </form>
  ) : (
    <CopyButton text={address}>
      <TruncateToMiddle text={address} />
    </CopyButton>
  );
};

export default CopyAddress;
