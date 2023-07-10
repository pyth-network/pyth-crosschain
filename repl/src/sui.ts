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
import {
    CHAINS,
    HexString32Bytes,
    SetFeeInstruction,
    SuiAuthorizeUpgradeContractInstruction
} from "@pythnetwork/xc-governance-sdk";
import {BufferBuilder} from "@pythnetwork/xc-governance-sdk/lib/serialize";

export class SuiContract {
    static type = 'SuiContract';

    constructor(public chain: SuiChain,
                public stateId: string,
                public wormholeStateId: string) {
    }

    static from(path: string): SuiContract {
        let parsed = JSON.parse(readFileSync(path, 'utf-8'));
        if (parsed.type !== SuiContract.type) throw new Error('Invalid type');
        if (!Chains[parsed.chain]) throw new Error(`Chain ${parsed.chain} not found`);
        return new SuiContract(Chains[parsed.chain] as SuiChain, parsed.stateId, parsed.wormholeStateId);
    }


    to(path: string): void {
        writeFileSync(`${path}/${this.getId()}.${SuiContract.type}.json`, JSON.stringify({
            chain: this.chain.id,
            stateId: this.stateId,
            wormholeStateId: this.wormholeStateId,
            type: SuiContract.type
        }, undefined, 2));
    }

    async getPackageId(stateId: string): Promise<string> {
        const provider = this.getProvider();
        const state = await provider
            .getObject({
                id: stateId,
                options: {
                    showContent: true,
                },
            })
            .then((result) => {
                if (result.data?.content?.dataType == "moveObject") {
                    return result.data.content.fields;
                }

                throw new Error("not move object");
            });

        if ("upgrade_cap" in state) {
            return state.upgrade_cap.fields.package;
        }

        throw new Error("upgrade_cap not found");
    }

    async getPythPackageId(): Promise<string> {
        return await this.getPackageId(this.stateId);
    }

    async getWormholePackageId(): Promise<string> {
        return await this.getPackageId(this.wormholeStateId);
    }


    getId(): string {
        return `${this.chain.getId()}_${this.stateId}`;
    }

    async getPriceTableId() {
        const provider = this.getProvider();
        let result = await provider.getDynamicFieldObject({
            parentId: this.stateId,
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
        feedId: string,
    ): Promise<any> {

        const tableId = await this.getPriceTableId();
        const provider = this.getProvider();
        let result = await provider.getDynamicFieldObject({
            parentId: tableId,
            name: {
                type: `${await this.getPythPackageId()}::price_identifier::PriceIdentifier`,
                value: {
                    bytes: Array.from(Buffer.from(feedId, 'hex'))
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

    getSetUpdateFeePayload(fee: number): Buffer {
        let builder = new BufferBuilder();
        builder.addBuffer(Buffer.from("0000000000000000000000000000000000000000000000000000000000000001", 'hex'));
        builder.addUint8(3); // SET_UPDATE_FEE
        builder.addUint16(CHAINS['sui']); // should always be sui (21) no matter devnet or testnet
        let setFee = new SetFeeInstruction(
            CHAINS['sui'],
            BigInt(fee),
            BigInt(0)
        ).serialize();
        builder.addBuffer(setFee);
        return builder.build();
    }

    async executeGovernanceInstruction(vaa: Buffer, keypair: Ed25519Keypair) {
        const provider = this.getProvider();
        const tx = new TransactionBlock();
        const packageId = await this.getPythPackageId();
        const wormholePackageId = await this.getWormholePackageId();
        let [decreeTicket] = tx.moveCall({
            target: `${packageId}::set_update_fee::authorize_governance`,
            arguments: [tx.object(this.stateId), tx.pure(false)],
        });

        let [verifiedVAA] = tx.moveCall({
            target: `${wormholePackageId}::vaa::parse_and_verify`,
            arguments: [
                tx.object(this.wormholeStateId),
                tx.pure(Array.from(vaa)),
                tx.object(SUI_CLOCK_OBJECT_ID),
            ],
        });

        let [decreeReceipt] = tx.moveCall({
            target: `${wormholePackageId}::governance_message::verify_vaa`,
            arguments: [
                tx.object(this.wormholeStateId),
                verifiedVAA,
                decreeTicket
            ],
            typeArguments: [
                `${packageId}::governance_witness::GovernanceWitness`,
            ],
        });

        tx.moveCall({
            target: `${packageId}::governance::execute_governance_instruction`,
            arguments: [
                tx.object(this.stateId),
                decreeReceipt
            ],
        });


        const wallet = new RawSigner(keypair, provider);
        let txBlock = {
            transactionBlock: tx,
            options: {
                showInput: true,
                showEffects: true,
                showEvents: true,
                showObjectChanges: true,
                showBalanceChanges: true,
            },
        };
        let gasCost = await wallet.getGasCostEstimation(txBlock);
        tx.setGasBudget(gasCost * BigInt(2));
        let result = await wallet.signAndExecuteTransactionBlock(txBlock);
        console.log(result);
    }

    getUpgradePackagePayload(digest: string): Buffer {
        let builder = new BufferBuilder();
        builder.addBuffer(Buffer.from("0000000000000000000000000000000000000000000000000000000000000001", 'hex'));
        builder.addUint8(0); // Contract_upgrade
        builder.addUint16(CHAINS['sui']); // should always be sui (21) no matter devnet or testnet
        let setFee = new SuiAuthorizeUpgradeContractInstruction(
            CHAINS['sui'],
            new HexString32Bytes(digest),
        ).serialize();
        builder.addBuffer(setFee);
        return builder.build();
    }

    async executeUpgradeInstruction(vaa: Buffer,
                                    keypair: Ed25519Keypair,
                                    modules: number[][],
                                    dependencies: string[],) {
        const provider = this.getProvider();
        const tx = new TransactionBlock();
        const packageId = await this.getPythPackageId();
        const wormholePackageId = await this.getWormholePackageId();

        let [decree_ticket] = tx.moveCall({
            target: `${packageId}::contract_upgrade::authorize_governance`,
            arguments: [tx.object(this.stateId)],
        });

        let [verified_vaa] = tx.moveCall({
            target: `${wormholePackageId}::vaa::parse_and_verify`,
            arguments: [
                tx.object(this.wormholeStateId),
                tx.pure(Array.from(vaa)),
                tx.object(SUI_CLOCK_OBJECT_ID),
            ],
        });

        let [decreeReceipt] = tx.moveCall({
            target: `${wormholePackageId}::governance_message::verify_vaa`,
            arguments: [
                tx.object(this.wormholeStateId),
                verified_vaa,
                decree_ticket
            ],
            typeArguments: [
                `${packageId}::governance_witness::GovernanceWitness`,
            ],
        });
        // Authorize upgrade.
        const [upgradeTicket] = tx.moveCall({
            target: `${packageId}::contract_upgrade::authorize_upgrade`,
            arguments: [tx.object(this.stateId), decreeReceipt],
        });

        const [upgradeReceipt] = tx.upgrade({
            modules,
            dependencies,
            packageId: packageId,
            ticket: upgradeTicket,
        });

        // Commit upgrade.
        tx.moveCall({
            target: `${packageId}::contract_upgrade::commit_upgrade`,
            arguments: [tx.object(this.stateId), upgradeReceipt],
        });


        const wallet = new RawSigner(keypair, provider);

        let txBlock = {
            transactionBlock: tx,
            options: {
                showInput: true,
                showEffects: true,
                showEvents: true,
                showObjectChanges: true,
                showBalanceChanges: true,
            },
        };
        let gasCost = await wallet.getGasCostEstimation(txBlock);
        tx.setGasBudget(gasCost * BigInt(2));
        let result = await wallet.signAndExecuteTransactionBlock(txBlock);
        console.log(result);
    }

    async executeMigrateInstruction(
        vaa: Buffer,
        keypair: Ed25519Keypair,
    ) {
        const provider = this.getProvider();
        const tx = new TransactionBlock();
        const packageId = await this.getPythPackageId();
        const wormholePackageId = await this.getWormholePackageId();

        let [decreeTicket] = tx.moveCall({
            target: `${packageId}::contract_upgrade::authorize_governance`,
            arguments: [tx.object(this.stateId)],
        });

        let [verifiedVAA] = tx.moveCall({
            target: `${wormholePackageId}::vaa::parse_and_verify`,
            arguments: [
                tx.object(this.wormholeStateId),
                tx.pure(Array.from(vaa)),
                tx.object(SUI_CLOCK_OBJECT_ID),
            ],
        });

        let [decreeReceipt] = tx.moveCall({
            target: `${wormholePackageId}::governance_message::verify_vaa`,
            arguments: [
                tx.object(this.wormholeStateId),
                verifiedVAA,
                decreeTicket
            ],
            typeArguments: [
                `${packageId}::governance_witness::GovernanceWitness`,
            ],
        });


        tx.moveCall({
            target: `${packageId}::migrate::migrate`,
            arguments: [tx.object(this.stateId), decreeReceipt],
        });


        let txBlock = {
            transactionBlock: tx,
            options: {
                showEffects: true,
                showEvents: true,
            },
        };
        const wallet = new RawSigner(keypair, provider);
        let gasCost = await wallet.getGasCostEstimation(txBlock);
        tx.setGasBudget(gasCost * BigInt(2));
        return wallet.signAndExecuteTransactionBlock(txBlock);
    }

    private getProvider() {
        return new JsonRpcProvider(
            new Connection({fullnode: this.chain.rpcURL})
        );
    }


}