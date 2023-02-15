import { BN } from '@coral-xyz/anchor'
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
import toast from 'react-hot-toast'
import {
  ExecutePostedVaa,
  getMultisigCluster,
  getRemoteCluster,
  MultisigInstruction,
  MultisigParser,
  PythMultisigInstruction,
  UnrecognizedProgram,
  WormholeMultisigInstruction,
} from 'xc_admin_common'
import { ClusterContext } from '../../contexts/ClusterContext'
import { useMultisigContext } from '../../contexts/MultisigContext'
import CopyIcon from '../../images/icons/copy.inline.svg'
import { capitalizeFirstLetter } from '../../utils/capitalizeFirstLetter'
import ClusterSwitch from '../ClusterSwitch'
import CopyPubkey from '../common/CopyPubkey'
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
        <div>
          {' '}
          <span className="mr-2 hidden sm:block">
            {proposal.publicKey.toBase58()}
          </span>
          <span className="mr-2 sm:hidden">
            {proposal.publicKey.toBase58().slice(0, 6) +
              '...' +
              proposal.publicKey.toBase58().slice(-6)}
          </span>{' '}
        </div>

        <StatusTag proposalStatus={status} />
      </div>
    </div>
  )
}

const SignerTag = () => {
  return (
    <div className="flex items-center justify-center rounded-full bg-[#605D72] py-1 px-2 text-xs">
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
          : 'bg-pythPurple'
      } py-1 px-2 text-xs`}
    >
      {proposalStatus}
    </div>
  )
}

const Proposal = ({
  proposal,
  multisig,
}: {
  proposal: TransactionAccount | undefined
  multisig: MultisigAccount | undefined
}) => {
  const [proposalInstructions, setProposalInstructions] = useState<
    MultisigInstruction[]
  >([])
  const [isProposalInstructionsLoading, setIsProposalInstructionsLoading] =
    useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const { cluster } = useContext(ClusterContext)
  const { squads, isLoading: isMultisigLoading } = useMultisigContext()

  const proposalStatus = proposal ? Object.keys(proposal.status)[0] : 'unknown'

  useEffect(() => {
    const fetchProposalInstructions = async () => {
      const multisigParser = MultisigParser.fromCluster(
        getMultisigCluster(cluster)
      )
      if (squads && proposal) {
        setIsProposalInstructionsLoading(true)
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
        setIsVerified(
          proposalIxs.every(
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
          )
        )
        setProposalInstructions(proposalIxs)
        setIsProposalInstructionsLoading(false)
      }
    }

    fetchProposalInstructions()
  }, [proposal, squads, cluster])

  const handleClickApprove = async () => {
    if (proposal && squads) {
      try {
        console.log(squads.wallet.publicKey.toBase58())
        await squads.approveTransaction(proposal.publicKey)
        toast.success(`Approved proposal ${proposal.publicKey.toBase58()}`)
      } catch (e: any) {
        toast.error(capitalizeFirstLetter(e.message))
      }
    }
  }

  const handleClickReject = async () => {
    if (proposal && squads) {
      try {
        await squads.rejectTransaction(proposal.publicKey)
        toast.success(`Rejected proposal ${proposal.publicKey.toBase58()}`)
      } catch (e: any) {
        toast.error(capitalizeFirstLetter(e.message))
      }
    }
  }

  const handleClickExecute = async () => {
    if (proposal && squads) {
      try {
        await squads.executeTransaction(proposal.publicKey)
        toast.success(`Executed proposal ${proposal.publicKey.toBase58()}`)
      } catch (e: any) {
        toast.error(capitalizeFirstLetter(e.message))
      }
    }
  }

  const handleClickCancel = async () => {
    if (proposal && squads) {
      try {
        await squads.cancelTransaction(proposal.publicKey)
        toast.success(`Cancelled proposal ${proposal.publicKey.toBase58()}`)
      } catch (e: any) {
        toast.error(capitalizeFirstLetter(e.message))
      }
    }
  }

  return proposal !== undefined &&
    multisig !== undefined &&
    !isMultisigLoading &&
    !isProposalInstructionsLoading ? (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4 lg:col-span-2">
        <div className="flex justify-between">
          <h4 className="h4 font-semibold">Info</h4>
          <div
            className={`flex items-center justify-center rounded-full py-1 px-2 text-xs ${
              isVerified ? 'bg-[#187B51]' : 'bg-[#8D2D41]'
            }`}
          >
            {isVerified ? 'Verified' : 'Unverified'}
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
        {proposalStatus === 'active' ? (
          <div className="flex items-center justify-center space-x-8 pt-3">
            <button
              className="action-btn text-base"
              onClick={handleClickApprove}
            >
              Approve
            </button>
            <button
              className="sub-action-btn text-base"
              onClick={handleClickReject}
            >
              Reject
            </button>
          </div>
        ) : proposalStatus === 'executeReady' ? (
          <div className="flex items-center justify-between px-8 pt-3">
            <button
              className="action-btn text-base"
              onClick={handleClickExecute}
            >
              Execute
            </button>
            <button
              className="sub-action-btn text-base"
              onClick={handleClickCancel}
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>
      <div className="col-span-3 my-2 space-y-4 bg-[#1E1B2F] p-4">
        <h4 className="h4 font-semibold">Instructions</h4>
        <hr className="border-gray-700" />
        {proposalInstructions?.map((instruction, index) => (
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
                        <div
                          key={index}
                          className="flex justify-between border-t border-beige-300 py-3"
                        >
                          <div>{key}</div>
                          {instruction.args[key] instanceof PublicKey ? (
                            <CopyPubkey
                              pubkey={instruction.args[key].toBase58()}
                            />
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
                            <div>{key}</div>
                            <div className="flex space-x-2">
                              {instruction.accounts.named[key].isSigner ? (
                                <SignerTag />
                              ) : null}
                              {instruction.accounts.named[key].isWritable ? (
                                <WritableTag />
                              ) : null}
                              <CopyPubkey
                                pubkey={instruction.accounts.named[
                                  key
                                ].pubkey.toBase58()}
                              />
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
                                                    parsedInstruction.args[key]
                                                  )}
                                            </div>
                                          )}
                                        </div>
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
                                          <div>{key}</div>
                                          <div className="flex space-x-2">
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
                                            <div
                                              className="-ml-1 inline-flex cursor-pointer items-center px-1 hover:bg-dark hover:text-white active:bg-darkGray3"
                                              onClick={() => {
                                                copy(
                                                  parsedInstruction.accounts.named[
                                                    key
                                                  ].pubkey.toBase58()
                                                )
                                              }}
                                            >
                                              <span className="mr-2 hidden xl:block">
                                                {parsedInstruction.accounts.named[
                                                  key
                                                ].pubkey.toBase58()}
                                              </span>
                                              <span className="mr-2 xl:hidden">
                                                {parsedInstruction.accounts.named[
                                                  key
                                                ].pubkey
                                                  .toBase58()
                                                  .slice(0, 6) +
                                                  '...' +
                                                  parsedInstruction.accounts.named[
                                                    key
                                                  ].pubkey
                                                    .toBase58()
                                                    .slice(-6)}
                                              </span>{' '}
                                              <CopyIcon className="shrink-0" />
                                            </div>
                                          </div>
                                        </div>
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
                                                  {key.pubkey
                                                    .toBase58()
                                                    .slice(0, 6) +
                                                    '...' +
                                                    key.pubkey
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

            {index !== proposalInstructions.length - 1 ? (
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

const Proposals = () => {
  const router = useRouter()
  const [currentProposal, setCurrentProposal] = useState<TransactionAccount>()
  const [currentProposalPubkey, setCurrentProposalPubkey] = useState<string>()
  const {
    priceFeedMultisigAccount,
    priceFeedMultisigProposals,
    isLoading: isMultisigLoading,
  } = useMultisigContext()

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
      const currentProposal = priceFeedMultisigProposals.find(
        (proposal) => proposal.publicKey.toBase58() === currentProposalPubkey
      )
      setCurrentProposal(currentProposal)
    }
  }, [currentProposalPubkey, priceFeedMultisigProposals])

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
              ) : priceFeedMultisigProposals.length > 0 ? (
                <div className="flex flex-col">
                  {priceFeedMultisigProposals.map((proposal, idx) => (
                    <ProposalRow
                      key={idx}
                      proposal={proposal}
                      setCurrentProposalPubkey={setCurrentProposalPubkey}
                    />
                  ))}
                </div>
              ) : (
                "No proposals found. If you're a member of the price feed multisig, you can create a proposal."
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
            <div className="relative mt-6">
              <Proposal
                proposal={currentProposal}
                multisig={priceFeedMultisigAccount}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Proposals
