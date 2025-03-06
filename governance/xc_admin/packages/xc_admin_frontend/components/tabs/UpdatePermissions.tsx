import { AnchorProvider, Program } from '@coral-xyz/anchor'
import {
  getPythProgramKeyForCluster,
  pythOracleProgram,
} from '@pythnetwork/client'
import { PythOracle } from '@pythnetwork/client/lib/anchor'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletModalButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey } from '@solana/web3.js'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import copy from 'copy-to-clipboard'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  BPF_UPGRADABLE_LOADER,
  getMultisigCluster,
  isRemoteCluster,
  mapKey,
  UPGRADE_MULTISIG,
  MultisigVault,
} from '@pythnetwork/xc-admin-common'
import { ClusterContext } from '../../contexts/ClusterContext'
import { useMultisigContext } from '../../contexts/MultisigContext'
import { usePythContext } from '../../contexts/PythContext'
import CopyIcon from '@images/icons/copy.inline.svg'
import { capitalizeFirstLetter } from '../../utils/capitalizeFirstLetter'
import ClusterSwitch from '../ClusterSwitch'
import Modal from '../common/Modal'
import Spinner from '../common/Spinner'
import EditButton from '../EditButton'
import Loadbar from '../loaders/Loadbar'
import { Wallet } from '@coral-xyz/anchor/dist/cjs/provider'

interface UpdatePermissionsProps {
  account: PermissionAccount
  pubkey: string
  newPubkey?: string
}

const DEFAULT_DATA: UpdatePermissionsProps[] = [
  {
    account: 'Master Authority',
    pubkey: new PublicKey(0).toBase58(),
  },
  {
    account: 'Data Curation Authority',
    pubkey: new PublicKey(0).toBase58(),
  },
  {
    account: 'Security Authority',
    pubkey: new PublicKey(0).toBase58(),
  },
]

const columnHelper = createColumnHelper<UpdatePermissionsProps>()

const defaultColumns = [
  columnHelper.accessor('account', {
    cell: (info) => info.getValue(),
    header: () => <span>Account</span>,
  }),
  columnHelper.accessor('pubkey', {
    cell: (props) => {
      const pubkey = props.getValue()
      return (
        <>
          <div
            className="-ml-1 inline-flex cursor-pointer items-center px-1 hover:bg-dark hover:text-white active:bg-darkGray3"
            onClick={() => {
              copy(pubkey)
            }}
          >
            <span className="mr-2 hidden lg:block">{pubkey}</span>
            <span className="mr-2 lg:hidden">
              {pubkey.slice(0, 6) + '...' + pubkey.slice(-6)}
            </span>{' '}
            <CopyIcon className="shrink-0" />
          </div>
        </>
      )
    },
    header: () => <span>Public Key</span>,
  }),
]

type PermissionAccount =
  | 'Master Authority'
  | 'Data Curation Authority'
  | 'Security Authority'

interface PermissionAccountInfo {
  prev: string
  new: string
}

const UpdatePermissions = () => {
  const [data, setData] = useState(() => [...DEFAULT_DATA])
  const [columns, setColumns] = useState(() => [...defaultColumns])
  const [pubkeyChanges, setPubkeyChanges] =
    useState<Partial<Record<PermissionAccount, PermissionAccountInfo>>>()
  const [finalPubkeyChanges, setFinalPubkeyChanges] =
    useState<Record<PermissionAccount, PermissionAccountInfo>>()
  const [editable, setEditable] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSendProposalButtonLoading, setIsSendProposalButtonLoading] =
    useState(false)
  const { cluster } = useContext(ClusterContext)
  const { isLoading: isMultisigLoading, walletSquads } = useMultisigContext()
  const { rawConfig, dataIsLoading, connection } = usePythContext()
  const { connected } = useWallet()
  const [pythProgramClient, setPythProgramClient] =
    useState<Program<PythOracle>>()

  useEffect(() => {
    if (rawConfig.permissionAccount) {
      const masterAuthority =
        rawConfig.permissionAccount.masterAuthority.toBase58()
      const dataCurationAuthority =
        rawConfig.permissionAccount.dataCurationAuthority.toBase58()
      const securityAuthority =
        rawConfig.permissionAccount.securityAuthority.toBase58()
      setData([
        {
          account: 'Master Authority',
          pubkey: masterAuthority,
        },
        {
          account: 'Data Curation Authority',
          pubkey: dataCurationAuthority,
        },
        {
          account: 'Security Authority',
          pubkey: securityAuthority,
        },
      ])
    } else {
      setData([...DEFAULT_DATA])
    }
  }, [rawConfig])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const backfillPubkeyChanges = () => {
    const newPubkeyChanges: Record<PermissionAccount, PermissionAccountInfo> = {
      'Master Authority': {
        prev: data[0].pubkey,
        new: data[0].pubkey,
      },
      'Data Curation Authority': {
        prev: data[1].pubkey,
        new: data[1].pubkey,
      },
      'Security Authority': {
        prev: data[2].pubkey,
        new: data[2].pubkey,
      },
    }
    if (pubkeyChanges) {
      Object.keys(pubkeyChanges).forEach((key) => {
        newPubkeyChanges[key as PermissionAccount] = pubkeyChanges[
          key as PermissionAccount
        ] as PermissionAccountInfo
      })
    }

    return newPubkeyChanges
  }

  const handleEditButtonClick = () => {
    const nextState = !editable
    if (nextState) {
      const newColumns = [
        ...defaultColumns,
        columnHelper.accessor('newPubkey', {
          cell: (info) => info.getValue(),
          header: () => <span>New Public Key</span>,
        }),
      ]
      setColumns(newColumns)
    } else {
      if (pubkeyChanges && Object.keys(pubkeyChanges).length > 0) {
        openModal()
        setFinalPubkeyChanges(backfillPubkeyChanges())
      } else {
        setColumns(defaultColumns)
      }
    }
    setEditable(nextState)
  }

  const openModal = () => {
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  // check if pubkey is valid
  const isValidPubkey = (pubkey: string) => {
    try {
      new PublicKey(pubkey)
      return true
    } catch (e) {
      return false
    }
  }

  const handleEditPubkey = (
    e: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    account: PermissionAccount,
    prevPubkey: string
  ) => {
    const newPubkey = e.target.textContent
    if (isValidPubkey(newPubkey) && newPubkey !== prevPubkey) {
      setPubkeyChanges({
        ...pubkeyChanges,
        [account]: {
          prev: prevPubkey,
          new: newPubkey,
        },
      })
    } else {
      // delete account from pubkeyChanges if it exists
      if (pubkeyChanges && pubkeyChanges[account]) {
        delete pubkeyChanges[account]
      }
      setPubkeyChanges(pubkeyChanges)
    }
  }

  const handleSendProposalButtonClick = () => {
    if (pythProgramClient && finalPubkeyChanges && walletSquads) {
      const programDataAccount = PublicKey.findProgramAddressSync(
        [pythProgramClient?.programId.toBuffer()],
        BPF_UPGRADABLE_LOADER
      )[0]
      const multisigAuthority = walletSquads.getAuthorityPDA(
        UPGRADE_MULTISIG[getMultisigCluster(cluster)],
        1
      )

      pythProgramClient?.methods
        .updPermissions(
          new PublicKey(finalPubkeyChanges['Master Authority'].new),
          new PublicKey(finalPubkeyChanges['Data Curation Authority'].new),
          new PublicKey(finalPubkeyChanges['Security Authority'].new)
        )
        .accounts({
          upgradeAuthority: isRemoteCluster(cluster)
            ? mapKey(multisigAuthority)
            : multisigAuthority,
          programDataAccount,
        })
        .instruction()
        .then(async (instruction) => {
          if (!isMultisigLoading) {
            setIsSendProposalButtonLoading(true)
            try {
              const vault = new MultisigVault(
                walletSquads.wallet as Wallet,
                getMultisigCluster(cluster),
                walletSquads,
                UPGRADE_MULTISIG[getMultisigCluster(cluster)]
              )

              const proposalPubkey = (
                await vault.proposeInstructions([instruction], cluster)
              )[0]
              toast.success(
                `Proposal sent! 🚀 Proposal Pubkey: ${proposalPubkey}`
              )
              setIsSendProposalButtonLoading(false)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (e: any) {
              toast.error(capitalizeFirstLetter(e.message))
              setIsSendProposalButtonLoading(false)
            }
          }
        })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ModalContent = ({ changes }: { changes: any }) => {
    return (
      <>
        {Object.keys(changes).length > 0 ? (
          <div className="mb-10">
            {Object.keys(changes).map((key) => {
              return (
                changes[key].prev !== changes[key].new && (
                  <>
                    <div
                      key={key}
                      className="mb-4 flex items-center justify-between"
                    >
                      <span className="pr-4 text-left font-bold">{key}</span>
                      <span className="mr-2">
                        {changes[key].prev} &rarr; {changes[key].new}
                      </span>
                    </div>
                  </>
                )
              )
            })}
          </div>
        ) : (
          <p className="mb-8 leading-6">No proposed changes.</p>
        )}
        {Object.keys(changes).length > 0 ? (
          !connected ? (
            <div className="flex justify-center">
              <WalletModalButton className="action-btn text-base" />
            </div>
          ) : (
            <button
              className="action-btn text-base"
              onClick={handleSendProposalButtonClick}
            >
              {isSendProposalButtonLoading ? <Spinner /> : 'Send Proposal'}
            </button>
          )
        ) : null}
      </>
    )
  }

  // create anchor wallet when connected
  useEffect(() => {
    if (connected && walletSquads && connection) {
      const provider = new AnchorProvider(
        connection,
        walletSquads.wallet as Wallet,
        AnchorProvider.defaultOptions()
      )
      setPythProgramClient(
        pythOracleProgram(getPythProgramKeyForCluster(cluster), provider)
      )
    }
  }, [connection, connected, cluster, walletSquads])

  return (
    <div className="relative">
      <Modal
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        closeModal={closeModal}
        content={<ModalContent changes={pubkeyChanges} />}
      />
      <div className="container flex flex-col items-center justify-between lg:flex-row">
        <div className="mb-4 w-full text-left lg:mb-0">
          <h1 className="h1 mb-4">Update Permissions</h1>
        </div>
      </div>
      <div className="container min-h-[50vh]">
        <div className="flex justify-between">
          <div className="mb-4 md:mb-0">
            <ClusterSwitch />
          </div>
          <div className="mb-4 md:mb-0">
            <EditButton editable={editable} onClick={handleEditButtonClick} />
          </div>
        </div>
        <div className="relative mt-6">
          {dataIsLoading ? (
            <div className="mt-3">
              <Loadbar theme="light" />
            </div>
          ) : (
            <div className="table-responsive mb-10">
              <table className="w-full table-auto bg-darkGray text-left">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className={
                            header.column.id === 'account'
                              ? 'base16 pt-8 pb-6 pl-4 pr-2 font-semibold opacity-60 xl:pl-14'
                              : 'base16 pt-8 pb-6 pl-1 pr-2 font-semibold opacity-60'
                          }
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-t border-beige-300">
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          onBlur={(e) =>
                            handleEditPubkey(
                              e,
                              cell.row.original.account,
                              cell.row.original.pubkey
                            )
                          }
                          contentEditable={
                            cell.column.id === 'newPubkey' && editable
                              ? true
                              : false
                          }
                          suppressContentEditableWarning={true}
                          className={
                            cell.column.id === 'account'
                              ? 'py-3 pl-4 pr-2 xl:pl-14'
                              : 'items-center py-3 pl-1 pr-4'
                          }
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UpdatePermissions
