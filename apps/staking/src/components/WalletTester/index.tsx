"use client";

import type { Idl } from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { WalletIcon } from "@heroicons/react/24/outline";
import type { PythStakingWallet } from "@pythnetwork/staking-sdk";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  PublicKey,
  Connection,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import type { ComponentProps } from "react";
import { useCallback } from "react";

import WalletTesterIDL from "./wallet-tester-idl.json";
import { StateType as ApiStateType, useApi } from "../../hooks/use-api";
import {
  useAsync,
  StateType as UseAsyncStateType,
} from "../../hooks/use-async";
import { useData, StateType as UseDataStateType } from "../../hooks/use-data";
import { useNetwork } from "../../hooks/use-network";
import { useToast } from "../../hooks/use-toast";
import { Button } from "../Button";
import { Switch } from "../Switch";

export const WalletTester = () => (
  <div className="grid size-full place-content-center">
    <div className="w-96 border border-neutral-600 p-10">
      <h1 className="mb-4 text-2xl font-medium text-neutral-300">
        Wallet Tester
      </h1>
      <WalletTesterContents />
    </div>
  </div>
);

const WalletTesterContents = () => {
  const api = useApi();

  switch (api.type) {
    case ApiStateType.WalletConnecting:
    case ApiStateType.WalletDisconnecting: {
      return <ConnectWallet isLoading />;
    }

    case ApiStateType.NoWallet: {
      return <ConnectWallet />;
    }

    case ApiStateType.NotLoaded:
    case ApiStateType.ErrorLoadingStakeAccounts:
    case ApiStateType.Loaded:
    case ApiStateType.LoadedNoStakeAccount:
    case ApiStateType.LoadingStakeAccounts: {
      return <WalletConnected wallet={api.wallet} />;
    }
  }
};

const ConnectWallet = ({ isLoading }: { isLoading?: boolean | undefined }) => {
  const modal = useWalletModal();
  const showModal = useCallback(() => {
    modal.setVisible(true);
  }, [modal]);
  const { isMainnet, toggleMainnet } = useNetwork();

  return (
    <>
      <Description className="mb-10 text-neutral-400">
        Please connect your wallet to get started.
      </Description>
      <div className="flex flex-col items-center gap-4">
        <Button
          className="px-10 py-4"
          size="nopad"
          isLoading={isLoading}
          {...(!isLoading && { onPress: showModal })}
        >
          {isLoading ? (
            "Loading..."
          ) : (
            <>
              <WalletIcon className="size-4" />
              <div>Connect wallet</div>
            </>
          )}
        </Button>
        <Switch
          isSelected={isMainnet}
          postLabel="Mainnet"
          preLabel="Devnet"
          className="px-4 py-1"
          size="small"
          onChange={toggleMainnet}
        />
      </div>
    </>
  );
};

const WalletConnected = ({ wallet }: { wallet: PythStakingWallet }) => {
  const { connection } = useConnection();

  const testedStatus = useData(
    ["wallet-tested", wallet.publicKey.toString()],
    () => getHasAlreadyTested(connection, wallet),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  switch (testedStatus.type) {
    case UseDataStateType.NotLoaded:
    case UseDataStateType.Loading: {
      return <Description>Loading...</Description>;
    }
    case UseDataStateType.Error: {
      return (
        <Description>
          Uh oh, we ran into an issue while checking if your wallet has been
          tested. Please reload and try again.
        </Description>
      );
    }
    case UseDataStateType.Loaded: {
      return testedStatus.data.hasTested ? (
        <p className="text-green-600">
          Your wallet has already been tested succesfully!
        </p>
      ) : (
        <Tester wallet={wallet} />
      );
    }
  }
};

const Tester = ({ wallet }: { wallet: PythStakingWallet }) => {
  const toast = useToast();
  const { connection } = useConnection();
  const { state, execute } = useAsync(() => testWallet(connection, wallet));
  const doTest = useCallback(() => {
    execute()
      .then(() => {
        toast.success("Successfully tested wallet, thank you!");
      })
      .catch((error: unknown) => {
        toast.error(error);
      });
  }, [execute, toast]);

  switch (state.type) {
    case UseAsyncStateType.Base:
    case UseAsyncStateType.Error:
    case UseAsyncStateType.Running: {
      return (
        <>
          <Description>
            Please click the button below and accept the transaction in your
            wallet to test the browser wallet compatibility. You will need 0.001
            SOL.
          </Description>
          <div className="flex justify-center">
            <Button
              className="px-10 py-4"
              size="nopad"
              {...(state.type === UseAsyncStateType.Running
                ? { isLoading: true }
                : { onPress: doTest })}
            >
              Click to test
            </Button>
          </div>
          {state.type === UseAsyncStateType.Error && (
            <p className="mt-4 text-red-600">
              Uh oh, an error occurred! Please try again
            </p>
          )}
        </>
      );
    }
    case UseAsyncStateType.Complete: {
      return (
        <p className="text-green-600">
          Your wallet has been tested succesfully!
        </p>
      );
    }
  }
};

const getHasAlreadyTested = async (
  connection: Connection,
  wallet: PythStakingWallet,
) => {
  const receiptAddress = PublicKey.findProgramAddressSync(
    [wallet.publicKey.toBytes()],
    new PublicKey(WalletTesterIDL.address),
  )[0];
  const receipt = await connection.getAccountInfo(receiptAddress);
  return { hasTested: receipt !== null };
};

const testWallet = async (
  connection: Connection,
  wallet: PythStakingWallet,
) => {
  const walletTester = new Program(
    WalletTesterIDL as Idl,
    new AnchorProvider(connection, wallet),
  );
  const testMethod = walletTester.methods.test;
  if (testMethod) {
    const instruction = await testMethod().instruction();
    const { blockhash } = await connection.getLatestBlockhash({
      commitment: "confirmed",
    });
    const transaction = new VersionedTransaction(
      new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions: [instruction],
      }).compileToV0Message(),
    );
    await wallet.sendTransaction(transaction, connection);
  } else {
    throw new Error("No test method found in program");
  }
};

const Description = (props: ComponentProps<"p">) => (
  <p className="mb-10 text-neutral-400" {...props} />
);
