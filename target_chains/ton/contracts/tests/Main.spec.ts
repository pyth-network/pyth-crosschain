import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { Cell, toNano } from "@ton/core";
import { Main, MainConfig } from "../wrappers/Main";
import "@ton/test-utils";
import { compile } from "@ton/blueprint";

describe("Main", () => {
  let code: Cell;

  beforeAll(async () => {
    code = await compile("Main");
  });

  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let main: SandboxContract<Main>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    const config: MainConfig = {
      singleUpdateFee: 0,
      dataSources: [],
      guardianSetIndex: 0,
      guardianSet: [],
      chainId: 0,
      governanceChainId: 0,
      governanceContract:
        "0000000000000000000000000000000000000000000000000000000000000000",
      governanceDataSource: {
        emitterChain: 0,
        emitterAddress:
          "0000000000000000000000000000000000000000000000000000000000000000",
      },
    };

    main = blockchain.openContract(Main.createFromConfig(config, code));

    deployer = await blockchain.treasury("deployer");

    const deployResult = await main.sendDeploy(
      deployer.getSender(),
      toNano("0.05"),
    );

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: main.address,
      deploy: true,
      success: true,
    });
  });

  it("should deploy", async () => {
    // the check is done inside beforeEach
    // blockchain and main are ready to use
  });
});
