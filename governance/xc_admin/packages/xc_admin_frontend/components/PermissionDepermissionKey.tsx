import { Program } from '@coral-xyz/anchor'
import { Dialog, Menu, Transition } from '@headlessui/react'
import { PythOracle } from '@pythnetwork/client/lib/anchor'
import * as Label from '@radix-ui/react-label'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import SquadsMesh from '@sqds/mesh'
import axios from 'axios'
import { Fragment, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  createDetermisticPriceStoreInitializePublisherInstruction,
  getMaximumNumberOfPublishers,
  getMultisigCluster,
  isPriceStorePublisherInitialized,
  isRemoteCluster,
  mapKey,
  PRICE_FEED_MULTISIG,
} from '@pythnetwork/xc-admin-common'
import { ClusterContext } from '../contexts/ClusterContext'
import { usePythContext } from '../contexts/PythContext'
import { ProductRawConfig } from '../hooks/usePyth'
import Arrow from '@images/icons/down.inline.svg'
import { capitalizeFirstLetter } from '../utils/capitalizeFirstLetter'
import Spinner from './common/Spinner'
import CloseIcon from './icons/CloseIcon'

const assetTypes = [
  'All',
  'Crypto',
  'Equity',
  'FX',
  'Metal',
  'Rates',
  'Commodities',
]

const PermissionDepermissionKey = ({
  isPermission,
  pythProgramClient,
  readOnlySquads,
  proposerServerUrl,
}: {
  isPermission: boolean
  pythProgramClient?: Program<PythOracle>
  readOnlySquads: SquadsMesh
  proposerServerUrl: string
}) => {
  const [publisherKey, setPublisherKey] = useState(
    'JTmFx5zX9mM94itfk2nQcJnQQDPjcv4UPD7SYj6xDCV'
  )
  const [selectedAssetType, setSelectedAssetType] = useState('All')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitButtonLoading, setIsSubmitButtonLoading] = useState(false)
  const [priceAccounts, setPriceAccounts] = useState<PublicKey[]>([])
  const { cluster } = useContext(ClusterContext)
  const { rawConfig, dataIsLoading, connection } = usePythContext()

  // get current input value

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChange = (event: any) => {
    setSelectedAssetType(event.target.value)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const onKeyChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const {
      currentTarget: { value },
    } = event
    setPublisherKey(value)
  }

  const handleSubmitButton = async () => {
    if (pythProgramClient) {
      const instructions: TransactionInstruction[] = []
      const multisigAuthority = readOnlySquads.getAuthorityPDA(
        PRICE_FEED_MULTISIG[getMultisigCluster(cluster)],
        1
      )
      const isRemote: boolean = isRemoteCluster(cluster)
      const fundingAccount = isRemote
        ? mapKey(multisigAuthority)
        : multisigAuthority

      const publisherPublicKey = new PublicKey(publisherKey)
      for (const priceAccount of priceAccounts) {
        if (isPermission) {
          instructions.push(
            await pythProgramClient.methods
              .addPublisher(publisherPublicKey)
              .accounts({
                fundingAccount,
                priceAccount: priceAccount,
              })
              .instruction()
          )
        } else {
          instructions.push(
            await pythProgramClient.methods
              .delPublisher(publisherPublicKey)
              .accounts({
                fundingAccount,
                priceAccount: priceAccount,
              })
              .instruction()
          )
        }
      }
      if (isPermission) {
        if (
          !connection ||
          !(await isPriceStorePublisherInitialized(
            connection,
            publisherPublicKey
          ))
        ) {
          instructions.push(
            await createDetermisticPriceStoreInitializePublisherInstruction(
              fundingAccount,
              publisherPublicKey
            )
          )
        }
      }
      setIsSubmitButtonLoading(true)
      try {
        const response = await axios.post(proposerServerUrl + '/api/propose', {
          instructions,
          cluster,
        })
        const { proposalPubkey } = response.data
        toast.success(`Proposal sent! 🚀 Proposal Pubkey: ${proposalPubkey}`)
        setIsSubmitButtonLoading(false)
        closeModal()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (error.response) {
          toast.error(capitalizeFirstLetter(error.response.data))
        } else {
          toast.error(capitalizeFirstLetter(error.message))
        }
        setIsSubmitButtonLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!dataIsLoading) {
      const res: PublicKey[] = []
      rawConfig.mappingAccounts[0].products.map((product: ProductRawConfig) => {
        const publisherExists =
          product.priceAccounts[0].publishers.find(
            (p) => p.toBase58() === publisherKey
          ) !== undefined
        if (
          (selectedAssetType === 'All' ||
            product.metadata.asset_type === selectedAssetType) &&
          ((isPermission &&
            product.priceAccounts[0].publishers.length <
              getMaximumNumberOfPublishers(cluster) &&
            !publisherExists) ||
            (!isPermission && publisherExists))
        ) {
          res.push(product.priceAccounts[0].address)
        }
      })
      setPriceAccounts(res)
    }
  }, [
    rawConfig,
    dataIsLoading,
    selectedAssetType,
    isPermission,
    publisherKey,
    cluster,
  ])

  return (
    <>
      <Menu as="div" className="relative z-[2] block w-[200px] text-left">
        {({ open }) => (
          <>
            <Menu.Button
              className={`inline-flex w-full items-center justify-between bg-darkGray2 py-3 px-6 text-sm outline-0`}
            >
              <span className="mr-3">
                {isPermission ? 'Permission Key' : 'Depermission Key'}
              </span>
              <Arrow className={`${open && 'rotate-180'}`} />
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 mt-2 w-full origin-top-right">
                {assetTypes.map((a) => (
                  <Menu.Item key={a}>
                    <button
                      className={`block w-full bg-darkGray py-3 px-6 text-left text-sm hover:bg-darkGray2`}
                      value={a}
                      onClick={handleChange}
                    >
                      {a}
                    </button>
                  </Menu.Item>
                ))}
              </Menu.Items>
            </Transition>
          </>
        )}
      </Menu>
      <Transition appear show={isModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-40"
          onClose={() => setIsModalOpen(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="dialogPanel">
                  <button className="dialogClose" onClick={closeModal}>
                    <span className="mr-3">close</span> <CloseIcon />
                  </button>
                  <div className="max-w-full">
                    <Dialog.Title as="h3" className="dialogTitle">
                      {isPermission ? 'Permission' : 'Depermission'} Publisher
                      Key
                    </Dialog.Title>
                    <div className="flex items-center justify-center">
                      <div className="rounded-full bg-light py-2 px-4 text-sm text-dark">
                        Asset Type: {selectedAssetType}
                      </div>
                    </div>
                    <div className="mt-6 block items-center justify-center space-y-2 space-x-0 lg:flex lg:space-y-0 lg:space-x-4">
                      <Label.Root htmlFor="publisherKey">Key</Label.Root>
                      <input
                        className="w-full rounded-lg bg-darkGray px-4 py-2 lg:w-3/4"
                        type="text"
                        id="publisherKey"
                        onChange={onKeyChange}
                        defaultValue={publisherKey}
                      />
                    </div>
                    <div className="mt-6">
                      <button
                        className="action-btn text-base"
                        onClick={handleSubmitButton}
                      >
                        {isSubmitButtonLoading ? (
                          <Spinner />
                        ) : (
                          'Submit Proposal'
                        )}
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}

export default PermissionDepermissionKey
