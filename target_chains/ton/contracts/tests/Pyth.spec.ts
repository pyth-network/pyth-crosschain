import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { Cell, toNano } from "@ton/core";
import { Pyth } from "../wrappers/Pyth";
import "@ton/test-utils";
import { compile } from "@ton/blueprint";
import { Wormhole } from "../wrappers/Wormhole";
import { GUARDIAN_SET_4 } from "./utils/wormhole";

describe("Pyth", () => {
  let code: Cell;

  beforeAll(async () => {
    code = await compile("Pyth");
  });

  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let pyth: SandboxContract<Pyth>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    pyth = blockchain.openContract(Pyth.createFromConfig({}, code));

    deployer = await blockchain.treasury("deployer");

    const deployResult = await pyth.sendDeploy(
      deployer.getSender(),
      toNano("0.05")
    );

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: pyth.address,
      deploy: true,
      success: true,
    });
  });

  it("should correctly parse encoded upgrade", async () => {
    const currentGuardianSetIndex = 3;
    const newGuardianSetIndex = 4;
    const chainId = 1; // Example chain ID
    const encodedUpgrade = Wormhole.createGuardianSetUpgradeBytes(
      chainId,
      newGuardianSetIndex,
      GUARDIAN_SET_4
    );
    console.log(encodedUpgrade);

    const result = (
      await pyth.sendParseEncodedUpgrade(
        currentGuardianSetIndex,
        encodedUpgrade
      )
    ).result;
    console.log(result);

    expect(result.action).toBe(2);
    expect(result.chain).toBe(chainId);
    expect(result.module.toString(16)).toBe("436f7265");
    expect(result.newGuardianSetIndex).toBeGreaterThan(currentGuardianSetIndex);
    expect(result.newGuardianSetIndex).toBe(newGuardianSetIndex);

    const parsedKeys = Wormhole.parseGuardianSetKeys(result.newGuardianSetKeys);
    expect(parsedKeys).toEqual(GUARDIAN_SET_4);
  });
});
