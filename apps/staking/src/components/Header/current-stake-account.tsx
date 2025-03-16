"use client";

import clsx from "clsx";
import { useSelectedLayoutSegment } from "next/navigation";
import type { HTMLProps } from "react";

import { VPN_BLOCKED_SEGMENT } from "../../config/isomorphic";
import { StateType as ApiStateType, useApi } from "../../hooks/use-api";
import { CopyButton } from "../CopyButton";
import { TruncatedKey } from "../TruncatedKey";

export const CurrentStakeAccount = ({
  className,
  ...props
}: HTMLProps<HTMLDivElement>) => {
  const segment = useSelectedLayoutSegment();
  const isBlocked = segment === VPN_BLOCKED_SEGMENT;
  const api = useApi();

  return api.type === ApiStateType.Loaded && !isBlocked ? (
    <div
      className={clsx(
        "hidden flex-col items-end justify-center text-xs xs:flex 2xl:flex-row 2xl:items-center 2xl:text-sm",
        className,
      )}
      {...props}
    >
      <div className="font-semibold">Stake account:</div>
      <CopyButton
        text={api.account.toBase58()}
        className="text-pythpurple-400 2xl:ml-2 2xl:mr-0"
      >
        <TruncatedKey>{api.account}</TruncatedKey>
      </CopyButton>
    </div>
  ) : // eslint-disable-next-line unicorn/no-null
  null;
};
