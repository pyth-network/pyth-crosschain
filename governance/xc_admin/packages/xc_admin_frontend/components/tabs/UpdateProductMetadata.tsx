import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import {
  getPythProgramKeyForCluster,
  Product,
  pythOracleProgram,
} from '@pythnetwork/client'
import { PythOracle } from '@pythnetwork/client/lib/anchor'
import { useAnchorWallet, useWallet } from '@solana/wallet-adapter-react'
import { WalletModalButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getMultisigCluster, proposeInstructions } from 'xc_admin_common'
import { ClusterContext } from '../../contexts/ClusterContext'
import { usePythContext } from '../../contexts/PythContext'
import { SECURITY_MULTISIG, useMultisig } from '../../hooks/useMultisig'
import { capitalizeFirstLetter } from '../../utils/capitalizeFirstLetter'
import ClusterSwitch from '../ClusterSwitch'
import Modal from '../common/Modal'
import Spinner from '../common/Spinner'
import Loadbar from '../loaders/Loadbar'

interface SymbolToProductMetadata {
  [key: string]: Product
}

interface ProductMetadataInfo {
  prev: Product
  new: Product
}

const symbolToProductAccountKeyMapping: Record<string, PublicKey> = {}

const UpdateProductMetadata = () => {
  const [data, setData] = useState<SymbolToProductMetadata>({})
  const [productMetadataChanges, setProductMetadataChanges] =
    useState<Record<string, ProductMetadataInfo>>()
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

  useEffect(() => {
    if (!dataIsLoading && rawConfig && rawConfig.mappingAccounts.length > 0) {
      const symbolToProductMetadataMapping: SymbolToProductMetadata = {}
      rawConfig.mappingAccounts
        .sort(
          (mapping1, mapping2) =>
            mapping2.products.length - mapping1.products.length
        )[0]
        .products.map((product) => {
          symbolToProductAccountKeyMapping[product.metadata.symbol] =
            product.address
          symbolToProductMetadataMapping[product.metadata.symbol] =
            product.metadata
        })
      setData(sortData(symbolToProductMetadataMapping))
    }
  }, [rawConfig, dataIsLoading])

  const sortData = (data: SymbolToProductMetadata) => {
    const sortedSymbolToProductMetadataMapping: SymbolToProductMetadata = {}
    Object.keys(data)
      .sort()
      .forEach((key) => {
        const sortedInnerData: any = {}
        Object.keys(data[key])
          .sort()
          .forEach((innerKey) => {
            sortedInnerData[innerKey] = data[key][innerKey]
          })
        sortedSymbolToProductMetadataMapping[key] = sortedInnerData
      })

    return sortedSymbolToProductMetadataMapping
  }

  // function to download json file
  const handleDownloadJsonButtonClick = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(data, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', 'products.json')
    document.body.appendChild(downloadAnchor) // required for firefox
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  // function to upload json file and update productMetadataChanges state
  const handleUploadJsonButtonClick = () => {
    const uploadAnchor = document.createElement('input')
    uploadAnchor.setAttribute('type', 'file')
    uploadAnchor.setAttribute('accept', '.json')
    uploadAnchor.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files![0]
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target) {
          const fileData = e.target.result
          if (!isValidJson(fileData as string)) return
          const fileDataParsed = sortData(JSON.parse(fileData as string))
          const changes: Record<string, ProductMetadataInfo> = {}
          Object.keys(fileDataParsed).forEach((symbol) => {
            if (
              JSON.stringify(data[symbol]) !==
              JSON.stringify(fileDataParsed[symbol])
            ) {
              changes[symbol] = {
                prev: data[symbol],
                new: fileDataParsed[symbol],
              }
            }
          })
          setProductMetadataChanges(changes)
          openModal()
        }
      }
      reader.readAsText(file)
    })
    document.body.appendChild(uploadAnchor) // required for firefox
    uploadAnchor.click()
    uploadAnchor.remove()
  }

  // check if uploaded json is valid json
  const isValidJson = (json: string) => {
    try {
      JSON.parse(json)
    } catch (e: any) {
      toast.error(capitalizeFirstLetter(e.message))
      return false
    }
    // check if json keys are existing products
    const jsonParsed = JSON.parse(json)
    const jsonSymbols = Object.keys(jsonParsed)
    const existingSymbols = Object.keys(data)
    // check that jsonSymbols is equal to existingSymbols no matter the order
    if (
      JSON.stringify(jsonSymbols.sort()) !==
      JSON.stringify(existingSymbols.sort())
    ) {
      toast.error('Symbols in json file do not match existing symbols!')
      return false
    }

    // check for duplicate keys in jsonParsed
    const jsonSymbolsSet = new Set(jsonSymbols)
    if (jsonSymbols.length !== jsonSymbolsSet.size) {
      toast.error('Duplicate symbols in json file!')
      return false
    }

    let isValid = true
    // check that the keys of the values of json are equal to the keys of the values of data
    jsonSymbols.forEach((symbol) => {
      const jsonKeys = Object.keys(jsonParsed[symbol])
      const existingKeys = Object.keys(data[symbol])
      if (
        JSON.stringify(jsonKeys.sort()) !== JSON.stringify(existingKeys.sort())
      ) {
        toast.error(
          `Keys in json file do not match existing keys for symbol ${symbol}!`
        )
        isValid = false
      }
    })
    return isValid
  }

  const handleSendProposalButtonClick = async () => {
    if (pythProgramClient && productMetadataChanges) {
      const instructions: TransactionInstruction[] = []
      Object.keys(productMetadataChanges).forEach((symbol) => {
        const { prev, new: newProductMetadata } = productMetadataChanges[symbol]
        // prev and new are json object of metadata
        // check if there are any new metadata by comparing prev and new values
        if (JSON.stringify(prev) !== JSON.stringify(newProductMetadata)) {
          pythProgramClient.methods
            .updProduct(newProductMetadata)
            .accounts({
              fundingAccount: squads?.getAuthorityPDA(
                SECURITY_MULTISIG[getMultisigCluster(cluster)],
                1
              ),
              productAccount: symbolToProductAccountKeyMapping[symbol],
            })
            .instruction()
            .then((instruction) => instructions.push(instruction))
        }
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
          <table className="mb-10 w-full table-auto bg-darkGray text-left">
            {Object.keys(changes).map((key) => {
              const { prev, new: newProductMetadata } = changes[key]
              const diff = Object.keys(prev).filter(
                (k) => prev[k] !== newProductMetadata[k]
              )
              return (
                <tbody key={key}>
                  <tr>
                    <td
                      className="base16 py-4 pl-6 pr-2 font-bold lg:pl-6"
                      colSpan={2}
                    >
                      {key}
                    </td>
                  </tr>
                  {diff.map((k) => (
                    <tr key={k}>
                      <td className="base16 py-4 pl-6 pr-2 lg:pl-6">
                        {k
                          .split('_')
                          .map((word) => capitalizeFirstLetter(word))
                          .join(' ')}
                      </td>
                      <td className="base16 py-4 pl-1 pr-2 lg:pl-6">
                        {newProductMetadata[k]}
                      </td>
                    </tr>
                  ))}
                  {/* add a divider only if its not the last item */}
                  {Object.keys(changes).indexOf(key) !==
                  Object.keys(changes).length - 1 ? (
                    <tr>
                      <td className="base16 py-4 pl-6 pr-6" colSpan={2}>
                        <hr className="border-gray-700" />
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              )
            })}
          </table>
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
        content={<ModalContent changes={productMetadataChanges} />}
      />
      <div className="container flex flex-col items-center justify-between lg:flex-row">
        <div className="mb-4 w-full text-left lg:mb-0">
          <h1 className="h1 mb-4">Update Product Metadata</h1>
        </div>
      </div>
      <div className="container min-h-[50vh]">
        <div className="flex justify-between">
          <div className="mb-4 md:mb-0">
            <ClusterSwitch />
          </div>
        </div>
        <div className="relative mt-6">
          {dataIsLoading ? (
            <div className="mt-3">
              <Loadbar theme="light" />
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <div className="mb-10">
                <button
                  className="action-btn text-base"
                  onClick={handleDownloadJsonButtonClick}
                >
                  Download JSON
                </button>
              </div>
              <div className="mb-10">
                <button
                  className="action-btn text-base"
                  onClick={handleUploadJsonButtonClick}
                >
                  Upload JSON
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UpdateProductMetadata
