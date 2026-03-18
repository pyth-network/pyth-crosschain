// biome-ignore-all lint/style/noNestedTernary: Complex conditional rendering is intentional
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable unicorn/no-nested-ternary */
/* eslint-disable @typescript-eslint/no-misused-promises */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable no-console */
import type { Wallet } from "@coral-xyz/anchor";
import type { PythCluster } from "@pythnetwork/client";
import { getPythProgramKeyForCluster } from "@pythnetwork/client";
import {
  sendTransactions,
  TransactionBuilder,
} from "@pythnetwork/solana-utils";
import type { MultisigInstruction } from "@pythnetwork/xc-admin-common";
import {
  AnchorMultisigInstruction,
  ExecutePostedVaa,
  getManyProposalsInstructions,
  getMultisigCluster,
  getProgramName,
  MultisigParser,
  PythMultisigInstruction,
  WormholeMultisigInstruction,
} from "@pythnetwork/xc-admin-common";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useWallet } from "@solana/wallet-adapter-react";
import type { AccountMeta, TransactionInstruction } from "@solana/web3.js";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import type SquadsMesh from "@sqds/mesh";
import type { MultisigAccount, TransactionAccount } from "@sqds/mesh/lib/types";
import type { ReactNode } from "react";
import { Fragment, useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ClusterContext } from "../../../contexts/ClusterContext";
import { useMultisigContext } from "../../../contexts/MultisigContext";
import { usePythContext } from "../../../contexts/PythContext";
import VerifiedIcon from "../../../images/icons/verified.inline.svg";
import VotedIcon from "../../../images/icons/voted.inline.svg";
import WarningIcon from "../../../images/icons/warning.inline.svg";
import { capitalizeFirstLetter } from "../../../utils/capitalizeFirstLetter";
import CopyText from "../../common/CopyText";
import Spinner from "../../common/Spinner";
import {
  ParsedAccountPubkeyRow,
  SignerTag,
  WritableTag,
} from "../../InstructionViews/AccountUtils";
import { getMappingCluster, isPubkey } from "../../InstructionViews/utils";
import { WormholeInstructionView } from "../../InstructionViews/WormholeInstructionView";
import Loadbar from "../../loaders/Loadbar";
import { InstructionsSummary } from "./InstructionsSummary";
import { StatusTag } from "./StatusTag";
import { getProposalStatus } from "./utils";

const IconWithTooltip = ({
  icon,
  tooltipText,
}: {
  icon: ReactNode;
  tooltipText: string;
}) => {
  return (
    <div className="flex items-center">
      <Tooltip.Provider delayDuration={100} skipDelayDuration={500}>
        <Tooltip.Root>
          <Tooltip.Trigger>{icon}</Tooltip.Trigger>
          <Tooltip.Content side="top" sideOffset={8}>
            <span className="inline-block bg-darkGray3 p-2 text-xs text-light hoverable:bg-darkGray">
              {tooltipText}
            </span>
          </Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    </div>
  );
};

const VerifiedIconWithTooltip = () => {
  return (
    <IconWithTooltip
      icon={<VerifiedIcon />}
      tooltipText="The instructions in this proposal are verified."
    />
  );
};

const UnverifiedIconWithTooltip = () => {
  return (
    <IconWithTooltip
      icon={<WarningIcon style={{ fill: "yellow" }} />}
      tooltipText="Be careful! The instructions in this proposal are not verified."
    />
  );
};

const VotedIconWithTooltip = () => {
  return (
    <IconWithTooltip
      icon={<VotedIcon />}
      tooltipText="You have voted on this proposal."
    />
  );
};

const AccountList = ({
  listName,
  accounts,
}: {
  listName: string;
  accounts: PublicKey[];
}) => {
  const { multisigSignerKeyToNameMapping } = usePythContext();
  return (
    <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4">
      <h4 className="h4 font-semibold">
        {listName}: {accounts.length}
      </h4>
      <hr className="border-gray-700" />
      {accounts.map((pubkey, idx) => (
        <div key={pubkey.toBase58()}>
          <div className="flex justify-between" key={pubkey.toBase58()}>
            <div>
              Key {idx + 1}{" "}
              {pubkey.toBase58() in multisigSignerKeyToNameMapping &&
                `(${multisigSignerKeyToNameMapping[pubkey.toBase58()]})`}
            </div>
            <CopyText text={pubkey.toBase58()} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const Proposal = ({
  proposal,
  multisig,
}: {
  proposal?: TransactionAccount;
  multisig?: MultisigAccount;
}) => {
  const [instructions, setInstructions] = useState<MultisigInstruction[]>([]);
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);
  const { cluster: contextCluster } = useContext(ClusterContext);
  const multisigCluster = getMultisigCluster(contextCluster);
  const targetClusters: (PythCluster | "unknown")[] = [];
  instructions.map((ix) => {
    if (!(ix instanceof WormholeMultisigInstruction)) {
      targetClusters.push(multisigCluster);
    } else if (
      ix instanceof WormholeMultisigInstruction &&
      ix.governanceAction instanceof ExecutePostedVaa
    ) {
      ix.governanceAction.instructions.map((ix) => {
        const remoteClusters: PythCluster[] = [
          "pythnet",
          "pythtest-conformance",
          "pythtest-crosschain",
        ];
        for (const remoteCluster of remoteClusters) {
          if (
            multisigCluster === getMultisigCluster(remoteCluster) &&
            (ix.programId.equals(getPythProgramKeyForCluster(remoteCluster)) ||
              ix.programId.equals(SystemProgram.programId))
          ) {
            targetClusters.push(remoteCluster);
          }
        }
      });
    } else {
      targetClusters.push("unknown");
    }
  });
  const uniqueTargetCluster = new Set(targetClusters).size === 1;
  const cluster =
    uniqueTargetCluster && targetClusters[0] !== "unknown"
      ? targetClusters[0]
      : contextCluster;

  const {
    walletSquads: squads,
    isLoading: isMultisigLoading,
    refreshData,
    readOnlySquads,
  } = useMultisigContext();
  const {
    priceAccountKeyToSymbolMapping,
    productAccountKeyToSymbolMapping,
    publisherKeyToNameMapping,
  } = usePythContext();

  const publisherKeyToNameMappingCluster =
    publisherKeyToNameMapping[getMappingCluster(cluster)];
  const { publicKey: signerPublicKey } = useWallet();

  const proposalStatus = getProposalStatus(proposal, multisig);

  const verified =
    proposal &&
    Object.keys(proposal.status)[0] !== "draft" &&
    instructions.length > 0 &&
    instructions.every(
      (ix) =>
        ix instanceof PythMultisigInstruction ||
        (ix instanceof WormholeMultisigInstruction &&
          ix.name === "postMessage" &&
          ix.governanceAction instanceof ExecutePostedVaa &&
          ix.governanceAction.instructions.every((remoteIx) => {
            const innerMultisigParser = cluster
              ? MultisigParser.fromCluster(cluster)
              : undefined;
            const parsedRemoteInstruction =
              innerMultisigParser.parseInstruction({
                data: remoteIx.data,
                keys: remoteIx.keys,
                programId: remoteIx.programId,
              });
            return (
              parsedRemoteInstruction instanceof PythMultisigInstruction ||
              parsedRemoteInstruction instanceof AnchorMultisigInstruction
            );
          }) &&
          ix.governanceAction.targetChainId === "pythnet"),
    );

  const voted =
    proposal &&
    signerPublicKey &&
    (proposal.approved.some(
      (p) => p.toBase58() === signerPublicKey.toBase58(),
    ) ||
      proposal.cancelled.some(
        (p) => p.toBase58() === signerPublicKey.toBase58(),
      ) ||
      proposal.rejected.some(
        (p) => p.toBase58() === signerPublicKey.toBase58(),
      ));

  useEffect(() => {
    let isCancelled = false;
    const fetchInstructions = async () => {
      if (proposal) {
        const [proposalInstructions] = await getManyProposalsInstructions(
          readOnlySquads,
          [proposal],
        );

        const multisigParser = cluster
          ? MultisigParser.fromCluster(getMultisigCluster(cluster))
          : undefined;
        const parsedInstructions = (
          proposalInstructions.map((ix) =>
            multisigParser.parseInstruction({
              data: ix.data as Buffer,
              keys: ix.keys as AccountMeta[],
              programId: ix.programId,
            }),
          ) ?? []
        ).filter(Boolean);
        if (!isCancelled) setInstructions(parsedInstructions);
      } else {
        if (!isCancelled) setInstructions([]);
      }
    };
    // biome-ignore lint/suspicious/noConsole: Intentional error logging
    fetchInstructions().catch(console.error);
    return () => {
      isCancelled = true;
    };
  }, [cluster, proposal, readOnlySquads]);

  const handleClick = async (
    instructionGenerator: (
      squad: SquadsMesh,
      vaultKey: PublicKey,
      proposalKey: PublicKey,
    ) => Promise<TransactionInstruction>,
    msg: string,
  ) => {
    if (proposal && squads) {
      try {
        setIsTransactionLoading(true);
        const instruction = await instructionGenerator(
          squads,
          proposal.ms,
          proposal.publicKey,
        );
        const builder = new TransactionBuilder(
          squads.wallet.publicKey,
          squads.connection,
        );
        builder.addInstruction({
          computeUnits: 20_000,
          instruction,
          signers: [],
        });
        const transactions = builder.buildLegacyTransactions({
          computeUnitPriceMicroLamports: 150_000,
          tightComputeBudget: true,
        });
        await sendTransactions(
          transactions,
          squads.connection,
          squads.wallet as Wallet,
        );

        if (refreshData) await refreshData().fetchData();
        toast.success(msg);
        // biome-ignore lint/suspicious/noExplicitAny: Legacy error handling pattern
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";
        toast.error(capitalizeFirstLetter(errorMessage));
      } finally {
        setIsTransactionLoading(false);
      }
    }
  };

  const handleClickApprove = async () => {
    await handleClick(
      async (
        squad: SquadsMesh,
        vaultKey: PublicKey,
        proposalKey: PublicKey,
      ): Promise<TransactionInstruction> => {
        return await squad.buildApproveTransaction(vaultKey, proposalKey);
      },
      `Approved proposal ${proposal.publicKey.toBase58()}`,
    );
  };

  const handleClickReject = async () => {
    await handleClick(
      async (
        squad: SquadsMesh,
        vaultKey: PublicKey,
        proposalKey: PublicKey,
      ): Promise<TransactionInstruction> => {
        return await squad.buildRejectTransaction(vaultKey, proposalKey);
      },
      `Rejected proposal ${proposal.publicKey.toBase58()}`,
    );
  };

  const handleClickExecute = async () => {
    await handleClick(
      async (
        squad: SquadsMesh,
        _: PublicKey,
        proposalKey: PublicKey,
      ): Promise<TransactionInstruction> => {
        return await squad.buildExecuteTransaction(proposalKey);
      },
      `Executed proposal ${proposal.publicKey.toBase58()}`,
    );
  };

  const handleClickCancel = async () => {
    await handleClick(
      async (
        squad: SquadsMesh,
        vaultKey: PublicKey,
        proposalKey: PublicKey,
      ): Promise<TransactionInstruction> => {
        return await squad.buildCancelTransaction(vaultKey, proposalKey);
      },
      `Cancelled proposal ${proposal.publicKey.toBase58()}`,
    );
  };

  if (!proposal || !multisig || isMultisigLoading)
    return (
      <div className="mt-6">
        <Loadbar theme="light" />
      </div>
    );

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4">
        <h4 className="h4 font-semibold">
          Multisig network: {multisigCluster}
        </h4>
        <h4 className="h4 font-semibold">
          {uniqueTargetCluster
            ? `Target network: ${targetClusters[0]}`
            : targetClusters.length === 0
              ? ""
              : `Multiple target networks detected ${targetClusters.join(" ")}`}
        </h4>
      </div>
      <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4 lg:col-span-2">
        <div className="flex justify-between">
          <h4 className="h4 font-semibold">Info</h4>
          <div className="flex space-x-2">
            {verified ? (
              <VerifiedIconWithTooltip />
            ) : (
              <UnverifiedIconWithTooltip />
            )}
            {voted && <VotedIconWithTooltip />}
          </div>
        </div>
        <hr className="border-gray-700" />
        <div className="flex justify-between">
          <div>Status</div>
          <StatusTag proposalStatus={proposalStatus} />
        </div>
        <div className="flex justify-between">
          <div>Proposal</div>
          <CopyText text={proposal.publicKey.toBase58()} />
        </div>
        <div className="flex justify-between">
          <div>Creator</div>
          <CopyText text={proposal.creator.toBase58()} />
        </div>
        <div className="flex justify-between">
          <div>Multisig</div>
          <CopyText text={proposal.ms.toBase58()} />
        </div>
      </div>
      <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4 lg:col-span-1">
        <h4 className="h4 mb-4 font-semibold">Results</h4>
        <hr className="border-gray-700" />
        <div className="grid grid-cols-3 justify-center gap-4 text-center align-middle">
          <div>
            <div className="font-bold">Confirmed</div>
            <div className="text-lg">{proposal.approved.length}</div>
          </div>
          {proposalStatus === "active" || proposalStatus === "rejected" ? (
            <div>
              <div className="font-bold">Rejected</div>
              <div className="text-lg">{proposal.rejected.length}</div>
            </div>
          ) : (
            <div>
              <div className="font-bold">Cancelled</div>
              <div className="text-lg">{proposal.cancelled.length}</div>
            </div>
          )}
          <div>
            <div className="font-bold">Threshold</div>
            <div className="text-lg">
              {multisig.threshold}/{multisig.keys.length}
            </div>
          </div>
        </div>
        {proposalStatus === "active" ? (
          <div className="flex items-center justify-center space-x-8 pt-3">
            <button
              className="action-btn text-base"
              disabled={isTransactionLoading}
              onClick={handleClickApprove}
            >
              {isTransactionLoading ? <Spinner /> : "Approve"}
            </button>
            <button
              className="sub-action-btn text-base"
              disabled={isTransactionLoading}
              onClick={handleClickReject}
            >
              {isTransactionLoading ? <Spinner /> : "Reject"}
            </button>
          </div>
        ) : proposalStatus === "executeReady" ? (
          <div className="flex items-center justify-center space-x-8 pt-3">
            <button
              className="action-btn text-base"
              disabled={isTransactionLoading}
              onClick={handleClickExecute}
            >
              {isTransactionLoading ? <Spinner /> : "Execute"}
            </button>
            <button
              className="sub-action-btn text-base"
              disabled={isTransactionLoading}
              onClick={handleClickCancel}
            >
              {isTransactionLoading ? <Spinner /> : "Cancel"}
            </button>
          </div>
        ) : undefined}
      </div>
      {proposal.approved.length > 0 && (
        <AccountList accounts={proposal.approved} listName="Confirmed" />
      )}
      {proposal.rejected.length > 0 && (
        <AccountList accounts={proposal.rejected} listName="Rejected" />
      )}
      {proposal.cancelled.length > 0 && (
        <AccountList accounts={proposal.cancelled} listName="Cancelled" />
      )}
      <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4">
        <h4 className="h4 font-semibold">
          Total Instructions: {instructions.length}
        </h4>
        <hr className="border-gray-700" />
        <h4 className="h4 text-[20px] font-semibold">Summary</h4>
        <InstructionsSummary cluster={cluster} instructions={instructions} />
        <hr className="border-gray-700" />
        {instructions.map((instruction, index) => (
          <Fragment key={index}>
            <h4 className="h4 text-[20px] font-semibold">
              Instruction {index + 1}
            </h4>
            <div
              className="flex justify-between"
              key={`${index.toString()}_instructionType`}
            >
              <div>Program</div>
              <div>{getProgramName(instruction.program)}</div>
            </div>
            {
              <div
                className="flex justify-between"
                key={`${index.toString()}_instructionName`}
              >
                <div>Instruction Name</div>
                <div>{instruction.name}</div>
              </div>
            }
            {instruction instanceof WormholeMultisigInstruction &&
            instruction.governanceAction ? (
              <>
                <div
                  className="flex justify-between"
                  key={`${index.toString()}_targetChain`}
                >
                  <div>Target Chain</div>
                  <div>{instruction.governanceAction.targetChainId}</div>
                </div>
              </>
            ) : undefined}
            {instruction instanceof WormholeMultisigInstruction ? undefined : (
              <div
                className="grid grid-cols-4 justify-between"
                key={`${index.toString()}_arguments`}
              >
                <div>Arguments</div>
                {Object.keys(instruction.args).length > 0 ? (
                  <div className="col-span-4 mt-2 bg-darkGray2 p-4 lg:col-span-3 lg:mt-0">
                    <div className="base16 flex justify-between pt-2 pb-6 font-semibold opacity-60">
                      <div>Key</div>
                      <div>Value</div>
                    </div>
                    {Object.keys(instruction.args).map((key, index) => (
                      <Fragment key={index}>
                        <div className="flex justify-between border-t border-beige-300 py-3">
                          <div>{key}</div>
                          {instruction.args[key] instanceof PublicKey ? (
                            <CopyText text={instruction.args[key].toBase58()} />
                          ) : typeof instruction.args[key] === "string" &&
                            isPubkey(instruction.args[key]) ? (
                            <CopyText text={instruction.args[key]} />
                          ) : (
                            <div className="max-w-sm break-all">
                              {typeof instruction.args[key] === "string"
                                ? instruction.args[key]
                                : instruction.args[key] instanceof Uint8Array
                                  ? instruction.args[key].toString()
                                  : typeof instruction.args[key] === "bigint"
                                    ? instruction.args[key].toString()
                                    : JSON.stringify(instruction.args[key])}
                            </div>
                          )}
                        </div>
                        {key === "pub" &&
                        publisherKeyToNameMappingCluster &&
                        instruction.args[key].toBase58() in
                          publisherKeyToNameMappingCluster ? (
                          <ParsedAccountPubkeyRow
                            key={`${index.toString()}_${instruction.args[key].toBase58()}`}
                            mapping={publisherKeyToNameMappingCluster}
                            pubkey={instruction.args[key]?.toBase58()}
                            title="publisher"
                          />
                        ) : undefined}
                      </Fragment>
                    ))}
                  </div>
                ) : (
                  <div className="col-span-3 text-right">No arguments</div>
                )}
              </div>
            )}
            {cluster && instruction instanceof WormholeMultisigInstruction && (
              <WormholeInstructionView
                cluster={cluster}
                instruction={instruction}
              />
            )}
            {instruction instanceof WormholeMultisigInstruction ? undefined : (
              <div
                className="grid grid-cols-4 justify-between"
                key={`${index}_accounts`}
              >
                <div>Accounts</div>
                {Object.keys(instruction.accounts.named).length > 0 ? (
                  <div className="col-span-4 mt-2 bg-darkGray2 p-4 lg:col-span-3 lg:mt-0">
                    <div className="base16 flex justify-between pt-2 pb-6 font-semibold opacity-60">
                      <div>Account</div>
                      <div>Pubkey</div>
                    </div>
                    {Object.keys(instruction.accounts.named).map(
                      (key, index) => (
                        <>
                          <div
                            className="flex justify-between border-t border-beige-300 py-3"
                            key={index}
                          >
                            <div className="max-w-[80px] break-words sm:max-w-none sm:break-normal">
                              {key}
                            </div>
                            <div className="space-y-2 sm:flex sm:space-y-0 sm:space-x-2">
                              <div className="flex items-center space-x-2 sm:ml-2">
                                {instruction.accounts.named[key].isSigner ? (
                                  <SignerTag />
                                ) : undefined}
                                {instruction.accounts.named[key].isWritable ? (
                                  <WritableTag />
                                ) : undefined}
                              </div>
                              <CopyText
                                text={
                                  instruction.accounts.named[
                                    key
                                  ].pubkey.toBase58() ?? ""
                                }
                              />
                            </div>
                          </div>
                          {key === "priceAccount" &&
                          instruction.accounts.named[key].pubkey.toBase58() in
                            priceAccountKeyToSymbolMapping ? (
                            <ParsedAccountPubkeyRow
                              key="priceAccountPubkey"
                              mapping={priceAccountKeyToSymbolMapping}
                              pubkey={
                                instruction.accounts.named[
                                  key
                                ].pubkey.toBase58() ?? ""
                              }
                              title="symbol"
                            />
                          ) : key === "productAccount" &&
                            instruction.accounts.named[key].pubkey.toBase58() in
                              productAccountKeyToSymbolMapping ? (
                            <ParsedAccountPubkeyRow
                              key="productAccountPubkey"
                              mapping={productAccountKeyToSymbolMapping}
                              pubkey={
                                instruction.accounts.named[
                                  key
                                ].pubkey.toBase58() ?? ""
                              }
                              title="symbol"
                            />
                          ) : undefined}
                        </>
                      ),
                    )}
                  </div>
                ) : (
                  <div>No arguments</div>
                )}
              </div>
            )}
            {index === instructions.length - 1 ? undefined : (
              <hr className="border-gray-700" />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
};
