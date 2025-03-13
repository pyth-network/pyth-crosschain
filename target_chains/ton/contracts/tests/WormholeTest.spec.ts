import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { Cell, toNano } from "@ton/core";
import { WormholeTest, WormholeTestConfig } from "../wrappers/WormholeTest";
import "@ton/test-utils";
import { compile } from "@ton/blueprint";
import {
  createGuardianSetUpgradeBytes,
  GUARDIAN_SET_0,
  GUARDIAN_SET_4,
  MAINNET_UPGRADE_VAAS,
} from "./utils/wormhole";

const CHAIN_ID = 1;
const GOVERNANCE_CHAIN_ID = 1;
const GOVERNANCE_CONTRACT =
  "0000000000000000000000000000000000000000000000000000000000000004";

describe("WormholeTest", () => {
  let code: Cell;

  beforeAll(async () => {
    code = await compile("WormholeTest");
  });

  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let wormholeTest: SandboxContract<WormholeTest>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury("deployer");
  });

  async function deployContract(
    guardianSetIndex: number = 0,
    guardianSet: string[] = GUARDIAN_SET_0,
    chainId: number = CHAIN_ID,
    governanceChainId: number = GOVERNANCE_CHAIN_ID,
    governanceContract: string = GOVERNANCE_CONTRACT,
  ) {
    const config: WormholeTestConfig = {
      guardianSetIndex,
      guardianSet,
      chainId,
      governanceChainId,
      governanceContract,
    };

    wormholeTest = blockchain.openContract(
      WormholeTest.createFromConfig(config, code),
    );

    const deployResult = await wormholeTest.sendDeploy(
      deployer.getSender(),
      toNano("0.05"),
    );

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: wormholeTest.address,
      deploy: true,
      success: true,
    });

    const guardianSetIndexRes = await wormholeTest.getCurrentGuardianSetIndex();
    expect(guardianSetIndexRes).toBe(guardianSetIndex);
  }

  it("should correctly parse encoded upgrade", async () => {
    await deployContract();

    const currentGuardianSetIndex = 3;
    const newGuardianSetIndex = 4;
    const chainId = 1; // Example chain ID
    const encodedUpgrade = createGuardianSetUpgradeBytes(
      chainId,
      newGuardianSetIndex,
      GUARDIAN_SET_4,
    );

    const result = await wormholeTest.getParseEncodedUpgrade(
      currentGuardianSetIndex,
      encodedUpgrade,
    );

    expect(result.action).toBe(2);
    expect(result.chain).toBe(chainId);
    expect(result.module.toString(16)).toBe("436f7265");
    expect(result.newGuardianSetIndex).toBeGreaterThan(currentGuardianSetIndex);
    expect(result.newGuardianSetIndex).toBe(newGuardianSetIndex);
    expect(result.newGuardianSetKeys).toEqual(GUARDIAN_SET_4);
  });

  it("should fail with invalid encoded upgrade", async () => {
    await deployContract();

    const currentGuardianSetIndex = 3;
    const newGuardianSetIndex = 4;
    const chainId = 1; // Example chain ID
    const encodedUpgrade = createGuardianSetUpgradeBytes(
      chainId,
      newGuardianSetIndex,
      GUARDIAN_SET_4,
    );

    // Replace the first 32 bytes with zeros
    const zeroBytes = Buffer.alloc(32, 0);
    zeroBytes.copy(encodedUpgrade, 0, 0, 32);

    await expect(
      wormholeTest.getParseEncodedUpgrade(
        currentGuardianSetIndex,
        encodedUpgrade,
      ),
    ).rejects.toThrow("Unable to execute get method. Got exit_code: 1011"); // ERROR_INVALID_MODULE = 1011
  });

  it("should correctly parse and verify wormhole vm", async () => {
    await deployContract();

    const mainnet_upgrade_vaa_1 = MAINNET_UPGRADE_VAAS[0];

    const result = await wormholeTest.getParseAndVerifyWormholeVm(
      Buffer.from(mainnet_upgrade_vaa_1, "hex"),
    );
    expect(result.version).toBe(1);
    expect(result.vm_guardian_set_index).toBe(0);
    expect(result.timestamp).toBe(1628094930);
    expect(result.nonce).toBe(3);
    expect(result.emitter_chain_id).toBe(1);
    expect(result.emitter_address.toString()).toBe(
      "0000000000000000000000000000000000000000000000000000000000000004",
    );
    expect(result.sequence).toBe(1337);
    expect(result.consistency_level).toBe(0);
    expect(result.payload).toBe(mainnet_upgrade_vaa_1.slice(246));
    expect(result.hash).toBe(
      "ed3a5600d44b9dcc889daf0178dd69ab1e9356308194ba3628a7b720ae48a8d5",
    );
  });

  it("should correctly update guardian set", async () => {
    await deployContract();

    const mainnet_upgrade_vaa_1 = MAINNET_UPGRADE_VAAS[0];

    const getUpdateGuardianSetResult = await wormholeTest.sendUpdateGuardianSet(
      deployer.getSender(),
      Buffer.from(mainnet_upgrade_vaa_1, "hex"),
    );
    expect(getUpdateGuardianSetResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: wormholeTest.address,
      success: true,
    });

    const getCurrentGuardianSetIndexResult =
      await wormholeTest.getCurrentGuardianSetIndex();
    expect(getCurrentGuardianSetIndexResult).toBe(1);
  });

  it("should fail with wrong vaa", async () => {
    await deployContract();
    const invalid_mainnet_upgrade_vaa = "00" + MAINNET_UPGRADE_VAAS[0].slice(2);
    const result = await wormholeTest.sendUpdateGuardianSet(
      deployer.getSender(),
      Buffer.from(invalid_mainnet_upgrade_vaa, "hex"),
    );
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: wormholeTest.address,
      success: false,
      exitCode: 1001, // ERROR_INVALID_VERSION = 1001
    });
  });

  it("should correctly get guardian set", async () => {
    await deployContract();

    const getGuardianSetResult = await wormholeTest.getGuardianSet(0);
    expect(getGuardianSetResult.keys).toEqual(GUARDIAN_SET_0);
  });

  it("should return the correct chain ID", async () => {
    await deployContract();

    const result = await wormholeTest.getChainId();
    expect(result).toEqual(CHAIN_ID);
  });

  it("should return the correct governance chain ID", async () => {
    await deployContract();

    const result = await wormholeTest.getGovernanceChainId();
    expect(result).toEqual(GOVERNANCE_CHAIN_ID);
  });

  it("should return the correct governance contract address", async () => {
    await deployContract();

    const result = await wormholeTest.getGovernanceContract();
    expect(result).toEqual(GOVERNANCE_CONTRACT);
  });

  it("should correctly check if a governance action is consumed", async () => {
    await deployContract();

    const hash = 12345n;
    let getGovernanceActionIsConsumedResult =
      await wormholeTest.getGovernanceActionIsConsumed(hash);
    expect(getGovernanceActionIsConsumedResult).toEqual(false);

    const mainnet_upgrade_vaa_1 = MAINNET_UPGRADE_VAAS[0];

    const getParseAndVerifyWormholeVmResult =
      await wormholeTest.getParseAndVerifyWormholeVm(
        Buffer.from(mainnet_upgrade_vaa_1, "hex"),
      );
    expect(getParseAndVerifyWormholeVmResult.hash).toBe(
      "ed3a5600d44b9dcc889daf0178dd69ab1e9356308194ba3628a7b720ae48a8d5",
    );

    const sendUpdateGuardianSetResult =
      await wormholeTest.sendUpdateGuardianSet(
        deployer.getSender(),
        Buffer.from(mainnet_upgrade_vaa_1, "hex"),
      );
    expect(sendUpdateGuardianSetResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: wormholeTest.address,
      success: true,
    });

    getGovernanceActionIsConsumedResult =
      await wormholeTest.getGovernanceActionIsConsumed(
        BigInt("0x" + getParseAndVerifyWormholeVmResult.hash),
      );
    expect(getGovernanceActionIsConsumedResult).toEqual(true);
  });
});
