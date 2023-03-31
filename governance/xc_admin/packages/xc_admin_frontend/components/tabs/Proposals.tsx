import * as Tooltip from '@radix-ui/react-tooltip'
import { useWallet } from '@solana/wallet-adapter-react'
import { AccountMeta, PublicKey } from '@solana/web3.js'
import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'
import { useRouter } from 'next/router'
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import toast from 'react-hot-toast'
import {
  ExecutePostedVaa,
  getMultisigCluster,
  getProposals,
  getRemoteCluster,
  MultisigInstruction,
  MultisigParser,
  PRICE_FEED_MULTISIG,
  PythMultisigInstruction,
  UnrecognizedProgram,
  WormholeMultisigInstruction,
} from 'xc_admin_common'
import { ClusterContext } from '../../contexts/ClusterContext'
import { useMultisigContext } from '../../contexts/MultisigContext'
import { usePythContext } from '../../contexts/PythContext'
import { StatusFilterContext } from '../../contexts/StatusFilterContext'
import VerifiedIcon from '../../images/icons/verified.inline.svg'
import VotedIcon from '../../images/icons/voted.inline.svg'
import { capitalizeFirstLetter } from '../../utils/capitalizeFirstLetter'
import ClusterSwitch from '../ClusterSwitch'
import CopyPubkey from '../common/CopyPubkey'
import Spinner from '../common/Spinner'
import Loadbar from '../loaders/Loadbar'
import ProposalStatusFilter from '../ProposalStatusFilter'

// check if a string is a pubkey
const isPubkey = (str: string) => {
  try {
    new PublicKey(str)
    return true
  } catch (e) {
    return false
  }
}

const getMappingCluster = (cluster: string) => {
  if (cluster === 'mainnet-beta' || cluster === 'pythnet') {
    return 'pythnet'
  } else {
    return 'pythtest'
  }
}

const ProposalRow = ({
  proposal,
  verified,
  voted,
  setCurrentProposalPubkey,
  multisig,
}: {
  proposal: TransactionAccount
  verified: boolean
  voted: boolean
  setCurrentProposalPubkey: Dispatch<SetStateAction<string | undefined>>
  multisig: MultisigAccount | undefined
}) => {
  const status = getProposalStatus(proposal, multisig)

  const router = useRouter()

  const handleClickIndividualProposal = useCallback(
    (proposalPubkey: string) => {
      router.query.proposal = proposalPubkey
      setCurrentProposalPubkey(proposalPubkey)
      router.push(
        {
          pathname: router.pathname,
          query: router.query,
        },
        undefined,
        { scroll: true }
      )
    },
    [setCurrentProposalPubkey, router]
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
          <div className="mr-2 items-center flex">
            {verified ? <VerifiedIconWithTooltip /> : null}
          </div>
          {voted ? <VotedIconWithTooltip /> : null}
        </div>
        <div>
          <StatusTag proposalStatus={status} />
        </div>
      </div>
    </div>
  )
}

const SignerTag = () => {
  return (
    <div className="flex max-h-[22px] max-w-[74px] items-center justify-center rounded-full bg-[#605D72] py-1 px-2 text-xs">
      Signer
    </div>
  )
}

const WritableTag = () => {
  return (
    <div className="flex max-h-[22px] max-w-[74px] items-center justify-center rounded-full bg-offPurple py-1 px-2 text-xs">
      Writable
    </div>
  )
}

const StatusTag = ({ proposalStatus }: { proposalStatus: string }) => {
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
      {proposalStatus}
    </div>
  )
}

const VerifiedIconWithTooltip = () => {
  return (
    <div className="flex items-center">
      <Tooltip.Provider delayDuration={100} skipDelayDuration={500}>
        <Tooltip.Root>
          <Tooltip.Trigger>
            <VerifiedIcon />
          </Tooltip.Trigger>
          <Tooltip.Content side="top" sideOffset={8}>
            <span className="inline-block bg-darkGray3 p-2 text-xs text-light hoverable:bg-darkGray">
              The instructions in this proposal are verified.
            </span>
          </Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    </div>
  )
}

const VotedIconWithTooltip = () => {
  return (
    <div className="flex items-center">
      <Tooltip.Provider delayDuration={100} skipDelayDuration={500}>
        <Tooltip.Root>
          <Tooltip.Trigger>
            <VotedIcon />
          </Tooltip.Trigger>
          <Tooltip.Content side="top" sideOffset={8}>
            <span className="inline-block bg-darkGray3 p-2 text-xs text-light hoverable:bg-darkGray">
              You have voted on this proposal.
            </span>
          </Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    </div>
  )
}

const ParsedAccountPubkeyRow = ({
  mapping,
  title,
  pubkey,
}: {
  mapping: { [key: string]: string }
  title: string
  pubkey: string
}) => {
  return (
    <div className="flex justify-between pb-3">
      <div className="max-w-[80px] break-words sm:max-w-none sm:break-normal">
        &#10551; {title}
      </div>
      <div className="space-y-2 sm:flex sm:space-x-2">{mapping[pubkey]}</div>
    </div>
  )
}

const getProposalStatus = (
  proposal: TransactionAccount | ClientProposal | undefined,
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

const Proposal = ({
  publisherKeyToNameMapping,
  multisigSignerKeyToNameMapping,
  proposal,
  proposalIndex,
  instructions,
  verified,
  multisig,
}: {
  publisherKeyToNameMapping: Record<string, Record<string, string>>
  multisigSignerKeyToNameMapping: Record<string, string>
  proposal: TransactionAccount | undefined
  proposalIndex: number
  instructions: MultisigInstruction[]
  verified: boolean
  multisig: MultisigAccount | undefined
}) => {
  const [currentProposal, setCurrentProposal] = useState<TransactionAccount>()
  const [isTransactionLoading, setIsTransactionLoading] = useState(false)
  const [
    productAccountKeyToSymbolMapping,
    setProductAccountKeyToSymbolMapping,
  ] = useState<{ [key: string]: string }>({})
  const [priceAccountKeyToSymbolMapping, setPriceAccountKeyToSymbolMapping] =
    useState<{ [key: string]: string }>({})
  const { cluster } = useContext(ClusterContext)
  const publisherKeyToNameMappingCluster =
    publisherKeyToNameMapping[getMappingCluster(cluster)]
  const {
    voteSquads,
    isLoading: isMultisigLoading,
    setpriceFeedMultisigProposals,
  } = useMultisigContext()
  const { rawConfig, dataIsLoading } = usePythContext()

  useEffect(() => {
    setCurrentProposal(proposal)
  }, [proposal])

  useEffect(() => {
    if (!dataIsLoading) {
      const productAccountMapping: { [key: string]: string } = {}
      const priceAccountMapping: { [key: string]: string } = {}
      rawConfig.mappingAccounts.map((acc) =>
        acc.products.map((prod) => {
          productAccountMapping[prod.address.toBase58()] = prod.metadata.symbol
          priceAccountMapping[prod.priceAccounts[0].address.toBase58()] =
            prod.metadata.symbol
        })
      )
      setProductAccountKeyToSymbolMapping(productAccountMapping)
      setPriceAccountKeyToSymbolMapping(priceAccountMapping)
    }
  }, [rawConfig, dataIsLoading])

  const proposalStatus = getProposalStatus(proposal, multisig)

  useEffect(() => {
    // update the priceFeedMultisigProposals with previous value but replace the current proposal with the updated one at the specific index
    if (currentProposal) {
      setpriceFeedMultisigProposals((prevProposals: TransactionAccount[]) => {
        prevProposals.splice(proposalIndex, 1, currentProposal)
        return [...prevProposals]
      })
    }
  }, [currentProposal, setpriceFeedMultisigProposals, proposalIndex])

  const handleClickApprove = async () => {
    if (proposal && voteSquads) {
      try {
        setIsTransactionLoading(true)
        await voteSquads.approveTransaction(proposal.publicKey)
        const proposals = await getProposals(
          voteSquads,
          PRICE_FEED_MULTISIG[getMultisigCluster(cluster)]
        )
        setCurrentProposal(
          proposals.find(
            (proposal) =>
              proposal.publicKey.toBase58() ===
              currentProposal?.publicKey.toBase58()
          )
        )
        toast.success(`Approved proposal ${proposal.publicKey.toBase58()}`)
        setIsTransactionLoading(false)
      } catch (e: any) {
        setIsTransactionLoading(false)
        toast.error(capitalizeFirstLetter(e.message))
      }
    }
  }

  const handleClickReject = async () => {
    if (proposal && voteSquads) {
      try {
        setIsTransactionLoading(true)
        await voteSquads.rejectTransaction(proposal.publicKey)
        const proposals = await getProposals(
          voteSquads,
          PRICE_FEED_MULTISIG[getMultisigCluster(cluster)]
        )
        setCurrentProposal(
          proposals.find(
            (proposal) =>
              proposal.publicKey.toBase58() ===
              currentProposal?.publicKey.toBase58()
          )
        )
        toast.success(`Rejected proposal ${proposal.publicKey.toBase58()}`)
        setIsTransactionLoading(false)
      } catch (e: any) {
        setIsTransactionLoading(false)
        toast.error(capitalizeFirstLetter(e.message))
      }
    }
  }

  const handleClickExecute = async () => {
    if (proposal && voteSquads) {
      try {
        setIsTransactionLoading(true)
        await voteSquads.executeTransaction(proposal.publicKey)
        const proposals = await getProposals(
          voteSquads,
          PRICE_FEED_MULTISIG[getMultisigCluster(cluster)]
        )
        setCurrentProposal(
          proposals.find(
            (proposal) =>
              proposal.publicKey.toBase58() ===
              currentProposal?.publicKey.toBase58()
          )
        )
        toast.success(`Executed proposal ${proposal.publicKey.toBase58()}`)
        setIsTransactionLoading(false)
      } catch (e: any) {
        setIsTransactionLoading(false)
        toast.error(capitalizeFirstLetter(e.message))
      }
    }
  }

  const handleClickCancel = async () => {
    if (proposal && voteSquads) {
      try {
        setIsTransactionLoading(true)
        await voteSquads.cancelTransaction(proposal.publicKey)
        const proposals = await getProposals(
          voteSquads,
          PRICE_FEED_MULTISIG[getMultisigCluster(cluster)]
        )
        setCurrentProposal(
          proposals.find(
            (proposal) =>
              proposal.publicKey.toBase58() ===
              currentProposal?.publicKey.toBase58()
          )
        )
        toast.success(`Cancelled proposal ${proposal.publicKey.toBase58()}`)
        setIsTransactionLoading(false)
      } catch (e: any) {
        setIsTransactionLoading(false)
        toast.error(capitalizeFirstLetter(e.message))
      }
    }
  }

  return currentProposal !== undefined &&
    multisig !== undefined &&
    !isMultisigLoading ? (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4 lg:col-span-2">
        <div className="flex justify-between">
          <h4 className="h4 font-semibold">Info</h4>
          {verified ? <VerifiedIconWithTooltip /> : null}
        </div>
        <hr className="border-gray-700" />
        <div className="flex justify-between">
          <div>Status</div>
          <StatusTag proposalStatus={proposalStatus} />
        </div>
        <div className="flex justify-between">
          <div>Proposal</div>
          <CopyPubkey pubkey={currentProposal.publicKey.toBase58()} />
        </div>
        <div className="flex justify-between">
          <div>Creator</div>
          <CopyPubkey pubkey={currentProposal.creator.toBase58()} />
        </div>
        <div className="flex justify-between">
          <div>Multisig</div>
          <CopyPubkey pubkey={currentProposal.ms.toBase58()} />
        </div>
      </div>
      <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4 lg:col-span-1">
        <h4 className="h4 mb-4 font-semibold">Results</h4>
        <hr className="border-gray-700" />
        <div className="grid grid-cols-3 justify-center gap-4 text-center align-middle">
          <div>
            <div className="font-bold">Confirmed</div>
            <div className="text-lg">{currentProposal.approved.length}</div>
          </div>
          {proposalStatus === 'active' || proposalStatus === 'rejected' ? (
            <div>
              <div className="font-bold">Rejected</div>
              <div className="text-lg">{currentProposal.rejected.length}</div>
            </div>
          ) : (
            <div>
              <div className="font-bold">Cancelled</div>
              <div className="text-lg">{currentProposal.cancelled.length}</div>
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
              className="action-btn text-base"
              onClick={handleClickApprove}
            >
              {isTransactionLoading ? <Spinner /> : 'Approve'}
            </button>
            <button
              className="sub-action-btn text-base"
              onClick={handleClickReject}
            >
              {isTransactionLoading ? <Spinner /> : 'Reject'}
            </button>
          </div>
        ) : proposalStatus === 'executeReady' ? (
          <div className="flex items-center justify-center space-x-8 pt-3">
            <button
              className="action-btn text-base"
              onClick={handleClickExecute}
            >
              {isTransactionLoading ? <Spinner /> : 'Execute'}
            </button>
            <button
              className="sub-action-btn text-base"
              onClick={handleClickCancel}
            >
              {isTransactionLoading ? <Spinner /> : 'Cancel'}
            </button>
          </div>
        ) : null}
      </div>
      {currentProposal.approved.length > 0 ? (
        <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4">
          <h4 className="h4 font-semibold">
            Confirmed: {currentProposal.approved.length}
          </h4>
          <hr className="border-gray-700" />
          {currentProposal.approved.map((pubkey, idx) => (
            <>
              <div className="flex justify-between" key={pubkey.toBase58()}>
                <div>
                  Key {idx + 1}{' '}
                  {pubkey.toBase58() in multisigSignerKeyToNameMapping
                    ? `(${multisigSignerKeyToNameMapping[pubkey.toBase58()]})`
                    : null}
                </div>
                <CopyPubkey pubkey={pubkey.toBase58()} />
              </div>
            </>
          ))}
        </div>
      ) : null}
      {currentProposal.rejected.length > 0 ? (
        <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4">
          <h4 className="h4 font-semibold">
            Rejected: {currentProposal.rejected.length}
          </h4>
          <hr className="border-gray-700" />
          {currentProposal.rejected.map((pubkey, idx) => (
            <>
              <div className="flex justify-between" key={pubkey.toBase58()}>
                <div>
                  Key {idx + 1}{' '}
                  {pubkey.toBase58() in multisigSignerKeyToNameMapping
                    ? `(${multisigSignerKeyToNameMapping[pubkey.toBase58()]})`
                    : null}
                </div>
                <CopyPubkey pubkey={pubkey.toBase58()} />
              </div>
            </>
          ))}
        </div>
      ) : null}
      {currentProposal.cancelled.length > 0 ? (
        <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4">
          <h4 className="h4 font-semibold">
            Cancelled: {currentProposal.cancelled.length}
          </h4>
          <hr className="border-gray-700" />
          {currentProposal.cancelled.map((pubkey, idx) => (
            <div className="flex justify-between" key={pubkey.toBase58()}>
              <div>
                Key {idx + 1}{' '}
                {pubkey.toBase58() in multisigSignerKeyToNameMapping
                  ? `(${multisigSignerKeyToNameMapping[pubkey.toBase58()]})`
                  : null}
              </div>
              <CopyPubkey pubkey={pubkey.toBase58()} />
            </div>
          ))}
        </div>
      ) : null}
      <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4">
        <h4 className="h4 font-semibold">
          Total Instructions: {instructions.length}
        </h4>
        <hr className="border-gray-700" />
        {instructions?.map((instruction, index) => (
          <>
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
                  : 'Unknown'}
              </div>
            </div>
            {instruction instanceof PythMultisigInstruction ||
            instruction instanceof WormholeMultisigInstruction ? (
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
                  <div>
                    {instruction.governanceAction.targetChainId === 'pythnet' &&
                    getRemoteCluster(cluster) === 'pythtest'
                      ? 'pythtest'
                      : 'pythnet'}
                  </div>
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
                {instruction instanceof PythMultisigInstruction ? (
                  Object.keys(instruction.args).length > 0 ? (
                    <div className="col-span-4 mt-2 bg-darkGray2 p-4 lg:col-span-3 lg:mt-0">
                      <div className="base16 flex justify-between pt-2 pb-6 font-semibold opacity-60">
                        <div>Key</div>
                        <div>Value</div>
                      </div>
                      {Object.keys(instruction.args).map((key, index) => (
                        <>
                          <div
                            key={index}
                            className="flex justify-between border-t border-beige-300 py-3"
                          >
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
                        </>
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
            {instruction instanceof PythMultisigInstruction ? (
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
            {instruction instanceof WormholeMultisigInstruction ? (
              <div className="col-span-4 my-2 space-y-4 bg-darkGray2 p-4 lg:col-span-3">
                <h4 className="h4">Wormhole Instructions</h4>
                <hr className="border-[#E6DAFE] opacity-30" />
                {instruction.governanceAction instanceof ExecutePostedVaa
                  ? instruction.governanceAction.instructions.map(
                      (innerInstruction, index) => {
                        const multisigParser = MultisigParser.fromCluster(
                          getRemoteCluster(cluster)
                        )
                        const parsedInstruction =
                          multisigParser.parseInstruction({
                            programId: innerInstruction.programId,
                            data: innerInstruction.data as Buffer,
                            keys: innerInstruction.keys as AccountMeta[],
                          })
                        return (
                          <>
                            <div
                              key={`${index}_program`}
                              className="flex justify-between"
                            >
                              <div>Program</div>
                              <div>
                                {parsedInstruction instanceof
                                PythMultisigInstruction
                                  ? 'Pyth Oracle'
                                  : innerInstruction instanceof
                                    WormholeMultisigInstruction
                                  ? 'Wormhole'
                                  : 'Unknown'}
                              </div>
                            </div>
                            <div
                              key={`${index}_instructionName`}
                              className="flex justify-between"
                            >
                              <div>Instruction Name</div>
                              <div>
                                {parsedInstruction instanceof
                                  PythMultisigInstruction ||
                                parsedInstruction instanceof
                                  WormholeMultisigInstruction
                                  ? parsedInstruction.name
                                  : 'Unknown'}
                              </div>
                            </div>
                            <div
                              key={`${index}_arguments`}
                              className="grid grid-cols-4 justify-between"
                            >
                              <div>Arguments</div>
                              {parsedInstruction instanceof
                                PythMultisigInstruction ||
                              parsedInstruction instanceof
                                WormholeMultisigInstruction ? (
                                Object.keys(parsedInstruction.args).length >
                                0 ? (
                                  <div className="col-span-4 mt-2 bg-[#444157] p-4 lg:col-span-3 lg:mt-0">
                                    <div className="base16 flex justify-between pt-2 pb-6 font-semibold opacity-60">
                                      <div>Key</div>
                                      <div>Value</div>
                                    </div>
                                    {Object.keys(parsedInstruction.args).map(
                                      (key, index) => (
                                        <>
                                          <div
                                            key={index}
                                            className="flex justify-between border-t border-beige-300 py-3"
                                          >
                                            <div>{key}</div>
                                            {parsedInstruction.args[
                                              key
                                            ] instanceof PublicKey ? (
                                              <CopyPubkey
                                                pubkey={parsedInstruction.args[
                                                  key
                                                ].toBase58()}
                                              />
                                            ) : typeof instruction.args[key] ===
                                                'string' &&
                                              isPubkey(
                                                instruction.args[key]
                                              ) ? (
                                              <CopyPubkey
                                                pubkey={
                                                  parsedInstruction.args[key]
                                                }
                                              />
                                            ) : (
                                              <div className="max-w-sm break-all">
                                                {typeof parsedInstruction.args[
                                                  key
                                                ] === 'string'
                                                  ? parsedInstruction.args[key]
                                                  : parsedInstruction.args[
                                                      key
                                                    ] instanceof Uint8Array
                                                  ? parsedInstruction.args[
                                                      key
                                                    ].toString('hex')
                                                  : JSON.stringify(
                                                      parsedInstruction.args[
                                                        key
                                                      ]
                                                    )}
                                              </div>
                                            )}
                                          </div>
                                          {key === 'pub' &&
                                          parsedInstruction.args[
                                            key
                                          ].toBase58() in
                                            publisherKeyToNameMappingCluster ? (
                                            <ParsedAccountPubkeyRow
                                              key={`${index}_${parsedInstruction.args[
                                                key
                                              ].toBase58()}`}
                                              mapping={
                                                publisherKeyToNameMappingCluster
                                              }
                                              title="publisher"
                                              pubkey={parsedInstruction.args[
                                                key
                                              ].toBase58()}
                                            />
                                          ) : null}
                                        </>
                                      )
                                    )}
                                  </div>
                                ) : (
                                  <div className="col-span-3 text-right">
                                    No arguments
                                  </div>
                                )
                              ) : (
                                <div className="col-span-3 text-right">
                                  Unknown
                                </div>
                              )}
                            </div>
                            {parsedInstruction instanceof
                              PythMultisigInstruction ||
                            parsedInstruction instanceof
                              WormholeMultisigInstruction ? (
                              <div
                                key={`${index}_accounts`}
                                className="grid grid-cols-4 justify-between"
                              >
                                <div>Accounts</div>
                                {Object.keys(parsedInstruction.accounts.named)
                                  .length > 0 ? (
                                  <div className="col-span-4 mt-2 bg-[#444157] p-4 lg:col-span-3 lg:mt-0">
                                    <div className="base16 flex justify-between pt-2 pb-6 font-semibold opacity-60">
                                      <div>Account</div>
                                      <div>Pubkey</div>
                                    </div>
                                    {Object.keys(
                                      parsedInstruction.accounts.named
                                    ).map((key, index) => (
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
                                              {parsedInstruction.accounts.named[
                                                key
                                              ].isSigner ? (
                                                <SignerTag />
                                              ) : null}
                                              {parsedInstruction.accounts.named[
                                                key
                                              ].isWritable ? (
                                                <WritableTag />
                                              ) : null}
                                            </div>
                                            <CopyPubkey
                                              pubkey={parsedInstruction.accounts.named[
                                                key
                                              ].pubkey.toBase58()}
                                            />
                                          </div>
                                        </div>
                                        {key === 'priceAccount' &&
                                        parsedInstruction.accounts.named[
                                          key
                                        ].pubkey.toBase58() in
                                          priceAccountKeyToSymbolMapping ? (
                                          <ParsedAccountPubkeyRow
                                            key="priceAccountPubkey"
                                            mapping={
                                              priceAccountKeyToSymbolMapping
                                            }
                                            title="symbol"
                                            pubkey={parsedInstruction.accounts.named[
                                              key
                                            ].pubkey.toBase58()}
                                          />
                                        ) : key === 'productAccount' &&
                                          parsedInstruction.accounts.named[
                                            key
                                          ].pubkey.toBase58() in
                                            productAccountKeyToSymbolMapping ? (
                                          <ParsedAccountPubkeyRow
                                            key="productAccountPubkey"
                                            mapping={
                                              productAccountKeyToSymbolMapping
                                            }
                                            title="symbol"
                                            pubkey={parsedInstruction.accounts.named[
                                              key
                                            ].pubkey.toBase58()}
                                          />
                                        ) : null}
                                      </>
                                    ))}
                                  </div>
                                ) : (
                                  <div>No arguments</div>
                                )}
                              </div>
                            ) : parsedInstruction instanceof
                              UnrecognizedProgram ? (
                              <>
                                <div
                                  key={`${index}_programId`}
                                  className="flex justify-between"
                                >
                                  <div>Program ID</div>
                                  <div>
                                    {parsedInstruction.instruction.programId.toBase58()}
                                  </div>
                                </div>
                                <div
                                  key={`${index}_data`}
                                  className="flex justify-between"
                                >
                                  <div>Data</div>
                                  <div>
                                    {parsedInstruction.instruction.data.length >
                                    0
                                      ? parsedInstruction.instruction.data.toString(
                                          'hex'
                                        )
                                      : 'No data'}
                                  </div>
                                </div>
                                <div
                                  key={`${index}_keys`}
                                  className="grid grid-cols-4 justify-between"
                                >
                                  <div>Keys</div>
                                  <div className="col-span-4 mt-2 bg-darkGray4 p-4 lg:col-span-3 lg:mt-0">
                                    <div className="base16 flex justify-between pt-2 pb-6 font-semibold opacity-60">
                                      <div>Key #</div>
                                      <div>Pubkey</div>
                                    </div>
                                    {parsedInstruction.instruction.keys.map(
                                      (key, index) => (
                                        <>
                                          <div
                                            key={index}
                                            className="flex justify-between border-t border-beige-300 py-3"
                                          >
                                            <div>Key {index + 1}</div>
                                            <div className="flex space-x-2">
                                              {key.isSigner ? (
                                                <SignerTag />
                                              ) : null}
                                              {key.isWritable ? (
                                                <WritableTag />
                                              ) : null}
                                              <CopyPubkey
                                                pubkey={key.pubkey.toBase58()}
                                              />
                                            </div>
                                          </div>
                                        </>
                                      )
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : null}
                          </>
                        )
                      }
                    )
                  : ''}
              </div>
            ) : null}

            {index !== instructions.length - 1 ? (
              <hr className="border-gray-700" />
            ) : null}
          </>
        ))}
      </div>
    </div>
  ) : (
    <div className="mt-6">
      <Loadbar theme="light" />
    </div>
  )
}

type ClientProposal = TransactionAccount & { verified: boolean; voted: boolean }

const Proposals = ({
  publisherKeyToNameMapping,
  multisigSignerKeyToNameMapping,
}: {
  publisherKeyToNameMapping: Record<string, Record<string, string>>
  multisigSignerKeyToNameMapping: Record<string, string>
}) => {
  const router = useRouter()
  const { connected, publicKey: signerPublicKey } = useWallet()
  const [currentProposal, setCurrentProposal] = useState<TransactionAccount>()
  const [currentProposalIndex, setCurrentProposalIndex] = useState<number>()
  const [allProposalsVerifiedArr, setAllProposalsVerifiedArr] = useState<
    boolean[]
  >([])
  const [proposalsVotedArr, setProposalsVotedArr] = useState<boolean[]>([])
  const [currentProposalPubkey, setCurrentProposalPubkey] = useState<string>()
  const { cluster } = useContext(ClusterContext)
  const { statusFilter } = useContext(StatusFilterContext)
  const {
    priceFeedMultisigAccount,
    priceFeedMultisigProposals,
    allProposalsIxsParsed,
    isLoading: isMultisigLoading,
  } = useMultisigContext()
  const [filteredProposals, setFilteredProposals] = useState<ClientProposal[]>(
    []
  )

  useEffect(() => {
    if (!isMultisigLoading) {
      const res: boolean[] = []
      allProposalsIxsParsed.map((ixs, idx) => {
        const isAllIxsVerified =
          ixs.length > 0 &&
          ixs.every(
            (ix) =>
              ix instanceof PythMultisigInstruction ||
              (ix instanceof WormholeMultisigInstruction &&
                ix.name === 'postMessage' &&
                ix.governanceAction instanceof ExecutePostedVaa &&
                ix.governanceAction.instructions.every((remoteIx) => {
                  const innerMultisigParser = MultisigParser.fromCluster(
                    getRemoteCluster(cluster)
                  )
                  const parsedRemoteInstruction =
                    innerMultisigParser.parseInstruction({
                      programId: remoteIx.programId,
                      data: remoteIx.data as Buffer,
                      keys: remoteIx.keys as AccountMeta[],
                    })
                  return (
                    parsedRemoteInstruction instanceof PythMultisigInstruction
                  )
                }) &&
                ix.governanceAction.targetChainId === 'pythnet')
          ) &&
          Object.keys(priceFeedMultisigProposals[idx].status)[0] !== 'draft'

        res.push(isAllIxsVerified)
      })
      setAllProposalsVerifiedArr(res)
    }
  }, [
    allProposalsIxsParsed,
    isMultisigLoading,
    cluster,
    priceFeedMultisigProposals,
  ])

  const handleClickBackToPriceFeeds = () => {
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
    }
  }, [router.query.proposal])

  useEffect(() => {
    if (currentProposalPubkey) {
      const currProposal = priceFeedMultisigProposals.find(
        (proposal) => proposal.publicKey.toBase58() === currentProposalPubkey
      )
      const currProposalIndex = priceFeedMultisigProposals.findIndex(
        (proposal) => proposal.publicKey.toBase58() === currentProposalPubkey
      )
      setCurrentProposal(currProposal)
      setCurrentProposalIndex(
        currProposalIndex === -1 ? undefined : currProposalIndex
      )
    }
  }, [
    currentProposalPubkey,
    priceFeedMultisigProposals,
    allProposalsIxsParsed,
    cluster,
  ])

  useEffect(() => {
    const allClientProposals = priceFeedMultisigProposals.map(
      (proposal, idx) => ({
        ...proposal,
        verified: allProposalsVerifiedArr[idx],
        voted: proposalsVotedArr[idx],
      })
    )
    // filter price feed multisig proposals by status
    if (statusFilter === 'all') {
      // pass priceFeedMultisigProposals and add verified and voted props
      setFilteredProposals(allClientProposals)
    } else {
      setFilteredProposals(
        allClientProposals.filter(
          (proposal) =>
            getProposalStatus(proposal, priceFeedMultisigAccount) ===
            statusFilter
        )
      )
    }
  }, [
    statusFilter,
    priceFeedMultisigAccount,
    priceFeedMultisigProposals,
    allProposalsVerifiedArr,
    proposalsVotedArr,
  ])

  useEffect(() => {
    if (priceFeedMultisigAccount && connected && signerPublicKey) {
      const res: boolean[] = []
      priceFeedMultisigProposals.map((proposal) => {
        // check if proposal.approved, proposal.cancelled, proposal.rejected has wallet pubkey and return true if anyone of them has wallet pubkey
        const isProposalVoted =
          proposal.approved.some(
            (p) => p.toBase58() === signerPublicKey.toBase58()
          ) ||
          proposal.cancelled.some(
            (p) => p.toBase58() === signerPublicKey.toBase58()
          ) ||
          proposal.rejected.some(
            (p) => p.toBase58() === signerPublicKey.toBase58()
          )
        res.push(isProposalVoted)
      })
      setProposalsVotedArr(res)
    }
  }, [
    priceFeedMultisigAccount,
    priceFeedMultisigProposals,
    connected,
    signerPublicKey,
  ])

  return (
    <div className="relative">
      <div className="container flex flex-col items-center justify-between lg:flex-row">
        <div className="mb-4 w-full text-left lg:mb-0">
          <h1 className="h1 mb-4">
            {router.query.proposal === undefined ? 'Proposals' : 'Proposal'}
          </h1>
        </div>
      </div>
      <div className="container min-h-[50vh]">
        {router.query.proposal === undefined ? (
          <>
            <div className="flex justify-between">
              <div className="mb-4 md:mb-0">
                <ClusterSwitch />
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
                          key={idx}
                          proposal={proposal}
                          verified={proposal.verified}
                          voted={proposal.voted}
                          setCurrentProposalPubkey={setCurrentProposalPubkey}
                          multisig={priceFeedMultisigAccount}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4">
                      No proposals found. If you&apos;re a member of the price
                      feed multisig, you can create a proposal.
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : !isMultisigLoading && currentProposalIndex !== undefined ? (
          <>
            <div
              className="max-w-fit cursor-pointer bg-darkGray2 p-3 text-xs font-semibold outline-none transition-colors hover:bg-darkGray3 md:text-base"
              onClick={handleClickBackToPriceFeeds}
            >
              &#8592; back to proposals
            </div>
            <div className="relative mt-6">
              <Proposal
                publisherKeyToNameMapping={publisherKeyToNameMapping}
                multisigSignerKeyToNameMapping={multisigSignerKeyToNameMapping}
                proposal={currentProposal}
                proposalIndex={currentProposalIndex}
                instructions={allProposalsIxsParsed[currentProposalIndex]}
                verified={allProposalsVerifiedArr[currentProposalIndex]}
                multisig={priceFeedMultisigAccount}
              />
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
