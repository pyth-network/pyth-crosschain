import * as Tooltip from '@radix-ui/react-tooltip'
import { useWallet } from '@solana/wallet-adapter-react'
import { AccountMeta, Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'
import { useRouter } from 'next/router'
import { Fragment, useCallback, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  ExecutePostedVaa,
  getMultisigCluster,
  MultisigInstruction,
  MultisigParser,
  PythMultisigInstruction,
  MessageBufferMultisigInstruction,
  UnrecognizedProgram,
  WormholeMultisigInstruction,
  getManyProposalsInstructions,
  SystemProgramMultisigInstruction,
  BpfUpgradableLoaderInstruction,
} from 'xc_admin_common'
import { ClusterContext } from '../../contexts/ClusterContext'
import { useMultisigContext } from '../../contexts/MultisigContext'
import { usePythContext } from '../../contexts/PythContext'
import { StatusFilterContext } from '../../contexts/StatusFilterContext'
import VerifiedIcon from '../../images/icons/verified.inline.svg'
import WarningIcon from '../../images/icons/warning.inline.svg'
import VotedIcon from '../../images/icons/voted.inline.svg'
import { capitalizeFirstLetter } from '../../utils/capitalizeFirstLetter'
import ClusterSwitch from '../ClusterSwitch'
import CopyPubkey from '../common/CopyPubkey'
import Spinner from '../common/Spinner'
import Loadbar from '../loaders/Loadbar'
import ProposalStatusFilter from '../ProposalStatusFilter'
import SquadsMesh from '@sqds/mesh'
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet'
import { WormholeInstructionView } from '../InstructionViews/WormholeInstructionView'
import {
  ParsedAccountPubkeyRow,
  SignerTag,
  WritableTag,
} from '../InstructionViews/AccountUtils'

import { getMappingCluster, isPubkey } from '../InstructionViews/utils'
import { getPythProgramKeyForCluster, PythCluster } from '@pythnetwork/client'
const ProposalRow = ({
  proposal,
  multisig,
}: {
  proposal: TransactionAccount
  multisig: MultisigAccount | undefined
}) => {
  const status = getProposalStatus(proposal, multisig)

  const router = useRouter()

  const handleClickIndividualProposal = useCallback(
    (proposalPubkey: string) => {
      router.query.proposal = proposalPubkey
      router.push(
        {
          pathname: router.pathname,
          query: router.query,
        },
        undefined,
        { scroll: true }
      )
    },
    [router]
  )
  return (
    <div
      className="my-2 max-h-[58px] cursor-pointer bg-[#1E1B2F] hover:bg-darkGray2"
      onClick={() =>
        handleClickIndividualProposal(proposal.publicKey.toBase58())
      }
    >
      <div className="flex justify-between p-4">
        <div className="flex">
          <span className="mr-2 hidden sm:block">
            {proposal.publicKey.toBase58()}
          </span>
          <span className="mr-2 sm:hidden">
            {proposal.publicKey.toBase58().slice(0, 6) +
              '...' +
              proposal.publicKey.toBase58().slice(-6)}
          </span>{' '}
        </div>
        <div className="flex space-x-2">
          {proposal.approved.length > 0 && status === 'active' && (
            <div>
              <StatusTag
                proposalStatus="executed"
                text={`Approved: ${proposal.approved.length}`}
              />
            </div>
          )}
          {proposal.rejected.length > 0 && status === 'active' && (
            <div>
              <StatusTag
                proposalStatus="rejected"
                text={`Rejected: ${proposal.rejected.length}`}
              />
            </div>
          )}
          <div>
            <StatusTag proposalStatus={status} />
          </div>
        </div>
      </div>
    </div>
  )
}

const StatusTag = ({
  proposalStatus,
  text,
}: {
  proposalStatus: string
  text?: string
}) => {
  return (
    <div
      className={`flex items-center justify-center rounded-full ${
        proposalStatus === 'active'
          ? 'bg-[#3C3299]'
          : proposalStatus === 'executed'
          ? 'bg-[#1B730E]'
          : proposalStatus === 'cancelled'
          ? 'bg-[#C4428F]'
          : proposalStatus === 'rejected'
          ? 'bg-[#CF6E42]'
          : proposalStatus === 'expired'
          ? 'bg-[#A52A2A]'
          : 'bg-pythPurple'
      } py-1 px-2 text-xs`}
    >
      {text || proposalStatus}
    </div>
  )
}

const IconWithTooltip = ({
  icon,
  tooltipText,
}: {
  icon: JSX.Element
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
      tooltipText=" You have voted on this proposal."
    />
  )
}

const getProposalStatus = (
  proposal: TransactionAccount | undefined,
  multisig: MultisigAccount | undefined
): string => {
  if (multisig && proposal) {
    const onChainStatus = Object.keys(proposal.status)[0]
    return proposal.transactionIndex <= multisig.msChangeIndex &&
      (onChainStatus == 'active' || onChainStatus == 'draft')
      ? 'expired'
      : onChainStatus
  } else {
    return 'unkwown'
  }
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
            <CopyPubkey pubkey={pubkey.toBase58()} />
          </div>
        </div>
      ))}
    </div>
  )
}

type ProposalType = 'priceFeed' | 'governance'

const Proposal = ({
  proposal,
  multisig,
}: {
  proposal: TransactionAccount | undefined
  multisig: MultisigAccount | undefined
}) => {
  const [instructions, setInstructions] = useState<MultisigInstruction[]>([])
  const [isTransactionLoading, setIsTransactionLoading] = useState(false)
  const { cluster: contextCluster } = useContext(ClusterContext)
  const multisigCluster = getMultisigCluster(contextCluster)
  const targetClusters: (PythCluster | 'unknown')[] = []
  instructions.map((ix) => {
    if (
      ix instanceof PythMultisigInstruction ||
      ix instanceof SystemProgramMultisigInstruction ||
      ix instanceof BpfUpgradableLoaderInstruction
    ) {
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
    voteSquads,
    isLoading: isMultisigLoading,
    connection,
    refreshData,
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
              parsedRemoteInstruction instanceof
                MessageBufferMultisigInstruction
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
      if (proposal && connection) {
        const readOnlySquads = new SquadsMesh({
          connection,
          wallet: new NodeWallet(new Keypair()),
        })
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
  }, [cluster, proposal, voteSquads, connection])

  const handleClick = async (
    handler: (squad: SquadsMesh, proposalKey: PublicKey) => any,
    msg: string
  ) => {
    if (proposal && voteSquads) {
      try {
        setIsTransactionLoading(true)
        await handler(voteSquads, proposal.publicKey)
        if (refreshData) await refreshData().fetchData()
        toast.success(msg)
      } catch (e: any) {
        toast.error(capitalizeFirstLetter(e.message))
      } finally {
        setIsTransactionLoading(false)
      }
    }
  }

  const handleClickApprove = async () => {
    await handleClick(async (squad: SquadsMesh, proposalKey: PublicKey) => {
      await squad.approveTransaction(proposalKey)
    }, `Approved proposal ${proposal?.publicKey.toBase58()}`)
  }

  const handleClickReject = async () => {
    await handleClick(async (squad: SquadsMesh, proposalKey: PublicKey) => {
      await squad.rejectTransaction(proposalKey)
    }, `Rejected proposal ${proposal?.publicKey.toBase58()}`)
  }

  const handleClickExecute = async () => {
    await handleClick(async (squad: SquadsMesh, proposalKey: PublicKey) => {
      await squad.executeTransaction(proposalKey)
    }, `Executed proposal ${proposal?.publicKey.toBase58()}`)
  }

  const handleClickCancel = async () => {
    await handleClick(async (squad: SquadsMesh, proposalKey: PublicKey) => {
      await squad.cancelTransaction(proposalKey)
    }, `Cancelled proposal ${proposal?.publicKey.toBase58()}`)
  }

  return proposal !== undefined &&
    multisig !== undefined &&
    !isMultisigLoading ? (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4">
        <h4 className="h4 font-semibold">
          Multisig network: {multisigCluster}
        </h4>
        <h4 className="h4 font-semibold">
          {uniqueTargetCluster
            ? `Target network: ${targetClusters[0]}`
            : targetClusters.length == 0
            ? 'No target network detected'
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
          <CopyPubkey pubkey={proposal.publicKey.toBase58()} />
        </div>
        <div className="flex justify-between">
          <div>Creator</div>
          <CopyPubkey pubkey={proposal.creator.toBase58()} />
        </div>
        <div className="flex justify-between">
          <div>Multisig</div>
          <CopyPubkey pubkey={proposal.ms.toBase58()} />
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
              <div>
                {instruction instanceof PythMultisigInstruction
                  ? 'Pyth Oracle'
                  : instruction instanceof WormholeMultisigInstruction
                  ? 'Wormhole'
                  : instruction instanceof SystemProgramMultisigInstruction
                  ? 'System Program'
                  : instruction instanceof BpfUpgradableLoaderInstruction
                  ? 'BPF Upgradable Loader'
                  : 'Unknown'}
              </div>
            </div>
            {instruction instanceof PythMultisigInstruction ||
            instruction instanceof WormholeMultisigInstruction ||
            instruction instanceof BpfUpgradableLoaderInstruction ||
            instruction instanceof SystemProgramMultisigInstruction ? (
              <div
                key={`${index}_instructionName`}
                className="flex justify-between"
              >
                <div>Instruction Name</div>
                <div>{instruction.name}</div>
              </div>
            ) : null}
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
            {instruction instanceof WormholeMultisigInstruction ||
            instruction instanceof UnrecognizedProgram ? null : (
              <div
                key={`${index}_arguments`}
                className="grid grid-cols-4 justify-between"
              >
                <div>Arguments</div>
                {instruction instanceof PythMultisigInstruction ||
                instruction instanceof SystemProgramMultisigInstruction ||
                instruction instanceof BpfUpgradableLoaderInstruction ? (
                  Object.keys(instruction.args).length > 0 ? (
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
                              <CopyPubkey
                                pubkey={instruction.args[key].toBase58()}
                              />
                            ) : typeof instruction.args[key] === 'string' &&
                              isPubkey(instruction.args[key]) ? (
                              <CopyPubkey pubkey={instruction.args[key]} />
                            ) : (
                              <div className="max-w-sm break-all">
                                {typeof instruction.args[key] === 'string'
                                  ? instruction.args[key]
                                  : instruction.args[key] instanceof Uint8Array
                                  ? instruction.args[key].toString('hex')
                                  : JSON.stringify(instruction.args[key])}
                              </div>
                            )}
                          </div>
                          {key === 'pub' &&
                          instruction.args[key].toBase58() in
                            publisherKeyToNameMappingCluster ? (
                            <ParsedAccountPubkeyRow
                              key={`${index}_${instruction.args[
                                key
                              ].toBase58()}`}
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
                  )
                ) : (
                  <div className="col-span-3 text-right">Unknown</div>
                )}
              </div>
            )}
            {instruction instanceof PythMultisigInstruction ||
            instruction instanceof SystemProgramMultisigInstruction ||
            instruction instanceof BpfUpgradableLoaderInstruction ? (
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
                              <CopyPubkey
                                pubkey={instruction.accounts.named[
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
            ) : instruction instanceof UnrecognizedProgram ? (
              <>
                <div
                  key={`${index}_programId`}
                  className="flex justify-between"
                >
                  <div>Program ID</div>
                  <CopyPubkey
                    pubkey={instruction.instruction.programId.toBase58()}
                  />
                </div>
                <div key={`${index}_data`} className="flex justify-between">
                  <div>Data</div>
                  <div className="max-w-sm break-all">
                    {instruction.instruction.data.length > 0
                      ? instruction.instruction.data.toString('hex')
                      : 'No data'}
                  </div>
                </div>
                <div
                  key={`${index}_keys`}
                  className="grid grid-cols-4 justify-between"
                >
                  <div>Keys</div>
                  <div className="col-span-4 mt-2 bg-darkGray2 p-4 lg:col-span-3 lg:mt-0">
                    <div className="base16 flex justify-between pt-2 pb-6 font-semibold opacity-60">
                      <div>Key #</div>
                      <div>Pubkey</div>
                    </div>
                    {instruction.instruction.keys.map((key, index) => (
                      <>
                        <div
                          key={index}
                          className="flex justify-between border-t border-beige-300 py-3"
                        >
                          <div>Key {index + 1}</div>
                          <div className="flex space-x-2">
                            {key.isSigner ? <SignerTag /> : null}
                            {key.isWritable ? <WritableTag /> : null}
                            <CopyPubkey pubkey={key.pubkey.toBase58()} />
                          </div>
                        </div>
                      </>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
            {instruction instanceof WormholeMultisigInstruction && (
              <WormholeInstructionView
                cluster={cluster}
                instruction={instruction}
              />
            )}

            {index !== instructions.length - 1 ? (
              <hr className="border-gray-700" />
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  ) : (
    <div className="mt-6">
      <Loadbar theme="light" />
    </div>
  )
}

const Proposals = () => {
  const router = useRouter()
  const { connected, publicKey: signerPublicKey } = useWallet()
  const [currentProposal, setCurrentProposal] = useState<TransactionAccount>()
  const [currentProposalPubkey, setCurrentProposalPubkey] = useState<string>()
  const { cluster } = useContext(ClusterContext)
  const { statusFilter } = useContext(StatusFilterContext)

  const {
    upgradeMultisigAccount,
    priceFeedMultisigAccount,
    priceFeedMultisigProposals,
    upgradeMultisigProposals,
    isLoading: isMultisigLoading,
    refreshData,
  } = useMultisigContext()

  const [proposalType, setProposalType] = useState<ProposalType>('priceFeed')

  const multisigAccount =
    proposalType === 'priceFeed'
      ? priceFeedMultisigAccount
      : upgradeMultisigAccount
  const multisigProposals =
    proposalType === 'priceFeed'
      ? priceFeedMultisigProposals
      : upgradeMultisigProposals
  const [filteredProposals, setFilteredProposals] = useState<
    TransactionAccount[]
  >([])

  const handleClickBackToProposals = () => {
    delete router.query.proposal
    router.push(
      {
        pathname: router.pathname,
        query: router.query,
      },
      undefined,
      { scroll: false }
    )
  }

  useEffect(() => {
    if (router.query.proposal) {
      setCurrentProposalPubkey(router.query.proposal as string)
    } else {
      setCurrentProposalPubkey(undefined)
    }
  }, [router.query.proposal])

  const switchProposalType = useCallback(() => {
    if (proposalType === 'priceFeed') {
      setProposalType('governance')
    } else {
      setProposalType('priceFeed')
    }
  }, [proposalType])

  useEffect(() => {
    if (currentProposalPubkey) {
      const currProposal = multisigProposals.find(
        (proposal) => proposal.publicKey.toBase58() === currentProposalPubkey
      )
      setCurrentProposal(currProposal)
      if (currProposal === undefined) {
        const otherProposals =
          proposalType !== 'priceFeed'
            ? priceFeedMultisigProposals
            : upgradeMultisigProposals
        if (
          otherProposals.findIndex(
            (proposal) =>
              proposal.publicKey.toBase58() === currentProposalPubkey
          ) !== -1
        ) {
          switchProposalType()
        }
      }
    }
  }, [
    switchProposalType,
    priceFeedMultisigProposals,
    proposalType,
    upgradeMultisigProposals,
    currentProposalPubkey,
    multisigProposals,
    cluster,
  ])

  useEffect(() => {
    // filter price feed multisig proposals by status
    if (statusFilter === 'all') {
      setFilteredProposals(multisigProposals)
    } else {
      setFilteredProposals(
        multisigProposals.filter(
          (proposal) =>
            getProposalStatus(proposal, multisigAccount) === statusFilter
        )
      )
    }
  }, [statusFilter, multisigAccount, multisigProposals])

  return (
    <div className="relative">
      <div className="container flex flex-col items-center justify-between lg:flex-row">
        <div className="mb-4 w-full text-left lg:mb-0">
          <h1 className="h1 mb-4">
            {proposalType === 'priceFeed' ? 'Price Feed ' : 'Governance '}{' '}
            {router.query.proposal === undefined ? 'Proposals' : 'Proposal'}
          </h1>
        </div>
      </div>
      <div className="container min-h-[50vh]">
        {router.query.proposal === undefined ? (
          <>
            <div className="flex flex-col justify-between md:flex-row">
              <div className="mb-4 flex items-center md:mb-0">
                <ClusterSwitch />
              </div>
              <div className="flex space-x-2">
                {refreshData && (
                  <button
                    disabled={isMultisigLoading}
                    className="sub-action-btn text-base"
                    onClick={() => {
                      const { fetchData } = refreshData()
                      fetchData()
                    }}
                  >
                    Refresh
                  </button>
                )}
                <button
                  disabled={isMultisigLoading}
                  className="action-btn text-base"
                  onClick={switchProposalType}
                >
                  Show
                  {proposalType !== 'priceFeed'
                    ? ' Price Feed '
                    : ' Governance '}
                  Proposals
                </button>
              </div>
            </div>
            <div className="relative mt-6">
              {isMultisigLoading ? (
                <div className="mt-3">
                  <Loadbar theme="light" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between pb-4">
                    <h4 className="h4">
                      Total Proposals: {filteredProposals.length}
                    </h4>
                    <ProposalStatusFilter />
                  </div>
                  {filteredProposals.length > 0 ? (
                    <div className="flex flex-col">
                      {filteredProposals.map((proposal, idx) => (
                        <ProposalRow
                          key={proposal.publicKey.toBase58()}
                          proposal={proposal}
                          multisig={multisigAccount}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4">
                      No proposals found. If you&apos;re a member of the
                      multisig, you can create a proposal.
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : !isMultisigLoading && currentProposal !== undefined ? (
          <>
            <div
              className="max-w-fit cursor-pointer bg-darkGray2 p-3 text-xs font-semibold outline-none transition-colors hover:bg-darkGray3 md:text-base"
              onClick={handleClickBackToProposals}
            >
              &#8592; back to proposals
            </div>
            <div className="relative mt-6">
              <Proposal proposal={currentProposal} multisig={multisigAccount} />
            </div>
          </>
        ) : (
          <div className="mt-3">
            <Loadbar theme="light" />
          </div>
        )}
      </div>
    </div>
  )
}

export default Proposals
