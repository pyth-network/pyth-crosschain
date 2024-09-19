import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Dictionary,
  Sender,
  SendMode,
  toNano,
} from "@ton/core";
import { createCellChain } from "../tests/utils";
import {
  createGuardianSetsDict,
  parseGuardianSetKeys,
} from "../tests/utils/wormhole";

export type WormholeTestConfig = {
  guardianSetIndex: number;
  guardianSet: string[];
  chainId: number;
  governanceChainId: number;
  governanceContract: string;
};

export class WormholeTest implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromAddress(address: Address) {
    return new WormholeTest(address);
  }

  static createFromConfig(
    config: WormholeTestConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = WormholeTest.getWormholeInitData(
      config.guardianSetIndex,
      config.guardianSet,
      config.chainId,
      config.governanceChainId,
      config.governanceContract
    );
    const init = { code, data };
    return new WormholeTest(contractAddress(workchain, init), init);
  }

  static getWormholeInitData(
    guardianSetIndex: number,
    guardianSet: string[],
    chainId: number,
    governanceChainId: number,
    governanceContract: string
  ): Cell {
    // Group price feeds and update fee (empty for Wormhole)
    const priceFeedsCell = beginCell()
      .storeDict(Dictionary.empty()) // latest_price_feeds, empty for initial state
      .storeUint(0, 256) // single_update_fee, set to 0 for testing
      .endCell();

    // Group data sources information (empty for initial state)
    const dataSourcesCell = beginCell()
      .storeDict(Dictionary.empty()) // data_sources, empty for initial state
      .storeUint(0, 32) // num_data_sources, set to 0 for initial state
      .storeDict(Dictionary.empty()) // is_valid_data_source, empty for initial state
      .endCell();

    // Group guardian set information
    const guardianSetCell = beginCell()
      .storeUint(guardianSetIndex, 32)
      .storeDict(createGuardianSetsDict(guardianSet, guardianSetIndex))
      .endCell();

    // Group chain and governance information
    const governanceCell = beginCell()
      .storeUint(chainId, 16)
      .storeUint(governanceChainId, 16)
      .storeBuffer(Buffer.from(governanceContract, "hex"))
      .storeDict(Dictionary.empty()) // consumed_governance_actions, empty for initial state
      .storeRef(beginCell()) // governance_data_source, empty for initial state
      .storeUint(0, 64) // last_executed_governance_sequence, set to 0 for initial state
      .storeUint(0, 32) // governance_data_source_index, set to 0 for initial state
      .storeUint(0, 256) // upgrade_code_hash, set to 0 for initial state
      .endCell();

    // Create the main cell with references to grouped data
    return beginCell()
      .storeRef(priceFeedsCell)
      .storeRef(dataSourcesCell)
      .storeRef(guardianSetCell)
      .storeRef(governanceCell)
      .endCell();
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  // NOTE: the function name has to start with "send" or "get" so that it automatically inserts `provider` as a first argument
  async getParseEncodedUpgrade(
    provider: ContractProvider,
    currentGuardianSetIndex: number,
    encodedUpgrade: Buffer
  ) {
    const result = await provider.get("test_parse_encoded_upgrade", [
      { type: "int", value: BigInt(currentGuardianSetIndex) },
      { type: "slice", cell: createCellChain(encodedUpgrade) },
    ]);

    return {
      action: result.stack.readNumber(),
      chain: result.stack.readNumber(),
      module: result.stack.readBigNumber(),
      newGuardianSetKeys: parseGuardianSetKeys(result.stack.readCell()),
      newGuardianSetIndex: result.stack.readNumber(),
    };
  }

  async getParseAndVerifyWormholeVm(provider: ContractProvider, vm: Buffer) {
    const cell = createCellChain(vm);
    const result = await provider.get("test_parse_and_verify_wormhole_vm", [
      { type: "slice", cell: cell },
    ]);

    const version = result.stack.readNumber();
    const vm_guardian_set_index = result.stack.readNumber();
    const timestamp = result.stack.readNumber();
    const nonce = result.stack.readNumber();
    const emitter_chain_id = result.stack.readNumber();
    const emitter_address = result.stack
      .readBigNumber()
      .toString(16)
      .padStart(64, "0");
    const sequence = result.stack.readNumber();
    const consistency_level = result.stack.readNumber();
    const payloadCell = result.stack.readCell();

    let payload = "";
    let currentCell = payloadCell;

    for (let i = 0; i < 4; i++) {
      // Original cell + up to 3 references since payload span across 4 cells
      const slice = currentCell.beginParse();
      payload += slice.loadBits(slice.remainingBits).toString().toLowerCase();

      if (slice.remainingRefs === 0) break;
      currentCell = slice.loadRef();
    }
    const hash = result.stack.readBigNumber().toString(16);

    return {
      version,
      vm_guardian_set_index,
      timestamp,
      nonce,
      emitter_chain_id,
      emitter_address,
      sequence,
      consistency_level,
      payload,
      hash,
    };
  }

  async getCurrentGuardianSetIndex(provider: ContractProvider) {
    const result = await provider.get(
      "test_get_current_guardian_set_index",
      []
    );

    return result.stack.readNumber();
  }

  async getGuardianSet(provider: ContractProvider, index: number) {
    const result = await provider.get("test_get_guardian_set", [
      { type: "int", value: BigInt(index) },
    ]);

    const expirationTime = result.stack.readNumber();
    const keys = parseGuardianSetKeys(result.stack.readCell());
    const keyCount = result.stack.readNumber();

    return {
      expirationTime,
      keys,
      keyCount,
    };
  }

  async getGovernanceChainId(provider: ContractProvider) {
    const result = await provider.get("test_get_governance_chain_id", []);
    return result.stack.readNumber();
  }

  async getChainId(provider: ContractProvider) {
    const result = await provider.get("test_get_chain_id", []);
    return result.stack.readNumber();
  }

  async getGovernanceContract(provider: ContractProvider) {
    const result = await provider.get("test_get_governance_contract", []);
    const bigNumber = result.stack.readBigNumber();
    return bigNumber.toString(16).padStart(64, "0");
  }

  async getGovernanceActionIsConsumed(
    provider: ContractProvider,
    hash: bigint
  ) {
    const result = await provider.get("test_governance_action_is_consumed", [
      { type: "int", value: hash },
    ]);
    return result.stack.readBoolean();
  }

  async sendUpdateGuardianSet(
    provider: ContractProvider,
    via: Sender,
    vm: Buffer
  ) {
    const messageBody = beginCell()
      .storeUint(1, 32) // OP_UPDATE_GUARDIAN_SET
      .storeRef(createCellChain(vm))
      .endCell();

    await provider.internal(via, {
      value: toNano("0.1"),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }
}
