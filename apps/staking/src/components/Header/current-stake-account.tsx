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
    <div className={clsx("grid place-content-center", className)} {...props}>
      <div className="flex flex-col items-end text-xs md:flex-row md:items-baseline md:text-sm">
        <div className="font-semibold">Stake account:</div>
        <CopyButton
          text={api.account.address.toBase58()}
          className="-mr-2 ml-2 text-pythpurple-400 md:mr-0"
        >
          <TruncatedKey>{api.account.address}</TruncatedKey>
        </CopyButton>
      </div>
    </div>
  ) : // eslint-disable-next-line unicorn/no-null
  null;
};
