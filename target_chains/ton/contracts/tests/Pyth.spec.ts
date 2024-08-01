import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { Cell, toNano } from "@ton/core";
import { Pyth } from "../wrappers/Pyth";
import "@ton/test-utils";
import { compile } from "@ton/blueprint";

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

  it("should deploy", async () => {
    // the check is done inside beforeEach
    // blockchain and pyth are ready to use
  });
});
