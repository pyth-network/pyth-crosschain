import {
    applyParamsToScript,
    MeshTxBuilder,
    serializePlutusScript,
    Transaction,
    UTxO,
} from '@meshsdk/core'
import { MeshWallet } from '@meshsdk/core'
import { getWalletForYaci, getYaciProvider } from './yaci-provider'
import blueprint from '../../aiken/plutus.json'

const provider = getYaciProvider()

function getScript() {
    const scriptCbor = applyParamsToScript(
        blueprint.validators[0].compiledCode,
        []
    )
    const scriptAddr = serializePlutusScript({
        code: scriptCbor,
        version: 'V3',
    }).address
    return { scriptCbor, scriptAddr }
}

function getTxBuilder() {
    return new MeshTxBuilder({
        fetcher: provider,
        submitter: provider,
    })
}

let txBuilder = getTxBuilder()
