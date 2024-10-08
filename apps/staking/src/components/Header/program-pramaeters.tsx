import type { ComponentProps, ReactNode } from "react";

import type { StateType, States } from "../../hooks/use-api";
import { StateType as DataStateType, useData } from "../../hooks/use-data";
import { tokensToString } from "../../tokens";
import { Link } from "../Link";
import { ModalDialog } from "../ModalDialog";
import { Tokens } from "../Tokens";

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * ONE_SECOND_IN_MS;
const REFRESH_INTERVAL = 1 * ONE_MINUTE_IN_MS;

type Props = Omit<ComponentProps<typeof ModalDialog>, "title" | "children"> & {
  api: States[StateType.Loaded] | States[StateType.LoadedNoStakeAccount];
};

export const ProgramParameters = ({ api, ...props }: Props) => {
  const data = useData(api.dashboardDataCacheKey, api.loadData, {
    refreshInterval: REFRESH_INTERVAL,
  });

  return (
    <ModalDialog
      title="Program Parameters"
      description={
        <>
          See the current program parameters. For more details, see{" "}
          <Link
            href="https://docs.pyth.network/home/oracle-integrity-staking/mathematical-representation"
            className="underline"
            target="_blank"
          >
            the docs
          </Link>
        </>
      }
      {...props}
    >
      <ul className="mb-4 mt-8 flex flex-col gap-4 sm:mb-8 sm:mt-16">
        <Parameter
          value={
            data.type === DataStateType.Loaded ? (
              <Tokens>{data.data.m}</Tokens>
            ) : (
              <Loading />
            )
          }
          variable="M"
        >
          A constant parameter representing the target stake per symbol
        </Parameter>
        <Parameter
          value={
            data.type === DataStateType.Loaded ? (
              data.data.z.toString()
            ) : (
              <Loading />
            )
          }
          variable="Z"
        >
          A constant parameter to control cap contribution from symbols with a
          low number of publishers
        </Parameter>
        <Parameter
          value={
            data.type === DataStateType.Loaded ? (
              `${tokensToString(data.data.yieldRate * 100n)}% / epoch`
            ) : (
              <Loading />
            )
          }
          variable="y"
        >
          The cap to the rate of rewards for any pool
        </Parameter>
      </ul>
    </ModalDialog>
  );
};

type ParameterProps = {
  value: ReactNode;
  variable: ReactNode;
  children: ReactNode;
};

const Parameter = ({ variable, value, children }: ParameterProps) => (
  <li className="relative rounded-md bg-white/5 p-5">
    <div className="absolute right-2 top-2 grid size-6 place-content-center rounded-md bg-pythpurple-100 text-center text-sm font-semibold text-pythpurple-950">
      {variable}
    </div>
    <div className="mb-2 text-2xl font-semibold leading-none">{value}</div>
    <p className="max-w-sm text-sm opacity-60">{children}</p>
  </li>
);

const Loading = () => (
  <div className="h-6 w-10 animate-pulse rounded-md bg-white/30" />
);
