"use client";

import type { Props as SelectProps } from "@pythnetwork/component-library/Select";
import { Select } from "@pythnetwork/component-library/Select";
import { ChainIcon } from "connectkit";
import type { ComponentProps } from "react";
import { Suspense, useCallback, useMemo } from "react";
import { useCollator } from "react-aria";
import * as viemChains from "viem/chains";

import styles from "./chain-select.module.scss";
import { useQuery } from "./use-query";
import { EntropyDeployments } from "../../entropy-deployments";
import type { ConstrainedOmit } from "../../type-utils";

export const ChainSelect = (
  props: ComponentProps<typeof ResolvedChainSelect>,
) => (
  <Suspense
    fallback={
      <Select
        {...defaultProps}
        {...props}
        isPending
        options={[]}
        defaultSelectedKey={undefined}
      />
    }
  >
    <ResolvedChainSelect {...props} />
  </Suspense>
);

type Deployment = ReturnType<typeof entropyDeploymentsByNetwork>[number];

const ResolvedChainSelect = (
  props: ConstrainedOmit<
    SelectProps<Deployment>,
    keyof typeof defaultProps | keyof ReturnType<typeof useResolvedProps>
  >,
) => {
  const resolvedProps = useResolvedProps();

  return <Select {...defaultProps} {...resolvedProps} {...props} />;
};

const useResolvedProps = () => {
  const collator = useCollator();
  const { chain, setChain } = useQuery();
  const chains = useMemo(
    () => [
      {
        name: "MAINNET",
        options: entropyDeploymentsByNetwork("mainnet", collator),
      },
      {
        name: "TESTNET",
        options: entropyDeploymentsByNetwork("testnet", collator),
      },
    ],
    [collator],
  );

  const showChain = useCallback(
    (chain: Deployment) => (
      <div className={styles.chainSelectItem}>
        <ChainIcon id={chain.chainId} />
        {chain.name}
      </div>
    ),
    [],
  );

  const chainTextValue = useCallback((chain: Deployment) => chain.name, []);

  return {
    selectedKey: chain ?? undefined,
    onSelectionChange: setChain,
    optionGroups: chains,
    show: showChain,
    textValue: chainTextValue,
  };
};

const defaultProps = {
  label: "Chain",
  hideLabel: true,
  defaultButtonLabel: "Select Chain",
} as const;

const entropyDeploymentsByNetwork = (
  network: "mainnet" | "testnet",
  collator: ReturnType<typeof useCollator>,
) =>
  Object.entries(EntropyDeployments)
    .map(([slug, chain]) => {
      // eslint-disable-next-line import/namespace
      const viemChain = viemChains[slug as keyof typeof EntropyDeployments];
      return {
        ...chain,
        name: viemChain.name,
        chainId: viemChain.id,
        id: slug as keyof typeof EntropyDeployments,
      };
    })
    .filter((chain) => chain.network === network)
    .toSorted((a, b) => collator.compare(a.name, b.name));
