import {
  decodeGovernancePayload,
  PythGovernanceHeader,
} from "../governance_payload";
import { CosmosUpgradeContract } from "../governance_payload/UpgradeContract";

test("Upgrade contract ser/de", (done) => {
  jest.setTimeout(60000);

  const expectedUpgradeContract = new CosmosUpgradeContract(
    "injective",
    BigInt("18446744073709551614"),
  );
  const buffer = expectedUpgradeContract.encode();

  console.log(buffer.toJSON());
  expect(
    buffer.equals(
      Buffer.from([
        80, 84, 71, 77, 1, 0, 0, 19, 255, 255, 255, 255, 255, 255, 255, 254,
      ]),
    ),
  ).toBeTruthy();

  const actualHeader = PythGovernanceHeader.decode(buffer);

  if (actualHeader) {
    expect(actualHeader.targetChainId).toBe("injective");
    expect(actualHeader.action).toBe("UpgradeContract");
  } else {
    done("Not an instance of CosmosUpgradeContract");
  }

  const actualUpgradeContract = decodeGovernancePayload(buffer);

  if (actualUpgradeContract instanceof CosmosUpgradeContract) {
    expect(actualUpgradeContract.targetChainId).toBe("injective");
    expect(actualUpgradeContract.codeId).toBe(BigInt("18446744073709551614"));
  } else {
    done("Not an instance of CosmosUpgradeContract");
  }

  done();
});
