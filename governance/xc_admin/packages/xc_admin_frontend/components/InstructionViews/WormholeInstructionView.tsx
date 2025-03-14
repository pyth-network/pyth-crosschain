import {
  AuthorizeGovernanceDataSourceTransfer,
  CosmosUpgradeContract,
  EvmExecute,
  EvmSetWormholeAddress,
  EvmUpgradeContract,
  ExecutePostedVaa,
  MultisigParser,
  PythGovernanceAction,
  RequestGovernanceDataSourceTransfer,
  SetDataSources,
  SetFee,
  SetValidPeriod,
  UpgradeContract256Bit,
  WormholeMultisigInstruction,
  getProgramName,
} from '@pythnetwork/xc-admin-common'
import { AccountMeta, PublicKey } from '@solana/web3.js'
import type { ReactNode } from 'react'
import CopyText from '../common/CopyText'
import { ParsedAccountPubkeyRow, SignerTag, WritableTag } from './AccountUtils'
import { usePythContext } from '../../contexts/PythContext'
import { getMappingCluster, isPubkey } from './utils'
import { PythCluster } from '@pythnetwork/client'
import { lamportsToSol } from '../../utils/lamportsToSol'
import { parseEvmExecuteCallData } from '../../utils/parseEvmExecuteCallData'

const GovernanceInstructionView = ({
  instruction,
  actionName,
  content,
}: {
  instruction: PythGovernanceAction
  actionName: string
  content: ReactNode
}) => {
  return (
    <div className="space-y-4">
      <div>Action: {actionName}</div>
      <div>Chain Id: {instruction.targetChainId}</div>
      {content}
      <div>
        Raw payload hex:{' '}
        <CopyText text={instruction.encode().toString('hex')} />
      </div>
    </div>
  )
}
export const WormholeInstructionView = ({
  instruction,
  cluster,
}: {
  instruction: WormholeMultisigInstruction
  cluster: PythCluster
}) => {
  const {
    priceAccountKeyToSymbolMapping,
    productAccountKeyToSymbolMapping,
    publisherKeyToNameMapping,
  } = usePythContext()
  const publisherKeyToNameMappingCluster =
    publisherKeyToNameMapping[getMappingCluster(cluster)]
  const governanceAction = instruction.governanceAction
  return (
    <div className="col-span-4 my-2 space-y-4 bg-darkGray2 p-4 lg:col-span-3">
      <h4 className="h4">Wormhole Instructions</h4>
      <hr className="border-[#E6DAFE] opacity-30" />
      {!governanceAction && (
        <>
          <div>Unknown message</div>
          <div>Raw hex payload:</div>
          <div>{(instruction.args.payload as Buffer).toString('hex')}</div>
        </>
      )}
      {governanceAction instanceof ExecutePostedVaa &&
        governanceAction.instructions.map((innerInstruction, index) => {
          const multisigParser = MultisigParser.fromCluster(cluster)
          const parsedInstruction = multisigParser.parseInstruction({
            programId: innerInstruction.programId,
            data: innerInstruction.data as Buffer,
            keys: innerInstruction.keys as AccountMeta[],
          })
          return (
            <>
              <div key={`${index}_program`} className="flex justify-between">
                <div>Program</div>
                <div>{getProgramName(parsedInstruction.program)}</div>
              </div>
              <div
                key={`${index}_instructionName`}
                className="flex justify-between"
              >
                <div>Instruction Name</div>
                <div>{parsedInstruction.name}</div>
              </div>
              <div
                key={`${index}_arguments`}
                className="grid grid-cols-4 justify-between"
              >
                <div>Arguments</div>
                {Object.keys(parsedInstruction.args).length > 0 ? (
                  <div className="col-span-4 mt-2 bg-[#444157] p-4 lg:col-span-3 lg:mt-0">
                    <div className="base16 flex justify-between pt-2 pb-6 font-semibold opacity-60">
                      <div>Key</div>
                      <div>Value</div>
                    </div>
                    {Object.keys(parsedInstruction.args).map((key, index) => (
                      <>
                        <div
                          key={index}
                          className="flex justify-between border-t border-beige-300 py-3"
                        >
                          {key === 'lamports' &&
                          typeof parsedInstruction.args[key] === 'bigint' ? (
                            <>
                              <div>{'◎'}</div>
                              <div>
                                {lamportsToSol(parsedInstruction.args[key])}
                              </div>
                            </>
                          ) : (
                            <>
                              <div>{key}</div>
                              {parsedInstruction.args[key] instanceof
                              PublicKey ? (
                                <CopyText
                                  text={parsedInstruction.args[key].toBase58()}
                                />
                              ) : typeof instruction.args[key] === 'string' &&
                                isPubkey(instruction.args[key]) ? (
                                <CopyText text={parsedInstruction.args[key]} />
                              ) : (
                                <div className="max-w-sm break-all">
                                  {typeof parsedInstruction.args[key] ===
                                  'string'
                                    ? parsedInstruction.args[key]
                                    : parsedInstruction.args[key] instanceof
                                        Uint8Array
                                      ? parsedInstruction.args[key].toString()
                                      : typeof parsedInstruction.args[key] ===
                                          'bigint'
                                        ? parsedInstruction.args[key].toString()
                                        : JSON.stringify(
                                            parsedInstruction.args[key]
                                          )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        {key === 'pub' &&
                        parsedInstruction.args[key].toBase58() in
                          publisherKeyToNameMappingCluster ? (
                          <ParsedAccountPubkeyRow
                            key={`${index}_${parsedInstruction.args[
                              key
                            ].toBase58()}`}
                            mapping={publisherKeyToNameMappingCluster}
                            title="publisher"
                            pubkey={parsedInstruction.args[key].toBase58()}
                          />
                        ) : null}
                      </>
                    ))}
                  </div>
                ) : (
                  <div className="col-span-3 text-right">No arguments</div>
                )}
              </div>
              {
                <div
                  key={`${index}_accounts`}
                  className="grid grid-cols-4 justify-between"
                >
                  <div>Accounts</div>
                  {Object.keys(parsedInstruction.accounts.named).length > 0 ? (
                    <div className="col-span-4 mt-2 bg-[#444157] p-4 lg:col-span-3 lg:mt-0">
                      <div className="base16 flex justify-between pt-2 pb-6 font-semibold opacity-60">
                        <div>Account</div>
                        <div>Pubkey</div>
                      </div>
                      {Object.keys(parsedInstruction.accounts.named).map(
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
                                  {parsedInstruction.accounts.named[key]
                                    .isSigner ? (
                                    <SignerTag />
                                  ) : null}
                                  {parsedInstruction.accounts.named[key]
                                    .isWritable ? (
                                    <WritableTag />
                                  ) : null}
                                </div>
                                <CopyText
                                  text={parsedInstruction.accounts.named[
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
                                mapping={priceAccountKeyToSymbolMapping}
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
                                mapping={productAccountKeyToSymbolMapping}
                                title="symbol"
                                pubkey={parsedInstruction.accounts.named[
                                  key
                                ].pubkey.toBase58()}
                              />
                            ) : null}
                          </>
                        )
                      )}
                      {parsedInstruction.accounts.remaining.map(
                        (accountMeta, index) => (
                          <>
                            <div
                              key="rem-{index}"
                              className="flex justify-between border-t border-beige-300 py-3"
                            >
                              <div className="max-w-[80px] break-words sm:max-w-none sm:break-normal">
                                Remaining {index + 1}
                              </div>
                              <div className="space-y-2 sm:flex sm:space-y-0 sm:space-x-2">
                                <div className="flex items-center space-x-2 sm:ml-2">
                                  {accountMeta.isSigner ? <SignerTag /> : null}
                                  {accountMeta.isWritable ? (
                                    <WritableTag />
                                  ) : null}
                                </div>
                                <CopyText
                                  text={accountMeta.pubkey.toBase58()}
                                />
                              </div>
                            </div>
                          </>
                        )
                      )}
                    </div>
                  ) : (
                    <div>No accounts</div>
                  )}
                </div>
              }
            </>
          )
        })}
      {governanceAction instanceof EvmUpgradeContract && (
        <GovernanceInstructionView
          instruction={governanceAction}
          actionName={governanceAction.action}
          content={
            <div>
              Address:
              <CopyText text={'0x' + governanceAction.address} />
            </div>
          }
        />
      )}

      {governanceAction instanceof CosmosUpgradeContract && (
        <GovernanceInstructionView
          instruction={governanceAction}
          actionName={governanceAction.action}
          content={<div>Code id:{governanceAction.codeId.toString()}</div>}
        />
      )}

      {governanceAction instanceof UpgradeContract256Bit && (
        <GovernanceInstructionView
          instruction={governanceAction}
          actionName={governanceAction.action}
          content={
            <div>
              Package hash:
              <CopyText text={governanceAction.hash} />
            </div>
          }
        />
      )}

      {governanceAction instanceof SetFee && (
        <GovernanceInstructionView
          instruction={governanceAction}
          actionName={governanceAction.action}
          content={
            <>
              <div>
                New Fee Value: {governanceAction.newFeeValue.toString()}
              </div>
              <div>New Fee Expo: {governanceAction.newFeeExpo.toString()}</div>
            </>
          }
        />
      )}
      {governanceAction instanceof SetDataSources && (
        <GovernanceInstructionView
          instruction={governanceAction}
          actionName={governanceAction.actionName}
          content={
            <>
              {governanceAction.dataSources.map((dataSource, idx) => (
                <div key={idx}>
                  Datasource #{idx + 1}:
                  <ul className="px-4">
                    <li>Emitter Chain: {dataSource.emitterChain}</li>
                    <li>
                      Emitter Address:{' '}
                      <CopyText text={'0x' + dataSource.emitterAddress} />
                    </li>
                  </ul>
                </div>
              ))}
            </>
          }
        />
      )}

      {governanceAction instanceof EvmSetWormholeAddress && (
        <GovernanceInstructionView
          instruction={governanceAction}
          actionName={governanceAction.action}
          content={
            <div>
              New Wormhole Address:
              <CopyText text={'0x' + governanceAction.address} />
            </div>
          }
        />
      )}

      {governanceAction instanceof SetValidPeriod && (
        <GovernanceInstructionView
          instruction={governanceAction}
          actionName={governanceAction.action}
          content={
            <div>
              New Valid Period: {governanceAction.newValidPeriod.toString()}
            </div>
          }
        />
      )}

      {governanceAction instanceof RequestGovernanceDataSourceTransfer && (
        <GovernanceInstructionView
          instruction={governanceAction}
          actionName={governanceAction.action}
          content={
            <div>
              Governance Data Source Index:{' '}
              {governanceAction.governanceDataSourceIndex}
            </div>
          }
        />
      )}

      {governanceAction instanceof AuthorizeGovernanceDataSourceTransfer && (
        <GovernanceInstructionView
          instruction={governanceAction}
          actionName={governanceAction.actionName}
          content={
            <div>
              Claim Vaa hex:{' '}
              <CopyText text={governanceAction.claimVaa.toString('hex')} />
            </div>
          }
        />
      )}

      {governanceAction instanceof EvmExecute && (
        <GovernanceInstructionView
          instruction={governanceAction}
          actionName={governanceAction.action}
          content={
            <div>
              <div>
                Executor Address:{' '}
                <CopyText text={'0x' + governanceAction.executorAddress} />
              </div>
              <div>
                Call Address:{' '}
                <CopyText text={'0x' + governanceAction.callAddress} />
              </div>
              <div>Value: {governanceAction.value.toString()}</div>
              <EvmExecuteCallData calldata={governanceAction.calldata} />
            </div>
          }
        />
      )}
    </div>
  )
}

function EvmExecuteCallData({ calldata }: { calldata: Buffer }) {
  const callDataHex = calldata.toString('hex')
  const parsedData = parseEvmExecuteCallData(callDataHex)
  if (parsedData === undefined)
    return (
      <div>
        Call Data:
        <CopyText text={callDataHex} />
      </div>
    )

  return (
    <>
      <div>Call Method: {parsedData.method}</div>
      <div>Call Params: </div>
      <div className="mx-4">
        {parsedData.inputs.length > 0 ? (
          parsedData.inputs.map(([key, value]) => (
            <div key={key}>
              {key}: {value}
            </div>
          ))
        ) : (
          <div>No params</div>
        )}
      </div>
    </>
  )
}
