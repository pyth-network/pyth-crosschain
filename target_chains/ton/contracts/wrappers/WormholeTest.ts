import { Cell, contractAddress, ContractProvider, Sender } from "@ton/core";
import { BaseWrapper } from "./BaseWrapper";
import {
  createCellChain,
  parseGuardianSetKeys,
} from "@pythnetwork/pyth-ton-js";

export type WormholeTestConfig = {
  guardianSetIndex: number;
  guardianSet: string[];
  chainId: number;
  governanceChainId: number;
  governanceContract: string;
};

export class WormholeTest extends BaseWrapper {
  static createFromConfig(
    config: WormholeTestConfig,
    code: Cell,
    workchain = 0,
  ) {
    const data = WormholeTest.getWormholeInitData(config);
    const init = { code, data };
    return new WormholeTest(contractAddress(workchain, init), init);
  }

  static getWormholeInitData(config: WormholeTestConfig): Cell {
    return BaseWrapper.createInitData({
      guardianSetIndex: config.guardianSetIndex,
      guardianSet: config.guardianSet,
      chainId: config.chainId,
      governanceChainId: config.governanceChainId,
      governanceContract: config.governanceContract,
    });
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await super.sendDeploy(provider, via, value);
  }

  async getParseEncodedUpgrade(
    provider: ContractProvider,
    currentGuardianSetIndex: number,
    encodedUpgrade: Buffer,
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
    return await super.getCurrentGuardianSetIndex(
      provider,
      "test_get_current_guardian_set_index",
    );
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
    return await super.getChainId(provider, "test_get_chain_id");
  }

  async getGovernanceContract(provider: ContractProvider) {
    const result = await provider.get("test_get_governance_contract", []);
    const bigNumber = result.stack.readBigNumber();
    return bigNumber.toString(16).padStart(64, "0");
  }

  async getGovernanceActionIsConsumed(
    provider: ContractProvider,
    hash: bigint,
  ) {
    const result = await provider.get("test_governance_action_is_consumed", [
      { type: "int", value: hash },
    ]);
    return result.stack.readBoolean();
  }

  async sendUpdateGuardianSet(
    provider: ContractProvider,
    via: Sender,
    vm: Buffer,
  ) {
    await super.sendUpdateGuardianSet(provider, via, vm);
  }
}
