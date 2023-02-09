import { BN, Wallet } from '@coral-xyz/anchor'
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes'
import { useAnchorWallet } from '@solana/wallet-adapter-react'
import { AccountMeta, PublicKey } from '@solana/web3.js'
import { getIxPDA } from '@sqds/mesh'
import { MultisigAccount, TransactionAccount } from '@sqds/mesh/lib/types'
import copy from 'copy-to-clipboard'
import { useRouter } from 'next/router'
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import {
  getMultisigCluster,
  getProposals,
  MultisigInstruction,
  MultisigParser,
  PythMultisigInstruction,
  UnrecognizedProgram,
  WormholeMultisigInstruction,
} from 'xc_admin_common'
import { ClusterContext } from '../../contexts/ClusterContext'
import { SECURITY_MULTISIG, useMultisig } from '../../hooks/useMultisig'
import CopyIcon from '../../images/icons/copy.inline.svg'
import ClusterSwitch from '../ClusterSwitch'
import Loadbar from '../loaders/Loadbar'

const ProposalRow = ({
  proposal,
  setCurrentProposalPubkey,
}: {
  proposal: TransactionAccount
  setCurrentProposalPubkey: Dispatch<SetStateAction<string | undefined>>
}) => {
  const status = Object.keys(proposal.status)[0]

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
        { scroll: false }
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
        <div>{proposal.publicKey.toBase58()}</div>
        <div
          className={
            status === 'active'
              ? 'text-[#E5D8FE]'
              : status === 'executed'
              ? 'text-[#15AE6E]'
              : status === 'cancelled'
              ? 'text-[#FF5E00]'
              : status === 'rejected'
              ? 'text-[#F54562]'
              : ''
          }
        >
          {status}
        </div>
      </div>
    </div>
  )
}

const SignerTag = () => {
  return (
    <div className="flex items-center justify-center rounded-full bg-darkGray4 py-1 px-2 text-xs">
      Signer
    </div>
  )
}

const WritableTag = () => {
  return (
    <div className="flex items-center justify-center rounded-full bg-offPurple py-1 px-2 text-xs">
      Writable
    </div>
  )
}

const Proposal = ({
  proposal,
  multisig,
}: {
  proposal: TransactionAccount
  multisig: any
}) => {
  const [proposalInstructions, setProposalInstructions] = useState<
    MultisigInstruction[]
  >([])
  const { cluster } = useContext(ClusterContext)
  const anchorWallet = useAnchorWallet()
  const { squads } = useMultisig(anchorWallet as Wallet)

  useEffect(() => {
    const fetchProposalInstructions = async () => {
      const multisigParser = MultisigParser.fromCluster(
        getMultisigCluster(cluster)
      )
      if (squads) {
        const proposalIxs = []
        for (let i = 1; i <= proposal.instructionIndex; i++) {
          const instructionPda = getIxPDA(
            proposal.publicKey,
            new BN(i),
            squads.multisigProgramId
          )[0]
          const instruction = await squads.getInstruction(instructionPda)
          const parsedInstruction = multisigParser.parseInstruction({
            programId: instruction.programId,
            data: instruction.data as Buffer,
            keys: instruction.keys as AccountMeta[],
          })

          proposalIxs.push(parsedInstruction)
        }
        setProposalInstructions(proposalIxs)
      }
    }

    fetchProposalInstructions()
  }, [proposal, squads, cluster])

  return proposalInstructions ? (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4 lg:col-span-2">
        <h4 className="h4">Info</h4>
        <hr className="border-gray-700" />
        <div className="flex justify-between">
          <div>Proposal Pubkey</div>
          <div>{proposal.publicKey.toBase58()}</div>
        </div>
        <div className="flex justify-between">
          <div>Creator</div>
          <div>{proposal.creator.toBase58()}</div>
        </div>
        <div className="flex justify-between">
          <div>Multisig</div>
          <div>{proposal.ms.toBase58()}</div>
        </div>
      </div>
      <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4 lg:col-span-1">
        <h4 className="h4 mb-4">Results</h4>
        <hr className="border-gray-700" />
        <div className="grid grid-cols-3 justify-center gap-4 pt-5 text-center align-middle">
          <div>
            <div className="font-bold">Confirmed</div>
            <div className="text-lg">{proposal.approved.length}</div>
          </div>
          <div>
            <div className="font-bold">Cancelled</div>
            <div className="text-lg">{proposal.cancelled.length}</div>
          </div>
          <div>
            <div className="font-bold">Threshold</div>
            <div className="text-lg">
              {multisig.threshold}/{multisig.keys.length}
            </div>
          </div>
        </div>
      </div>
      <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4">
        <h4 className="h4">Instructions</h4>
        <hr className="border-gray-700" />
        {proposalInstructions?.map((instruction, index) => (
          <>
            <div key={`${index}_instruction`} className="flex justify-between">
              <div>Instruction</div>
              <div>
                {instruction instanceof PythMultisigInstruction ||
                instruction instanceof WormholeMultisigInstruction
                  ? instruction.name
                  : 'Unknown'}
              </div>
            </div>
            <div
              key={`${index}_arguments`}
              className="grid grid-cols-4 justify-between"
            >
              <div>Arguments</div>
              {instruction instanceof PythMultisigInstruction ||
              instruction instanceof WormholeMultisigInstruction ? (
                Object.keys(instruction.args).length > 0 ? (
                  <div className="col-span-4 mt-2 bg-darkGray2 p-4 lg:col-span-3 lg:mt-0">
                    <div className="base16 flex justify-between pt-2 pb-6 font-semibold opacity-60">
                      <div>Key</div>
                      <div>Value</div>
                    </div>
                    {Object.keys(instruction.args).map((key, index) => (
                      <div
                        key={index}
                        className="flex justify-between border-t border-beige-300 py-3"
                      >
                        <div>{key}</div>
                        <div>
                          {instruction.args[key] instanceof PublicKey
                            ? instruction.args[key].toBase58()
                            : typeof instruction.args[key] === 'string'
                            ? instruction.args[key]
                            : JSON.stringify(instruction.args[key])}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="col-span-3 text-right">No arguments</div>
                )
              ) : (
                <div className="col-span-3 text-right">Unknown</div>
              )}
            </div>
            {instruction instanceof PythMultisigInstruction ||
            instruction instanceof WormholeMultisigInstruction ? (
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
                            <div>{key}</div>
                            <div className="flex space-x-2">
                              {instruction.accounts.named[key].isSigner ? (
                                <SignerTag />
                              ) : null}
                              {instruction.accounts.named[key].isWritable ? (
                                <WritableTag />
                              ) : null}
                              <div
                                className="-ml-1 inline-flex cursor-pointer items-center px-1 hover:bg-dark hover:text-white active:bg-darkGray3"
                                onClick={() => {
                                  copy(
                                    instruction.accounts.named[
                                      key
                                    ].pubkey.toBase58()
                                  )
                                }}
                              >
                                <span className="mr-2 hidden xl:block">
                                  {instruction.accounts.named[
                                    key
                                  ].pubkey.toBase58()}
                                </span>
                                <span className="mr-2 xl:hidden">
                                  {instruction.accounts.named[key].pubkey
                                    .toBase58()
                                    .slice(0, 6) +
                                    '...' +
                                    instruction.accounts.named[key].pubkey
                                      .toBase58()
                                      .slice(-6)}
                                </span>{' '}
                                <CopyIcon className="shrink-0" />
                              </div>
                            </div>
                          </div>
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
                  <div>{instruction.instruction.programId.toBase58()}</div>
                </div>
                <div key={`${index}_data`} className="flex justify-between">
                  <div>Data</div>
                  <div>
                    {instruction.instruction.data.length > 0
                      ? bs58.encode(instruction.instruction.data)
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
                            <div
                              className="-ml-1 inline-flex cursor-pointer items-center px-1 hover:bg-dark hover:text-white active:bg-darkGray3"
                              onClick={() => {
                                copy(key.pubkey.toBase58())
                              }}
                            >
                              <span className="mr-2 hidden xl:block">
                                {key.pubkey.toBase58()}
                              </span>
                              <span className="mr-2 xl:hidden">
                                {key.pubkey.toBase58().slice(0, 6) +
                                  '...' +
                                  key.pubkey.toBase58().slice(-6)}
                              </span>{' '}
                              <CopyIcon className="shrink-0" />
                            </div>
                          </div>
                        </div>
                      </>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
            {index !== proposalInstructions.length - 1 ? (
              <hr className="border-gray-700" />
            ) : null}
          </>
        ))}
      </div>
    </div>
  ) : (
    <div className="mt-3">
      <Loadbar theme="light" />
    </div>
  )
}

const Proposals = () => {
  const router = useRouter()
  const [multisig, setMultisig] = useState<MultisigAccount>()
  const [proposals, setProposals] = useState<TransactionAccount[]>([])
  const [currentProposal, setCurrentProposal] = useState<TransactionAccount>()
  const [currentProposalPubkey, setCurrentProposalPubkey] = useState<string>()
  const [dataIsLoading, setDataIsLoading] = useState<boolean>(false)
  const { cluster } = useContext(ClusterContext)
  const anchorWallet = useAnchorWallet()
  const { isLoading: isMultisigLoading, squads } = useMultisig(
    anchorWallet as Wallet
  )

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
    const fetchProposals = async () => {
      setDataIsLoading(true)
      if (squads) {
        // TODO: support get proposals from other cluster when the security multisig is deployed
        if (cluster === 'devnet') {
          const sqdsProposals = await getProposals(
            squads,
            SECURITY_MULTISIG[cluster],
            undefined,
            'all'
          )
          setMultisig(await squads.getMultisig(SECURITY_MULTISIG[cluster]))
          setProposals(
            sqdsProposals.sort(
              (a, b) => b.transactionIndex - a.transactionIndex
            )
          )
        } else {
          setProposals([])
        }
      }
      setDataIsLoading(false)
    }
    fetchProposals()
  }, [squads, cluster])

  useEffect(() => {
    if (router.query.proposal) {
      setCurrentProposalPubkey(router.query.proposal as string)
    }
  }, [router.query.proposal])

  useEffect(() => {
    if (currentProposalPubkey) {
      const currentProposal = proposals.find(
        (proposal) => proposal.publicKey.toBase58() === currentProposalPubkey
      )
      setCurrentProposal(currentProposal)
    }
  }, [currentProposalPubkey, proposals])

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
              {isMultisigLoading || dataIsLoading ? (
                <div className="mt-3">
                  <Loadbar theme="light" />
                </div>
              ) : proposals.length > 0 ? (
                <div className="flex flex-col">
                  {proposals.map((proposal, idx) => (
                    <ProposalRow
                      key={idx}
                      proposal={proposal}
                      setCurrentProposalPubkey={setCurrentProposalPubkey}
                    />
                  ))}
                </div>
              ) : (
                "No proposals found. If you're a member of the security multisig, you can create a proposal."
              )}
            </div>
          </>
        ) : (
          <>
            <div
              className="max-w-fit cursor-pointer bg-darkGray2 p-3 text-xs font-semibold outline-none transition-colors hover:bg-darkGray3 md:text-base"
              onClick={handleClickBackToPriceFeeds}
            >
              &#8592; back to proposals
            </div>
            {currentProposal ? (
              <div className="relative mt-6">
                <Proposal proposal={currentProposal} multisig={multisig} />
              </div>
            ) : (
              <div className="mt-6">
                <Loadbar theme="light" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Proposals
