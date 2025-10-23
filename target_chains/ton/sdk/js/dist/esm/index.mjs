import { Dictionary, SendMode, beginCell, toNano } from "@ton/core";

//#region src/index.ts
const PYTH_CONTRACT_ADDRESS_MAINNET = "EQBgtfuGIzWLiOzpZO48_psYvco4xRtkAbdbmTwy0_o95LtZ";
const PYTH_CONTRACT_ADDRESS_TESTNET = "EQB4ZnrI5qsP_IUJgVJNwEGKLzZWsQOFhiaqDbD7pTt_f9oU";
const UPDATE_PRICE_FEEDS_BASE_GAS = 300000n;
const UPDATE_PRICE_FEEDS_PER_UPDATE_GAS = 90000n;
const GAS_PRICE_FACTOR = 400n;
var PythContract = class PythContract {
	constructor(address, init) {
		this.address = address;
		this.init = init;
	}
	static createFromAddress(address) {
		return new PythContract(address);
	}
	async getCurrentGuardianSetIndex(provider) {
		return (await provider.get("get_current_guardian_set_index", [])).stack.readNumber();
	}
	async sendUpdateGuardianSet(provider, via, vm) {
		const messageBody = beginCell().storeUint(1, 32).storeRef(createCellChain(vm)).endCell();
		await provider.internal(via, {
			value: toNano("0.1"),
			sendMode: SendMode.PAY_GAS_SEPARATELY,
			body: messageBody
		});
	}
	async sendUpdatePriceFeeds(provider, via, updateData, updateFee) {
		const messageBody = beginCell().storeUint(2, 32).storeRef(createCellChain(updateData)).endCell();
		await provider.internal(via, {
			value: updateFee,
			sendMode: SendMode.PAY_GAS_SEPARATELY,
			body: messageBody
		});
	}
	async sendExecuteGovernanceAction(provider, via, governanceAction) {
		const messageBody = beginCell().storeUint(3, 32).storeRef(createCellChain(governanceAction)).endCell();
		await provider.internal(via, {
			value: toNano("0.1"),
			sendMode: SendMode.PAY_GAS_SEPARATELY,
			body: messageBody
		});
	}
	async sendUpgradeContract(provider, via, newCode) {
		const messageBody = beginCell().storeUint(4, 32).storeRef(newCode).endCell();
		await provider.internal(via, {
			value: toNano("0.1"),
			sendMode: SendMode.PAY_GAS_SEPARATELY,
			body: messageBody
		});
	}
	async getPriceUnsafe(provider, priceFeedId) {
		const result = await provider.get("get_price_unsafe", [{
			type: "int",
			value: BigInt(priceFeedId)
		}]);
		return {
			price: result.stack.readNumber(),
			conf: result.stack.readNumber(),
			expo: result.stack.readNumber(),
			publishTime: result.stack.readNumber()
		};
	}
	async getPriceNoOlderThan(provider, timePeriod, priceFeedId) {
		const result = await provider.get("get_price_no_older_than", [{
			type: "int",
			value: BigInt(timePeriod)
		}, {
			type: "int",
			value: BigInt(priceFeedId)
		}]);
		return {
			price: result.stack.readNumber(),
			conf: result.stack.readNumber(),
			expo: result.stack.readNumber(),
			publishTime: result.stack.readNumber()
		};
	}
	async getEmaPriceUnsafe(provider, priceFeedId) {
		const result = await provider.get("get_ema_price_unsafe", [{
			type: "int",
			value: BigInt(priceFeedId)
		}]);
		return {
			price: result.stack.readNumber(),
			conf: result.stack.readNumber(),
			expo: result.stack.readNumber(),
			publishTime: result.stack.readNumber()
		};
	}
	async getEmaPriceNoOlderThan(provider, timePeriod, priceFeedId) {
		const result = await provider.get("get_ema_price_no_older_than", [{
			type: "int",
			value: BigInt(timePeriod)
		}, {
			type: "int",
			value: BigInt(priceFeedId)
		}]);
		return {
			price: result.stack.readNumber(),
			conf: result.stack.readNumber(),
			expo: result.stack.readNumber(),
			publishTime: result.stack.readNumber()
		};
	}
	async getUpdateFee(provider, vm) {
		return (await provider.get("get_update_fee", [{
			type: "slice",
			cell: createCellChain(vm)
		}])).stack.readNumber();
	}
	async getSingleUpdateFee(provider) {
		return (await provider.get("get_single_update_fee", [])).stack.readNumber();
	}
	async getLastExecutedGovernanceSequence(provider) {
		return (await provider.get("get_last_executed_governance_sequence", [])).stack.readNumber();
	}
	async getChainId(provider) {
		return (await provider.get("get_chain_id", [])).stack.readNumber();
	}
	async getDataSources(provider) {
		return parseDataSources((await provider.get("get_data_sources", [])).stack.readCell());
	}
	async getGovernanceDataSource(provider) {
		return parseDataSource((await provider.get("get_governance_data_source", [])).stack.readCell());
	}
	async getGuardianSet(provider, index) {
		const result = await provider.get("get_guardian_set", [{
			type: "int",
			value: BigInt(index)
		}]);
		return {
			expirationTime: result.stack.readNumber(),
			keys: parseGuardianSetKeys(result.stack.readCell()),
			keyCount: result.stack.readNumber()
		};
	}
};
function createCellChain(buffer) {
	const chunks = bufferToChunks(buffer, 127);
	let lastCell = null;
	for (let i = chunks.length - 1; i >= 0; i--) {
		const chunk = chunks[i];
		const cellBuilder = beginCell();
		const buffer$1 = Buffer.from(chunk);
		cellBuilder.storeBuffer(buffer$1);
		if (lastCell) cellBuilder.storeRef(lastCell);
		lastCell = cellBuilder.endCell();
	}
	if (!lastCell) throw new Error("Failed to create cell chain");
	return lastCell;
}
function bufferToChunks(buff, chunkSizeBytes = 127) {
	const chunks = [];
	const uint8Array = new Uint8Array(buff.buffer, buff.byteOffset, buff.byteLength);
	for (let offset = 0; offset < uint8Array.length; offset += chunkSizeBytes) {
		const remainingBytes = Math.min(chunkSizeBytes, uint8Array.length - offset);
		const chunk = uint8Array.subarray(offset, offset + remainingBytes);
		chunks.push(chunk);
	}
	return chunks;
}
function parseDataSources(cell) {
	const dataSources = [];
	const dict = cell.beginParse().loadDictDirect(Dictionary.Keys.Uint(8), Dictionary.Values.Cell());
	for (const [, value] of dict) {
		const dataSource = parseDataSource(value);
		if (dataSource) dataSources.push(dataSource);
	}
	return dataSources;
}
function parseDataSource(cell) {
	const slice = cell.beginParse();
	if (slice.remainingBits === 0) return null;
	return {
		emitterChain: slice.loadUint(16),
		emitterAddress: slice.loadUintBig(256).toString(16).padStart(64, "0")
	};
}
function parseGuardianSetKeys(cell) {
	const keys = [];
	function parseCell(c) {
		let slice = c.beginParse();
		while (slice.remainingRefs > 0 || slice.remainingBits >= 160) {
			if (slice.remainingBits >= 160) {
				const bitsToSkip = slice.remainingBits - 160;
				slice = slice.skip(bitsToSkip);
				const key = slice.loadBits(160);
				keys.push("0x" + key.toString());
			}
			if (slice.remainingRefs > 0) parseCell(slice.loadRef());
		}
	}
	parseCell(cell);
	return keys;
}
function calculateUpdatePriceFeedsFee(numUpdates) {
	return (UPDATE_PRICE_FEEDS_BASE_GAS + UPDATE_PRICE_FEEDS_PER_UPDATE_GAS * numUpdates) * GAS_PRICE_FACTOR;
}

//#endregion
export { GAS_PRICE_FACTOR, PYTH_CONTRACT_ADDRESS_MAINNET, PYTH_CONTRACT_ADDRESS_TESTNET, PythContract, UPDATE_PRICE_FEEDS_BASE_GAS, UPDATE_PRICE_FEEDS_PER_UPDATE_GAS, calculateUpdatePriceFeedsFee, createCellChain, parseDataSource, parseDataSources, parseGuardianSetKeys };
//# sourceMappingURL=index.mjs.map