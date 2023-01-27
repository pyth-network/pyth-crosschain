import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import {
  getPythProgramKeyForCluster,
  pythOracleProgram,
} from '@pythnetwork/client'
import { PythOracle } from '@pythnetwork/client/lib/anchor'
import { useAnchorWallet, useWallet } from '@solana/wallet-adapter-react'
import { WalletModalButton } from '@solana/wallet-adapter-react-ui'
import { TransactionInstruction } from '@solana/web3.js'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { proposeInstructions } from 'xc-admin-common'
import { ClusterContext } from '../../contexts/ClusterContext'
import { usePythContext } from '../../contexts/PythContext'
import {
  getMultisigCluster,
  SECURITY_MULTISIG,
  useMultisig,
} from '../../hooks/useMultisig'
import { capitalizeFirstLetter } from '../../utils/capitalizeFirstLetter'
import ClusterSwitch from '../ClusterSwitch'
import Modal from '../common/Modal'
import Spinner from '../common/Spinner'
import EditButton from '../EditButton'
import Loadbar from '../loaders/Loadbar'

interface MinPublishersProps {
  symbol: string
  minPublishers: number
  newMinPublishers?: number
}

interface MinPublishersInfo {
  prev: number
  new: number
}

const columnHelper = createColumnHelper<MinPublishersProps>()

const defaultColumns = [
  columnHelper.accessor('symbol', {
    cell: (info) => info.getValue(),
    header: () => <span>Symbol</span>,
  }),
  columnHelper.accessor('minPublishers', {
    cell: (props) => {
      const minPublishers = props.getValue()
      return <span className="mr-2">{minPublishers}</span>
    },
    header: () => <span>Min Publishers</span>,
  }),
]

const MinPublishers = () => {
  const [data, setData] = useState<MinPublishersProps[]>([])
  const [columns, setColumns] = useState(() => [...defaultColumns])
  const [minPublishersChanges, setMinPublishersChanges] =
    useState<Record<string, MinPublishersInfo>>()
  const [editable, setEditable] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSendProposalButtonLoading, setIsSendProposalButtonLoading] =
    useState(false)
  const { cluster } = useContext(ClusterContext)
  const anchorWallet = useAnchorWallet()
  const { isLoading: isMultisigLoading, squads } = useMultisig(
    anchorWallet as Wallet
  )
  const { rawConfig, dataIsLoading, connection } = usePythContext()
  const { connected } = useWallet()
  const [pythProgramClient, setPythProgramClient] =
    useState<Program<PythOracle>>()

  const openModal = () => {
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const handleEditButtonClick = () => {
    const nextState = !editable
    if (nextState) {
      const newColumns = [
        ...defaultColumns,
        columnHelper.accessor('newMinPublishers', {
          cell: (info) => info.getValue(),
          header: () => <span>New Min Publishers</span>,
        }),
      ]
      setColumns(newColumns)
    } else {
      if (
        minPublishersChanges &&
        Object.keys(minPublishersChanges).length > 0
      ) {
        openModal()
        setMinPublishersChanges(minPublishersChanges)
      } else {
        setColumns(defaultColumns)
      }
    }

    setEditable(nextState)
  }

  const handleEditMinPublishers = (
    e: any,
    symbol: string,
    prevMinPublishers: number
  ) => {
    const newMinPublishers = Number(e.target.textContent)
    if (prevMinPublishers !== newMinPublishers) {
      setMinPublishersChanges({
        ...minPublishersChanges,
        [symbol]: {
          prev: prevMinPublishers,
          new: newMinPublishers,
        },
      })
    } else {
      // delete symbol from minPublishersChanges if it exists
      if (minPublishersChanges && minPublishersChanges[symbol]) {
        delete minPublishersChanges[symbol]
      }
      setMinPublishersChanges(minPublishersChanges)
    }
  }

  useEffect(() => {
    if (!dataIsLoading && rawConfig) {
      const minPublishersData: MinPublishersProps[] = []
      rawConfig.mappingAccounts
        .sort(
          (mapping1, mapping2) =>
            mapping2.products.length - mapping1.products.length
        )[0]
        .products.sort((product1, product2) =>
          product1.metadata.symbol.localeCompare(product2.metadata.symbol)
        )
        .map((product) =>
          product.priceAccounts.map((priceAccount) => {
            minPublishersData.push({
              symbol: product.metadata.symbol,
              minPublishers: priceAccount.minPub,
            })
          })
        )
      setData(minPublishersData)
    }
  }, [setData, rawConfig, dataIsLoading])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleSendProposalButtonClick = async () => {
    if (pythProgramClient && minPublishersChanges) {
      const instructions: TransactionInstruction[] = []
      Object.keys(minPublishersChanges).forEach((symbol) => {
        const { prev, new: newMinPublishers } = minPublishersChanges[symbol]
        const priceAccountPubkey = rawConfig.mappingAccounts
          .sort(
            (mapping1, mapping2) =>
              mapping2.products.length - mapping1.products.length
          )[0]
          .products.find((product) => product.metadata.symbol === symbol)!
          .priceAccounts.find(
            (priceAccount) => priceAccount.minPub === prev
          )!.address

        pythProgramClient.methods
          .setMinPub(newMinPublishers, [0, 0, 0])
          .accounts({
            priceAccount: priceAccountPubkey,
            fundingAccount: squads?.getAuthorityPDA(
              SECURITY_MULTISIG[getMultisigCluster(cluster)],
              1
            ),
          })
          .instruction()
          .then((instruction) => instructions.push(instruction))
      })
      if (!isMultisigLoading && squads) {
        setIsSendProposalButtonLoading(true)
        try {
          const proposalPubkey = await proposeInstructions(
            squads,
            SECURITY_MULTISIG[getMultisigCluster(cluster)],
            instructions,
            false
          )
          toast.success(`Proposal sent! 🚀 Proposal Pubkey: ${proposalPubkey}`)
          setIsSendProposalButtonLoading(false)
        } catch (e: any) {
          toast.error(capitalizeFirstLetter(e.message))
          setIsSendProposalButtonLoading(false)
        }
      }
    }
  }

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
    if (connected) {
      const provider = new AnchorProvider(
        connection,
        anchorWallet as Wallet,
        AnchorProvider.defaultOptions()
      )
      setPythProgramClient(
        pythOracleProgram(getPythProgramKeyForCluster(cluster), provider)
      )
    }
  }, [anchorWallet, connection, connected, cluster])

  return (
    <div className="relative">
      <Modal
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        closeModal={closeModal}
        content={<ModalContent changes={minPublishersChanges} />}
      />
      <div className="container flex flex-col items-center justify-between lg:flex-row">
        <div className="mb-4 w-full text-left lg:mb-0">
          <h1 className="h1 mb-4">Min Publishers</h1>
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
        <div className="table-responsive relative mt-6">
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
                            header.column.id === 'symbol'
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
                            handleEditMinPublishers(
                              e,
                              cell.row.original.symbol,
                              cell.row.original.minPublishers
                            )
                          }
                          contentEditable={
                            cell.column.id === 'newMinPublishers' && editable
                              ? true
                              : false
                          }
                          suppressContentEditableWarning={true}
                          className={
                            cell.column.id === 'symbol'
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

export default MinPublishers
