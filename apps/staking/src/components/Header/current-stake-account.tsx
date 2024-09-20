"use client";

import clsx from "clsx";
import { type HTMLProps } from "react";

import { StateType as ApiStateType, useApi } from "../../hooks/use-api";
import { CopyButton } from "../CopyButton";
import { TruncatedKey } from "../TruncatedKey";

export const CurrentStakeAccount = ({
  className,
  ...props
}: HTMLProps<HTMLDivElement>) => {
  const api = useApi();

  return api.type === ApiStateType.Loaded ? (
    <div
      className={clsx(
        "hidden flex-col items-end justify-center text-xs xs:flex md:flex-row md:items-center md:text-sm",
        className,
      )}
      {...props}
    >
      <div className="font-semibold">Stake account:</div>
      <CopyButton
        text={api.account.toBase58()}
        className="-mr-2 text-pythpurple-400 md:ml-2 md:mr-0"
      >
        <TruncatedKey>{api.account}</TruncatedKey>
      </CopyButton>
    </div>
  ) : // eslint-disable-next-line unicorn/no-null
  null;
};
