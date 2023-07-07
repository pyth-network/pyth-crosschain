import {
    RawSigner,
    SUI_CLOCK_OBJECT_ID,
    TransactionBlock,
    JsonRpcProvider,
    Ed25519Keypair,
    Connection,
} from "@mysten/sui.js";
import {readFileSync, writeFileSync} from "fs";
import {Chains, SuiChain} from "./chains";
import {CHAINS, SetFeeInstruction} from "@pythnetwork/xc-governance-sdk";
import {BufferBuilder} from "@pythnetwork/xc-governance-sdk/lib/serialize";

export class SuiContract {
    static type = 'sui_contract';

    constructor(public chain: SuiChain,
                public package_id: string,
                public state_id: string,
                public wormhole_package_id: string,
                public wormhole_state_id: string) {
    }

    static from(path: string): SuiContract {
        let parsed = JSON.parse(readFileSync(path, 'utf-8'));
        if (parsed.type !== SuiContract.type) throw new Error('Invalid type');
        if (!Chains[parsed.chain]) throw new Error(`Chain ${parsed.chain} not found`);
        return new SuiContract(Chains[parsed.chain] as SuiChain, parsed.package_id, parsed.state_id,
            parsed.wormhole_package_id, parsed.wormhole_state_id);
    }


    to(path: string): void {
        writeFileSync(`${path}/${this.getId()}.${SuiContract.type}.json`, JSON.stringify({
            chain: this.chain.id,
            package_id: this.package_id,
            state_id: this.state_id,
            wormhole_package_id: this.wormhole_package_id,
            wormhole_state_id: this.wormhole_state_id,
            type: SuiContract.type
        }, undefined, 2));
    }


    getId(): string {
        return `${this.chain.getId()}_${this.package_id}`;
    }

    async getPriceTableId() {
        const provider = new JsonRpcProvider(
            new Connection({fullnode: this.chain.rpc_url})
        );
        let result = await provider.getDynamicFieldObject({
            parentId: this.state_id,
            name: {
                type: 'vector<u8>',
                value: 'price_info'
            }
        });
        if (!result.data) {
            throw new Error('Price Table not found, contract may not be initialized')
        }
        return result.data.objectId
    }

    async getPriceFeed(
        feed_id: string,
    ): Promise<any> {

        const tableId = await this.getPriceTableId();
        const provider = new JsonRpcProvider(
            new Connection({fullnode: this.chain.rpc_url})
        );
        let result = await provider.getDynamicFieldObject({
            parentId: tableId,
            name: {
                type: `${this.package_id}::price_identifier::PriceIdentifier`,
                value: {
                    bytes: Array.from(Buffer.from(feed_id, 'hex'))
                }
            }
        });
        if (!result.data || !result.data.content) {
            throw new Error('Price feed not found')
        }
        if (result.data.content.dataType !== 'moveObject') {
            throw new Error('Price feed type mismatch')
        }
        let priceInfoObjectId = result.data.content.fields.value;
        let priceInfo = await provider.getObject({id: priceInfoObjectId, options: {showContent: true}});
        if (!priceInfo.data || !priceInfo.data.content) {
            throw new Error(`Price feed ID ${priceInfoObjectId} in price table but object not found!!`)
        }
        if (priceInfo.data.content.dataType !== 'moveObject') {
            throw new Error(`Expected ${priceInfoObjectId} to be a moveObject (PriceInfoObject)`)
        }
        return priceInfo.data.content.fields;
    }

    setUpdateFee(fee: number): Buffer {
        let builder = new BufferBuilder();
        builder.addBuffer(Buffer.from("0000000000000000000000000000000000000000000000000000000000000001", 'hex'));
        builder.addUint8(3); // SET_UPDATE_FEE
        builder.addUint16(CHAINS['sui']); // should always be sui (21) no matter devnet or testnet
        let setFee = new SetFeeInstruction(
            CHAINS[this.chain.getId() as keyof typeof CHAINS],
            BigInt(fee),
            BigInt(0)
        ).serialize();
        builder.addBuffer(setFee);
        return builder.build();
    }

    async executeGovernanceInstruction(vaa: Buffer, keypair: Ed25519Keypair) {
        const provider = new JsonRpcProvider(
            new Connection({fullnode: this.chain.rpc_url})
        );
        const tx = new TransactionBlock();

        let [decree_ticket] = tx.moveCall({
            target: `${this.package_id}::set_update_fee::authorize_governance`,
            arguments: [tx.object(this.state_id), tx.pure(false)],
        });

        let [verified_vaa] = tx.moveCall({
            target: `${this.wormhole_package_id}::vaa::parse_and_verify`,
            arguments: [
                tx.object(this.wormhole_state_id),
                tx.pure(Array.from(vaa)),
                tx.object(SUI_CLOCK_OBJECT_ID),
            ],
        });

        let [decree_receipt] = tx.moveCall({
            target: `${this.wormhole_package_id}::governance_message::verify_vaa`,
            arguments: [
                tx.object(this.wormhole_state_id),
                verified_vaa,
                decree_ticket
            ],
            typeArguments: [
                `${this.package_id}::governance_witness::GovernanceWitness`,
            ],
        });

        tx.moveCall({
            target: `${this.package_id}::governance::execute_governance_instruction`,
            arguments: [
                tx.object(this.state_id),
                decree_receipt
            ],
        });


        tx.setGasBudget(200000000);

        const wallet = new RawSigner(keypair, provider);
        let result = await wallet.signAndExecuteTransactionBlock({
            transactionBlock: tx,
            options: {
                showInput: true,
                showEffects: true,
                showEvents: true,
                showObjectChanges: true,
                showBalanceChanges: true,
            },
        });
        console.log(result);
    }


}