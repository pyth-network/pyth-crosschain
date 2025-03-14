import { useWallet } from '@solana/wallet-adapter-react'
import {
  AccountMeta,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js'
import SquadsMesh from '@sqds/mesh'
import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'
import {
  type ReactNode,
  Fragment,
  useContext,
  useEffect,
  useState,
} from 'react'
import toast from 'react-hot-toast'
import {
  AnchorMultisigInstruction,
  ExecutePostedVaa,
  MultisigInstruction,
  MultisigParser,
  PythMultisigInstruction,
  WormholeMultisigInstruction,
  getManyProposalsInstructions,
  getMultisigCluster,
  getProgramName,
} from '@pythnetwork/xc-admin-common'
import { ClusterContext } from '../../../contexts/ClusterContext'
import { useMultisigContext } from '../../../contexts/MultisigContext'
import { usePythContext } from '../../../contexts/PythContext'
import { capitalizeFirstLetter } from '../../../utils/capitalizeFirstLetter'
import {
  ParsedAccountPubkeyRow,
  SignerTag,
  WritableTag,
} from '../../InstructionViews/AccountUtils'
import { WormholeInstructionView } from '../../InstructionViews/WormholeInstructionView'
import CopyText from '../../common/CopyText'
import Spinner from '../../common/Spinner'
import Loadbar from '../../loaders/Loadbar'

import { Wallet } from '@coral-xyz/anchor'
import { PythCluster, getPythProgramKeyForCluster } from '@pythnetwork/client'
import { TransactionBuilder, sendTransactions } from '@pythnetwork/solana-utils'
import { getMappingCluster, isPubkey } from '../../InstructionViews/utils'
import { StatusTag } from './StatusTag'
import { getProposalStatus } from './utils'

import VerifiedIcon from '@images/icons/verified.inline.svg'
import VotedIcon from '@images/icons/voted.inline.svg'
import WarningIcon from '@images/icons/warning.inline.svg'
import * as Tooltip from '@radix-ui/react-tooltip'
import { InstructionsSummary } from './InstructionsSummary'

const IconWithTooltip = ({
  icon,
  tooltipText,
}: {
  icon: ReactNode
  tooltipText: string
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
  )
}

const VerifiedIconWithTooltip = () => {
  return (
    <IconWithTooltip
      icon={<VerifiedIcon />}
      tooltipText="The instructions in this proposal are verified."
    />
  )
}

const UnverifiedIconWithTooltip = () => {
  return (
    <IconWithTooltip
      icon={<WarningIcon style={{ fill: 'yellow' }} />}
      tooltipText="Be careful! The instructions in this proposal are not verified."
    />
  )
}

const VotedIconWithTooltip = () => {
  return (
    <IconWithTooltip
      icon={<VotedIcon />}
      tooltipText="You have voted on this proposal."
    />
  )
}

const AccountList = ({
  listName,
  accounts,
}: {
  listName: string
  accounts: PublicKey[]
}) => {
  const { multisigSignerKeyToNameMapping } = usePythContext()
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
              Key {idx + 1}{' '}
              {pubkey.toBase58() in multisigSignerKeyToNameMapping &&
                `(${multisigSignerKeyToNameMapping[pubkey.toBase58()]})`}
            </div>
            <CopyText text={pubkey.toBase58()} />
          </div>
        </div>
      ))}
    </div>
  )
}

export const Proposal = ({
  proposal,
  multisig,
}: {
  proposal?: TransactionAccount
  multisig?: MultisigAccount
}) => {
  const [instructions, setInstructions] = useState<MultisigInstruction[]>([])
  const [isTransactionLoading, setIsTransactionLoading] = useState(false)
  const { cluster: contextCluster } = useContext(ClusterContext)
  const multisigCluster = getMultisigCluster(contextCluster)
  const targetClusters: (PythCluster | 'unknown')[] = []
  instructions.map((ix) => {
    if (!(ix instanceof WormholeMultisigInstruction)) {
      targetClusters.push(multisigCluster)
    } else if (
      ix instanceof WormholeMultisigInstruction &&
      ix.governanceAction instanceof ExecutePostedVaa
    ) {
      ix.governanceAction.instructions.map((ix) => {
        const remoteClusters: PythCluster[] = [
          'pythnet',
          'pythtest-conformance',
          'pythtest-crosschain',
        ]
        for (const remoteCluster of remoteClusters) {
          if (
            multisigCluster === getMultisigCluster(remoteCluster) &&
            (ix.programId.equals(getPythProgramKeyForCluster(remoteCluster)) ||
              ix.programId.equals(SystemProgram.programId))
          ) {
            targetClusters.push(remoteCluster)
          }
        }
      })
    } else {
      targetClusters.push('unknown')
    }
  })
  const uniqueTargetCluster = new Set(targetClusters).size === 1
  const cluster =
    uniqueTargetCluster && targetClusters[0] !== 'unknown'
      ? targetClusters[0]
      : contextCluster

  const {
    walletSquads: squads,
    isLoading: isMultisigLoading,
    refreshData,
    readOnlySquads,
  } = useMultisigContext()
  const {
    priceAccountKeyToSymbolMapping,
    productAccountKeyToSymbolMapping,
    publisherKeyToNameMapping,
  } = usePythContext()

  const publisherKeyToNameMappingCluster =
    publisherKeyToNameMapping[getMappingCluster(cluster)]
  const { publicKey: signerPublicKey } = useWallet()

  const proposalStatus = getProposalStatus(proposal, multisig)

  const verified =
    proposal &&
    Object.keys(proposal.status)[0] !== 'draft' &&
    instructions.length > 0 &&
    instructions.every(
      (ix) =>
        ix instanceof PythMultisigInstruction ||
        (ix instanceof WormholeMultisigInstruction &&
          ix.name === 'postMessage' &&
          ix.governanceAction instanceof ExecutePostedVaa &&
          ix.governanceAction.instructions.every((remoteIx) => {
            const innerMultisigParser = MultisigParser.fromCluster(cluster)
            const parsedRemoteInstruction =
              innerMultisigParser.parseInstruction({
                programId: remoteIx.programId,
                data: remoteIx.data as Buffer,
                keys: remoteIx.keys as AccountMeta[],
              })
            return (
              parsedRemoteInstruction instanceof PythMultisigInstruction ||
              parsedRemoteInstruction instanceof AnchorMultisigInstruction
            )
          }) &&
          ix.governanceAction.targetChainId === 'pythnet')
    )

  const voted =
    proposal &&
    signerPublicKey &&
    (proposal.approved.some(
      (p) => p.toBase58() === signerPublicKey.toBase58()
    ) ||
      proposal.cancelled.some(
        (p) => p.toBase58() === signerPublicKey.toBase58()
      ) ||
      proposal.rejected.some(
        (p) => p.toBase58() === signerPublicKey.toBase58()
      ))

  useEffect(() => {
    let isCancelled = false
    const fetchInstructions = async () => {
      if (proposal) {
        const proposalInstructions = (
          await getManyProposalsInstructions(readOnlySquads, [proposal])
        )[0]
        const multisigParser = MultisigParser.fromCluster(
          getMultisigCluster(cluster)
        )
        const parsedInstructions = proposalInstructions.map((ix) =>
          multisigParser.parseInstruction({
            programId: ix.programId,
            data: ix.data as Buffer,
            keys: ix.keys as AccountMeta[],
          })
        )
        if (!isCancelled) setInstructions(parsedInstructions)
      } else {
        if (!isCancelled) setInstructions([])
      }
    }
    fetchInstructions().catch(console.error)
    return () => {
      isCancelled = true
    }
  }, [cluster, proposal, readOnlySquads])

  const handleClick = async (
    instructionGenerator: (
      squad: SquadsMesh,
      vaultKey: PublicKey,
      proposalKey: PublicKey
    ) => Promise<TransactionInstruction>,
    msg: string
  ) => {
    if (proposal && squads) {
      try {
        setIsTransactionLoading(true)
        const instruction = await instructionGenerator(
          squads,
          proposal.ms,
          proposal.publicKey
        )
        const builder = new TransactionBuilder(
          squads.wallet.publicKey,
          squads.connection
        )
        builder.addInstruction({
          instruction,
          signers: [],
          computeUnits: 20000,
        })
        const transactions = builder.buildLegacyTransactions({
          computeUnitPriceMicroLamports: 150000,
          tightComputeBudget: true,
        })
        await sendTransactions(
          transactions,
          squads.connection,
          squads.wallet as Wallet
        )

        if (refreshData) await refreshData().fetchData()
        toast.success(msg)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        toast.error(capitalizeFirstLetter(e.message))
      } finally {
        setIsTransactionLoading(false)
      }
    }
  }

  const handleClickApprove = async () => {
    await handleClick(
      async (
        squad: SquadsMesh,
        vaultKey: PublicKey,
        proposalKey: PublicKey
      ): Promise<TransactionInstruction> => {
        return await squad.buildApproveTransaction(vaultKey, proposalKey)
      },
      `Approved proposal ${proposal?.publicKey.toBase58()}`
    )
  }

  const handleClickReject = async () => {
    await handleClick(
      async (
        squad: SquadsMesh,
        vaultKey: PublicKey,
        proposalKey: PublicKey
      ): Promise<TransactionInstruction> => {
        return await squad.buildRejectTransaction(vaultKey, proposalKey)
      },
      `Rejected proposal ${proposal?.publicKey.toBase58()}`
    )
  }

  const handleClickExecute = async () => {
    await handleClick(
      async (
        squad: SquadsMesh,
        vaultKey: PublicKey,
        proposalKey: PublicKey
      ): Promise<TransactionInstruction> => {
        return await squad.buildExecuteTransaction(proposalKey)
      },
      `Executed proposal ${proposal?.publicKey.toBase58()}`
    )
  }

  const handleClickCancel = async () => {
    await handleClick(
      async (
        squad: SquadsMesh,
        vaultKey: PublicKey,
        proposalKey: PublicKey
      ): Promise<TransactionInstruction> => {
        return await squad.buildCancelTransaction(vaultKey, proposalKey)
      },
      `Cancelled proposal ${proposal?.publicKey.toBase58()}`
    )
  }

  if (!proposal || !multisig || isMultisigLoading)
    return (
      <div className="mt-6">
        <Loadbar theme="light" />
      </div>
    )

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4">
        <h4 className="h4 font-semibold">
          Multisig network: {multisigCluster}
        </h4>
        <h4 className="h4 font-semibold">
          {uniqueTargetCluster
            ? `Target network: ${targetClusters[0]}`
            : targetClusters.length == 0
              ? ''
              : `Multiple target networks detected ${targetClusters.join(' ')}`}
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
          {proposalStatus === 'active' || proposalStatus === 'rejected' ? (
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
        {proposalStatus === 'active' ? (
          <div className="flex items-center justify-center space-x-8 pt-3">
            <button
              disabled={isTransactionLoading}
              className="action-btn text-base"
              onClick={handleClickApprove}
            >
              {isTransactionLoading ? <Spinner /> : 'Approve'}
            </button>
            <button
              disabled={isTransactionLoading}
              className="sub-action-btn text-base"
              onClick={handleClickReject}
            >
              {isTransactionLoading ? <Spinner /> : 'Reject'}
            </button>
          </div>
        ) : proposalStatus === 'executeReady' ? (
          <div className="flex items-center justify-center space-x-8 pt-3">
            <button
              disabled={isTransactionLoading}
              className="action-btn text-base"
              onClick={handleClickExecute}
            >
              {isTransactionLoading ? <Spinner /> : 'Execute'}
            </button>
            <button
              disabled={isTransactionLoading}
              className="sub-action-btn text-base"
              onClick={handleClickCancel}
            >
              {isTransactionLoading ? <Spinner /> : 'Cancel'}
            </button>
          </div>
        ) : null}
      </div>
      {proposal.approved.length > 0 && (
        <AccountList listName="Confirmed" accounts={proposal.approved} />
      )}
      {proposal.rejected.length > 0 && (
        <AccountList listName="Rejected" accounts={proposal.rejected} />
      )}
      {proposal.cancelled.length > 0 && (
        <AccountList listName="Cancelled" accounts={proposal.cancelled} />
      )}
      <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4">
        <h4 className="h4 font-semibold">
          Total Instructions: {instructions.length}
        </h4>
        <hr className="border-gray-700" />
        <h4 className="h4 text-[20px] font-semibold">Summary</h4>
        <InstructionsSummary instructions={instructions} cluster={cluster} />
        <hr className="border-gray-700" />
        {instructions?.map((instruction, index) => (
          <Fragment key={index}>
            <h4 className="h4 text-[20px] font-semibold">
              Instruction {index + 1}
            </h4>
            <div
              key={`${index}_instructionType`}
              className="flex justify-between"
            >
              <div>Program</div>
              <div>{getProgramName(instruction.program)}</div>
            </div>
            {
              <div
                key={`${index}_instructionName`}
                className="flex justify-between"
              >
                <div>Instruction Name</div>
                <div>{instruction.name}</div>
              </div>
            }
            {instruction instanceof WormholeMultisigInstruction &&
            instruction.governanceAction ? (
              <>
                <div
                  key={`${index}_targetChain`}
                  className="flex justify-between"
                >
                  <div>Target Chain</div>
                  <div>{instruction.governanceAction.targetChainId}</div>
                </div>
              </>
            ) : null}
            {instruction instanceof WormholeMultisigInstruction ? null : (
              <div
                key={`${index}_arguments`}
                className="grid grid-cols-4 justify-between"
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
                          ) : typeof instruction.args[key] === 'string' &&
                            isPubkey(instruction.args[key]) ? (
                            <CopyText text={instruction.args[key]} />
                          ) : (
                            <div className="max-w-sm break-all">
                              {typeof instruction.args[key] === 'string'
                                ? instruction.args[key]
                                : instruction.args[key] instanceof Uint8Array
                                  ? instruction.args[key].toString()
                                  : typeof instruction.args[key] === 'bigint'
                                    ? instruction.args[key].toString()
                                    : JSON.stringify(instruction.args[key])}
                            </div>
                          )}
                        </div>
                        {key === 'pub' &&
                        instruction.args[key].toBase58() in
                          publisherKeyToNameMappingCluster ? (
                          <ParsedAccountPubkeyRow
                            key={`${index}_${instruction.args[key].toBase58()}`}
                            mapping={publisherKeyToNameMappingCluster}
                            title="publisher"
                            pubkey={instruction.args[key].toBase58()}
                          />
                        ) : null}
                      </Fragment>
                    ))}
                  </div>
                ) : (
                  <div className="col-span-3 text-right">No arguments</div>
                )}
              </div>
            )}
            {instruction instanceof WormholeMultisigInstruction && (
              <WormholeInstructionView
                cluster={cluster}
                instruction={instruction}
              />
            )}
            {!(instruction instanceof WormholeMultisigInstruction) ? (
              <div
                key={`${index}_accounts`}
                className="grid grid-cols-4 justify-between"
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
                            key={index}
                            className="flex justify-between border-t border-beige-300 py-3"
                          >
                            <div className="max-w-[80px] break-words sm:max-w-none sm:break-normal">
                              {key}
                            </div>
                            <div className="space-y-2 sm:flex sm:space-y-0 sm:space-x-2">
                              <div className="flex items-center space-x-2 sm:ml-2">
                                {instruction.accounts.named[key].isSigner ? (
                                  <SignerTag />
                                ) : null}
                                {instruction.accounts.named[key].isWritable ? (
                                  <WritableTag />
                                ) : null}
                              </div>
                              <CopyText
                                text={instruction.accounts.named[
                                  key
                                ].pubkey.toBase58()}
                              />
                            </div>
                          </div>
                          {key === 'priceAccount' &&
                          instruction.accounts.named[key].pubkey.toBase58() in
                            priceAccountKeyToSymbolMapping ? (
                            <ParsedAccountPubkeyRow
                              key="priceAccountPubkey"
                              mapping={priceAccountKeyToSymbolMapping}
                              title="symbol"
                              pubkey={instruction.accounts.named[
                                key
                              ].pubkey.toBase58()}
                            />
                          ) : key === 'productAccount' &&
                            instruction.accounts.named[key].pubkey.toBase58() in
                              productAccountKeyToSymbolMapping ? (
                            <ParsedAccountPubkeyRow
                              key="productAccountPubkey"
                              mapping={productAccountKeyToSymbolMapping}
                              title="symbol"
                              pubkey={instruction.accounts.named[
                                key
                              ].pubkey.toBase58()}
                            />
                          ) : null}
                        </>
                      )
                    )}
                  </div>
                ) : (
                  <div>No arguments</div>
                )}
              </div>
            ) : null}
            {index !== instructions.length - 1 ? (
              <hr className="border-gray-700" />
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
