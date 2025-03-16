"use client";

import { ArrowPathIcon } from "@heroicons/react/24/outline";
import PythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json";
import PythErrorsAbi from "@pythnetwork/pyth-sdk-solidity/abis/PythErrors.json";
import { ConnectKitButton, Avatar } from "connectkit";
import { useCallback, useMemo, useState } from "react";
import { ContractFunctionExecutionError } from "viem";
import { useAccount, useConfig } from "wagmi";
import { readContract, simulateContract, writeContract } from "wagmi/actions";

import type { Parameter } from "./parameter";
import { TRANSFORMS } from "./parameter";
import { getContractAddress } from "../../evm-networks";
import { useIsMounted } from "../../use-is-mounted";
import { Button } from "../Button";
import { Code } from "../Code";
import { InlineLink } from "../InlineLink";

const abi = [...PythAbi, ...PythErrorsAbi] as const;

type RunButtonProps<ParameterName extends string> = (
  | Read
  | Write<ParameterName>
) & {
  functionName: (typeof PythAbi)[number]["name"];
  parameters: Parameter<ParameterName>[];
  paramValues: Partial<Record<ParameterName, string>>;
};

type Read = {
  type: EvmApiType.Read;
  valueParam?: undefined;
};

type Write<ParameterName extends string> = {
  type: EvmApiType.Write;
  valueParam: ParameterName;
};

export enum EvmApiType {
  Read,
  Write,
}

export const RunButton = <ParameterName extends string>(
  props: RunButtonProps<ParameterName>,
) => {
  const { isConnected } = useAccount();
  const isMounted = useIsMounted();
  const { status, run, disabled } = useRunButton(props);

  return (
    <>
      {props.type === EvmApiType.Write && (
        <ConnectKitButton.Custom>
          {({ show, isConnected, address, truncatedAddress, ensName }) => (
            <InlineLink
              as="button"
              onClick={show}
              className="mb-2 flex flex-row items-center justify-center gap-2"
            >
              {isConnected ? (
                <>
                  <Avatar address={address} size={24} />
                  <span>Wallet: {ensName ?? truncatedAddress}</span>
                </>
              ) : (
                "Connect Wallet to Run"
              )}
            </InlineLink>
          )}
        </ConnectKitButton.Custom>
      )}
      {(props.type === EvmApiType.Read || (isMounted && isConnected)) && (
        <Button
          disabled={disabled}
          loading={status.type === StatusType.Loading}
          className="mb-8 flex h-10 w-full flex-row items-center justify-center gap-2"
          onClick={run}
        >
          {status.type === StatusType.Loading ? (
            <ArrowPathIcon className="size-4 animate-spin" />
          ) : (
            "Run"
          )}
        </Button>
      )}
      {status.type === StatusType.Results && (
        <div>
          <h3 className="mb-2 text-lg font-bold">Results</h3>
          {props.type === EvmApiType.Write &&
          status.data &&
          typeof status.data === "object" &&
          "hash" in status.data &&
          typeof status.data.hash === "string" ? (
            <>
              <p>{`Tx Hash: ${status.data.hash}`}</p>
              {"link" in status.data &&
                typeof status.data.link === "string" && (
                  <InlineLink
                    href={status.data.link}
                    target="_blank"
                    className="text-sm text-blue-500 hover:underline"
                  >
                    Open in explorer↗
                  </InlineLink>
                )}
            </>
          ) : (
            <Code language="json">{stringifyResponse(status.data)}</Code>
          )}
        </div>
      )}
      {status.type === StatusType.Error && (
        <div>
          <h3 className="mb-2 text-lg font-bold">Error</h3>
          <div className="relative overflow-hidden rounded-md bg-neutral-100/25 dark:bg-neutral-800">
            <div className="flex size-full overflow-auto px-6 py-4">
              <p className="font-mono text-sm font-medium text-red-600 dark:text-red-400">
                {showError(status.error)}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const useRunButton = <ParameterName extends string>({
  functionName,
  parameters,
  paramValues,
  ...props
}: RunButtonProps<ParameterName>) => {
  const config = useConfig();
  const [status, setStatus] = useState<Status>(None());

  const args = useMemo(() => {
    const allParams =
      props.type === EvmApiType.Write
        ? parameters.filter((parameter) => parameter.name !== props.valueParam)
        : parameters;
    const orderedParams = allParams.map(({ name, type }) => {
      const transform = TRANSFORMS[type];
      const value = paramValues[name];
      return transform && value ? transform(value) : value;
    });
    return orderedParams.every((value) => value !== undefined)
      ? orderedParams
      : undefined;
  }, [parameters, paramValues, props]);

  const value = useMemo(() => {
    if (props.type === EvmApiType.Write) {
      const value = paramValues[props.valueParam];
      return value ? BigInt(value) : undefined;
    } else {
      return;
    }
  }, [paramValues, props]);

  const run = useCallback(() => {
    setStatus(Loading());
    if (args === undefined) {
      setStatus(ErrorStatus(new Error("Invalid parameters!")));
    } else {
      const address = getContractAddress(config.state.chainId);
      if (!address) {
        throw new Error(
          `No contract for chain id: ${config.state.chainId.toString()}`,
        );
      }
      switch (props.type) {
        case EvmApiType.Read: {
          readContract(config, { abi, address, functionName, args })
            .then((result) => {
              setStatus(Results(result));
            })
            .catch((error: unknown) => {
              setStatus(ErrorStatus(error));
            });
          return;
        }
        case EvmApiType.Write: {
          if (value === undefined) {
            setStatus(ErrorStatus(new Error("Missing value!")));
          } else {
            simulateContract(config, {
              abi,
              address,
              functionName,
              args,
              value,
            })
              .then(({ request }) => writeContract(config, request))
              .then((result) => {
                const explorer = config.chains.find(
                  (chain) => chain.id === config.state.chainId,
                )?.blockExplorers?.default;
                setStatus(
                  Results({
                    hash: result,
                    link: explorer
                      ? new URL(`/tx/${result}`, explorer.url).toString()
                      : undefined,
                  }),
                );
              })
              .catch((error: unknown) => {
                setStatus(ErrorStatus(error));
              });
          }
          return;
        }
      }
    }
  }, [config, functionName, setStatus, args, value, props.type]);

  const { isConnected } = useAccount();

  const disabled = useMemo(
    () =>
      args === undefined ||
      status.type === StatusType.Loading ||
      (props.type === EvmApiType.Write &&
        (!isConnected || value === undefined)),
    [args, status, props, isConnected, value],
  );

  return { status, run, disabled };
};

enum StatusType {
  None,
  Loading,
  Error,
  Results,
}

const None = () => ({ type: StatusType.None as const });
const Loading = () => ({ type: StatusType.Loading as const });
const ErrorStatus = (error: unknown) => ({
  type: StatusType.Error as const,
  error,
});
const Results = (data: unknown) => ({
  type: StatusType.Results as const,
  data,
});

type Status =
  | ReturnType<typeof None>
  | ReturnType<typeof Loading>
  | ReturnType<typeof ErrorStatus>
  | ReturnType<typeof Results>;

const showError = (error: unknown): string => {
  if (typeof error === "string") {
    return error;
  } else if (error instanceof ContractFunctionExecutionError) {
    return error.cause.metaMessages?.[0] ?? error.message;
  } else if (error instanceof Error) {
    return error.toString();
  } else {
    return "An unknown error occurred";
  }
};

const stringifyResponse = (response: unknown): string => {
  switch (typeof response) {
    case "string": {
      return `"${response}"`;
    }
    case "number":
    case "boolean":
    case "function": {
      return response.toString();
    }
    case "bigint": {
      return `${response.toString()}n`;
    }
    case "symbol": {
      return `Symbol(${response.toString()})`;
    }
    case "undefined": {
      return "undefined";
    }
    case "object": {
      return response === null
        ? "null"
        : `{\n${Object.entries(response)
            .map(([key, value]) => `    ${key}: ${stringifyResponse(value)}`)
            .join(",\n")}\n}`;
    }
  }
};
