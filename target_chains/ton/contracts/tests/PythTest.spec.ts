import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { Cell, toNano } from "@ton/core";
import "@ton/test-utils";
import { compile } from "@ton/blueprint";
import { HexString, Price } from "@pythnetwork/price-service-sdk";
import { PythTest, PythTestConfig } from "../wrappers/PythTest";

describe("PythTest", () => {
  let code: Cell;

  beforeAll(async () => {
    code = await compile("PythTest");
  });

  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let pythTest: SandboxContract<PythTest>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury("deployer");
  });

  async function deployContract(
    priceFeedId: HexString = "0x0000000000000000000000000000000000000000000000000000000000000000",
    timePeriod: number = 60,
    price: Price = new Price({
      price: "1",
      conf: "2",
      expo: 3,
      publishTime: 4,
    }),
    emaPrice: Price = new Price({
      price: "5",
      conf: "6",
      expo: 7,
      publishTime: 8,
    })
  ) {
    const config: PythTestConfig = {
      priceFeedId,
      timePeriod,
      price,
      emaPrice,
    };

    pythTest = blockchain.openContract(PythTest.createFromConfig(config, code));

    const deployResult = await pythTest.sendDeploy(
      deployer.getSender(),
      toNano("0.05")
    );

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      deploy: true,
      success: true,
    });
  }

  it("should correctly get price unsafe", async () => {
    await deployContract();

    const result = await pythTest.getPriceUnsafe(
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );

    expect(result.price).toBe(1);
    expect(result.conf).toBe(2);
    expect(result.expo).toBe(3);
    expect(result.publishTime).toBe(4);
  });

  it("should correctly get ema price unsafe", async () => {
    await deployContract();

    const result = await pythTest.getEmaPriceUnsafe(
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );

    expect(result.price).toBe(5);
    expect(result.conf).toBe(6);
    expect(result.expo).toBe(7);
    expect(result.publishTime).toBe(8);
  });
});
