import {readdirSync, readFileSync, writeFileSync} from "fs";

export class Chain {
    constructor(public id: string) {
    }

}

export class CosmWasmChain extends Chain {
    static type: string = 'cosmwasm_chain';

    constructor(id: string, public querierEndpoint: string, public executorEndpoint: string,
                public gasPrice: string, public prefix: string, public feeDenom: string) {
        super(id);
    }

    static from(path: string): CosmWasmChain {
        let parsed = JSON.parse(readFileSync(path, 'utf-8'));
        if (parsed.type !== CosmWasmChain.type) throw new Error('Invalid type');
        return new CosmWasmChain(parsed.id, parsed.querierEndpoint, parsed.executorEndpoint, parsed.gasPrice, parsed.prefix, parsed.feeDenom);
    }

    getId(): string {
        return this.id;
    }

    to(path: string): void {
        writeFileSync(`${path}/${this.getId()}.${CosmWasmChain.type}.json`, JSON.stringify({
            querierEndpoint: this.querierEndpoint,
            executorEndpoint: this.executorEndpoint,
            id: this.id,
            gasPrice: this.gasPrice,
            prefix: this.prefix,
            feeDenom: this.feeDenom,
            type: CosmWasmChain.type
        }, undefined, 2));
    }
}


export class SuiChain extends Chain {
    static type: string = 'sui_chain';

    constructor(id: string, public rpc_url: string) {
        super(id);
    }

    static from(path: string): SuiChain {
        let parsed = JSON.parse(readFileSync(path, 'utf-8'));
        if (parsed.type !== SuiChain.type) throw new Error('Invalid type');
        return new SuiChain(parsed.id, parsed.rpc_url);
    }

    getId(): string {
        return this.id;
    }

    to(path: string): void {
        writeFileSync(`${path}/${this.getId()}.${SuiChain.type}.json`, JSON.stringify({
            id: this.id,
            rpc_url: this.rpc_url,
            type: SuiChain.type
        }, undefined, 2));
    }
}

export const Chains: Record<string, Chain> = {};
let allChainClasses = {
    [CosmWasmChain.type]: CosmWasmChain,
    [SuiChain.type]: SuiChain
};

readdirSync('./store').forEach((jsonFile) => {
    let path = `./store/${jsonFile}`;
    let parsed = JSON.parse(readFileSync(path, 'utf-8'));
    if (allChainClasses[parsed.type] === undefined) return;
    let chain = allChainClasses[parsed.type].from(path);
    Chains[chain.getId()] = chain;
});
