"use client";

import { ArrowPathIcon } from "@heroicons/react/24/outline";
import PythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json";
import PythErrorsAbi from "@pythnetwork/pyth-sdk-solidity/abis/PythErrors.json";
import { ConnectKitButton, Avatar } from "connectkit";
import { useCallback, useMemo, useState } from "react";
import { useAccount, useConfig } from "wagmi";
import { readContract, simulateContract, writeContract } from "wagmi/actions";

import { getContractAddress } from "./networks";
import { type Parameter, TRANSFORMS } from "./parameter";
import { type ModalContents, ResultsModal } from "./results-modal";
import { useIsMounted } from "../../use-is-mounted";
import { Button } from "../Button";
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
  const {
    status,
    modalContents,
    resetStatus,
    clearModalContents,
    run,
    disabled,
  } = useRunButton(props);

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
          loading={status === Status.Loading}
          className="flex h-10 w-full flex-row items-center justify-center gap-2"
          onClick={run}
        >
          {status === Status.Loading ? (
            <ArrowPathIcon className="size-4 animate-spin" />
          ) : (
            "Run"
          )}
        </Button>
      )}
      <ResultsModal
        modalContents={modalContents}
        isShowingResults={status === Status.ShowingResults}
        resetStatus={resetStatus}
        clearModalContents={clearModalContents}
        functionName={props.functionName}
      />
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
  const [status, setStatus] = useState<Status>(Status.None);
  const [modalContents, setModalContents] = useState<
    ModalContents<ParameterName> | undefined
  >(undefined);

  const resetStatus = useCallback(() => {
    setStatus(Status.None);
  }, [setStatus]);
  const clearModalContents = useCallback(() => {
    setModalContents(undefined);
  }, [setModalContents]);

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
    setStatus(Status.Loading);
    const networkName =
      config.chains.find((chain) => chain.id === config.state.chainId)?.name ??
      "";
    if (args === undefined) {
      setModalContents({
        error: new Error("Invalid parameters!"),
        networkName,
      });
      setStatus(Status.ShowingResults);
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
              setModalContents({
                result,
                parameters: paramValues,
                networkName,
              });
            })
            .catch((error: unknown) => {
              setModalContents({
                error,
                parameters: paramValues,
                networkName,
              });
            })
            .finally(() => {
              setStatus(Status.ShowingResults);
            });
          return;
        }
        case EvmApiType.Write: {
          if (value === undefined) {
            setModalContents({
              error: new Error("Missing value!"),
              networkName,
            });
            setStatus(Status.ShowingResults);
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
                setModalContents({
                  result,
                  parameters: paramValues,
                  networkName,
                });
              })
              .catch((error: unknown) => {
                setModalContents({
                  error,
                  parameters: paramValues,
                  networkName,
                });
              })
              .finally(() => {
                setStatus(Status.ShowingResults);
              });
          }
          return;
        }
      }
    }
  }, [config, functionName, setStatus, args, paramValues, value, props.type]);

  const { isConnected } = useAccount();

  const disabled =
    args === undefined ||
    status !== Status.None ||
    (props.type === EvmApiType.Write && (!isConnected || value === undefined));

  return {
    status,
    modalContents,
    resetStatus,
    clearModalContents,
    run,
    disabled,
  };
};

enum Status {
  None,
  Loading,
  ShowingResults,
}
