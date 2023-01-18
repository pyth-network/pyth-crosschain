import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import {
  getPythProgramKeyForCluster,
  pythOracleProgram,
} from '@pythnetwork/client'
import { PythOracle } from '@pythnetwork/client/lib/anchor'
import { useAnchorWallet, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import Squads from '@sqds/mesh'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import copy from 'copy-to-clipboard'
import { useContext, useEffect, useState } from 'react'
import { ClusterContext } from '../../contexts/ClusterContext'
import { usePythContext } from '../../contexts/PythContext'
import CopyIcon from '../../images/icons/copy.inline.svg'
import ClusterSwitch from '../ClusterSwitch'
import EditButton from '../EditButton'
import Loadbar from '../loaders/Loadbar'

interface UpdatePermissionsProps {
  account: string
  pubkey: string
  newPubkey?: string
}

const defaultData: UpdatePermissionsProps[] = [
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
            <span className="mr-2 hidden xl:block">{pubkey}</span>
            <span className="mr-2 xl:hidden">
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

type PubkeyChanges = {
  [key: string]: {
    prevPubkey: string
    newPubkey: string
  }
}

const UpdatePermissions = () => {
  const [data, setData] = useState(() => [...defaultData])
  const [columns, setColumns] = useState(() => [...defaultColumns])
  const [pubkeyChanges, setPubkeyChanges] = useState<PubkeyChanges>({})
  const [editable, setEditable] = useState(false)
  const { cluster, setCluster } = useContext(ClusterContext)
  const [sqdsClient, setSqdsClient] = useState<Squads>()
  const { rawConfig, dataIsLoading, connection } = usePythContext()
  const anchorWallet = useAnchorWallet()
  const { publicKey, connected } = useWallet()
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
    }
  }, [dataIsLoading, rawConfig])

  // useEffect(() => {
  //   console.log(pubkeyChanges)
  // }, [pubkeyChanges])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleEditButtonClick = () => {
    setEditable(!editable)
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

  const handleEditPubkey = (e: any, account: string, prevPubkey: string) => {
    const newPubkey = e.target.textContent
    if (isValidPubkey(newPubkey) && newPubkey !== prevPubkey) {
      setPubkeyChanges({
        ...pubkeyChanges,
        [account]: {
          prevPubkey,
          newPubkey,
        },
      })
    }
  }

  useEffect(() => {
    if (editable) {
      setColumns([
        ...defaultColumns,
        columnHelper.accessor('newPubkey', {
          cell: (info) => info.getValue(),
          header: () => <span>New Public Key</span>,
        }),
      ])
    } else {
      if (Object.keys(pubkeyChanges).length > 0) {
        // if pubkeyChanges.length is not 3, then we need to fill pubkeyChanges with the previous pubkey from data
        const newPubkeyChanges = { ...pubkeyChanges }
        if (Object.keys(pubkeyChanges).length !== 3) {
          data.forEach((d) => {
            if (!newPubkeyChanges[d.account]) {
              newPubkeyChanges[d.account] = {
                prevPubkey: d.pubkey,
                newPubkey: d.pubkey,
              }
            }
          })
        }
        console.log(newPubkeyChanges['Master Authority'])
        pythProgramClient?.methods
          .updPermissions(
            new PublicKey(newPubkeyChanges['Master Authority'].newPubkey),
            new PublicKey(
              newPubkeyChanges['Data Curation Authority'].newPubkey
            ),
            new PublicKey(newPubkeyChanges['Security Authority'].newPubkey)
          )
          .accounts({
            upgradeAuthority: PublicKey.unique(),
            programDataAccount: PublicKey.unique(),
          })
          .instruction()
          .then((instruction) => {
            // TODO: propose ix
          })
      }
    }
  }, [editable, pubkeyChanges, pythProgramClient, data])

  // create anchor wallet when connected
  useEffect(() => {
    if (connected) {
      const provider = new AnchorProvider(
        connection,
        anchorWallet as Wallet,
        AnchorProvider.defaultOptions()
      )
      setPythProgramClient(
        pythOracleProgram(getPythProgramKeyForCluster(cluster), provider)
      )
      // initializeSquadsClient()
    }
  }, [anchorWallet, connection, connected, cluster])

  return (
    <div className="relative">
      <div className="container flex flex-col items-center justify-between lg:flex-row">
        <div className="mb-4 w-full text-left lg:mb-0">
          <h1 className="h1 mb-4">Update Permissions</h1>
        </div>
      </div>
      <div className="container">
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
              <table className="w-full table-fixed bg-darkGray text-left">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className={
                            header.column.id === 'account'
                              ? 'base16 pt-8 pb-6 pl-4 pr-2 font-semibold opacity-60 lg:pl-14'
                              : header.column.id === 'pubkey'
                              ? 'base16 w-half pt-8 pb-6 pl-1 pr-2 font-semibold opacity-60 lg:pl-14'
                              : 'base16 w-half pt-8 pb-6 pl-1 pr-2 font-semibold opacity-60'
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
                              ? 'py-3 pl-4 pr-2 lg:pl-14'
                              : cell.column.id === 'pubkey'
                              ? 'flex items-center py-3 pl-1 lg:pl-14'
                              : cell.column.id === 'newPubkey'
                              ? 'items-center py-3 pl-1'
                              : ''
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
