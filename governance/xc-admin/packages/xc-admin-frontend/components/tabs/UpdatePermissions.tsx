import { AnchorProvider, Wallet } from '@coral-xyz/anchor'
import {
  getPythProgramKeyForCluster,
  pythOracleProgram,
} from '@pythnetwork/client'
import { useAnchorWallet, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import copy from 'copy-to-clipboard'
import React, { useContext, useEffect } from 'react'
import { ClusterContext } from '../../contexts/ClusterContext'
import { usePythContext } from '../../contexts/PythContext'
import CopyIcon from '../../images/icons/copy.inline.svg'
import ClusterSwitch from '../ClusterSwitch'
import Loadbar from '../loaders/Loadbar'

interface UpdatePermissionsProps {
  account: string
  pubkey?: PublicKey
}

const UpdatePermissionsRow: React.FunctionComponent<UpdatePermissionsProps> = ({
  account,
  pubkey = new PublicKey(0),
}) => {
  return (
    <tr key={account} className="border-t border-beige-300">
      <td className="py-3 pl-4 pr-2 lg:pl-14">{account}</td>
      <td className="py-3 pl-1 lg:pl-14">
        <div
          className="-ml-1 inline-flex cursor-pointer items-center px-1 hover:bg-dark hover:text-white active:bg-darkGray3"
          onClick={() => {
            copy(pubkey.toBase58())
          }}
        >
          <span className="mr-2 hidden lg:block">{pubkey.toBase58()}</span>
          <span className="mr-2 lg:hidden">
            {pubkey.toBase58().slice(0, 6) +
              '...' +
              pubkey.toBase58().slice(-6)}
          </span>{' '}
          <CopyIcon className="shrink-0" />
        </div>
      </td>
    </tr>
  )
}

const UpdatePermissions = () => {
  const { cluster, setCluster } = useContext(ClusterContext)
  const { rawConfig, dataIsLoading, connection } = usePythContext()
  const anchorWallet = useAnchorWallet()
  const { publicKey, connected } = useWallet()

  // // create anchor wallet when connected
  // useEffect(() => {
  //   if (connected) {
  //     const provider = new AnchorProvider(
  //       connection,
  //       anchorWallet as Wallet,
  //       AnchorProvider.defaultOptions()
  //     )
  //     const pythOracle = pythOracleProgram(
  //       getPythProgramKeyForCluster(cluster),
  //       provider
  //     )
  //     console.log(pythOracle)
  //   }
  // }, [anchorWallet, connection, connected, cluster])

  return (
    <div className="relative">
      <div className="container flex flex-col items-center justify-between lg:flex-row">
        <div className="mb-4 w-full text-left lg:mb-0">
          <h1 className="h1 mb-4">Update Permissions</h1>
        </div>
      </div>
      <div className="container">
        <div className="mb-4 md:mb-0">
          <ClusterSwitch />
        </div>
        <div className="table-responsive relative mt-6">
          {dataIsLoading ? (
            <div className="mt-3">
              <Loadbar theme="light" />
            </div>
          ) : (
            <div className="table-responsive mb-10">
              <table className="w-full bg-darkGray text-left">
                <thead>
                  <tr>
                    <th className="base16 pt-8 pb-6 pl-4 pr-2 font-semibold opacity-60 lg:pl-14">
                      Account
                    </th>
                    <th className="base16 pt-8 pb-6 pl-1 pr-2 font-semibold opacity-60 lg:pl-14">
                      Public Key
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <UpdatePermissionsRow
                    account="Master Authority"
                    pubkey={rawConfig.permissionAccount?.masterAuthority}
                  />
                  <UpdatePermissionsRow
                    account="Data Curation Authority"
                    pubkey={rawConfig.permissionAccount?.dataCurationAuthority}
                  />
                  <UpdatePermissionsRow
                    account="Security Authority"
                    pubkey={rawConfig.permissionAccount?.securityAuthority}
                  />
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
