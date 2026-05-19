import type { Cell } from "@ton/core";
import { toNano } from "@ton/core";
import type { SandboxContract, TreasuryContract } from "@ton/sandbox";
import { Blockchain } from "@ton/sandbox";
import type { MainConfig } from "../wrappers/Main";
import { Main } from "../wrappers/Main";
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
      chainId: 0,
      dataSources: [],
      governanceChainId: 0,
      governanceContract:
        "0000000000000000000000000000000000000000000000000000000000000000",
      governanceDataSource: {
        emitterAddress:
          "0000000000000000000000000000000000000000000000000000000000000000",
        emitterChain: 0,
      },
      guardianSet: [],
      guardianSetIndex: 0,
      singleUpdateFee: 0,
    };

    main = blockchain.openContract(Main.createFromConfig(config, code));

    deployer = await blockchain.treasury("deployer");

    const deployResult = await main.sendDeploy(
      deployer.getSender(),
      toNano("0.05"),
    );

    expect(deployResult.transactions).toHaveTransaction({
      deploy: true,
      from: deployer.address,
      success: true,
      to: main.address,
    });
  });

  it("should deploy", async () => {
    // the check is done inside beforeEach
    // blockchain and main are ready to use
  });
});
