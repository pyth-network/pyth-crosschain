import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { Cell, toNano } from "@ton/core";
import { WormholeUnitTest } from "../wrappers/WormholeUnitTest";
import "@ton/test-utils";
import { compile } from "@ton/blueprint";
import {
  createGuardianSetUpgradeBytes,
  GUARDIAN_SET_4,
  parseGuardianSetKeys,
} from "./utils/wormhole";

describe("WormholeUnitTest", () => {
  let code: Cell;

  beforeAll(async () => {
    code = await compile("WormholeUnitTest");
  });

  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let wormholeUnitTest: SandboxContract<WormholeUnitTest>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    wormholeUnitTest = blockchain.openContract(
      WormholeUnitTest.createFromConfig({}, code)
    );

    deployer = await blockchain.treasury("deployer");

    const deployResult = await wormholeUnitTest.sendDeploy(
      deployer.getSender(),
      toNano("0.05")
    );

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: wormholeUnitTest.address,
      deploy: true,
      success: true,
    });
  });

  it("should correctly parse encoded upgrade", async () => {
    const currentGuardianSetIndex = 3;
    const newGuardianSetIndex = 4;
    const chainId = 1; // Example chain ID
    const encodedUpgrade = createGuardianSetUpgradeBytes(
      chainId,
      newGuardianSetIndex,
      GUARDIAN_SET_4
    );

    const result = await wormholeUnitTest.getParseEncodedUpgrade(
      currentGuardianSetIndex,
      encodedUpgrade
    );

    expect(result.action).toBe(2);
    expect(result.chain).toBe(chainId);
    expect(result.module.toString(16)).toBe("436f7265");
    expect(result.newGuardianSetIndex).toBeGreaterThan(currentGuardianSetIndex);
    expect(result.newGuardianSetIndex).toBe(newGuardianSetIndex);

    const parsedKeys = parseGuardianSetKeys(result.newGuardianSetKeys);
    expect(parsedKeys).toEqual(GUARDIAN_SET_4);
  });
});
