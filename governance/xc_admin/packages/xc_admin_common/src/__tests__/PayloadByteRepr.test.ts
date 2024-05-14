import {
  AuthorizeGovernanceDataSourceTransfer,
  RequestGovernanceDataSourceTransfer,
  SetDataSources,
  SetFee,
  StarknetSetWormholeAddress,
  StarknetUpgradeContract,
} from "../governance_payload";

test("Payload byte repr", (done) => {
  const requestGovernanceDataSourceTransfer =
    new RequestGovernanceDataSourceTransfer("starknet", 1);
  const requestGovernanceDataSourceTransferBuffer =
    requestGovernanceDataSourceTransfer.encode();
  console.log(requestGovernanceDataSourceTransferBuffer.toJSON());
  expect(
    requestGovernanceDataSourceTransferBuffer.equals(
      Buffer.from([80, 84, 71, 77, 1, 5, 234, 147, 0, 0, 0, 1])
    )
  ).toBeTruthy();

  const authorizeGovernanceDataSourceTransfer =
    new AuthorizeGovernanceDataSourceTransfer(
      "starknet",
      Buffer.from([1, 2, 3])
    );
  const authorizeGovernanceDataSourceTransferBuffer =
    authorizeGovernanceDataSourceTransfer.encode();
  console.log(authorizeGovernanceDataSourceTransferBuffer.toJSON());
  expect(
    authorizeGovernanceDataSourceTransferBuffer.equals(
      Buffer.from([80, 84, 71, 77, 1, 1, 234, 147, 1, 2, 3])
    )
  ).toBeTruthy();

  const setFee = new SetFee("starknet", 42n, 8n);
  const setFeeBuffer = setFee.encode();
  console.log(setFeeBuffer.toJSON());
  expect(
    setFeeBuffer.equals(
      Buffer.from([
        80, 84, 71, 77, 1, 3, 234, 147, 0, 0, 0, 0, 0, 0, 0, 42, 0, 0, 0, 0, 0,
        0, 0, 8,
      ])
    )
  ).toBeTruthy();

  const setDataSources = new SetDataSources("starknet", [
    {
      emitterChain: 1,
      emitterAddress:
        "6bb14509a612f01fbbc4cffeebd4bbfb492a86df717ebe92eb6df432a3f00a25",
    },
    {
      emitterChain: 26,
      emitterAddress:
        "f8cd23c2ab91237730770bbea08d61005cdda0984348f3f6eecb559638c0bba0",
    },
  ]);
  const setDataSourcesBuffer = setDataSources.encode();
  console.log(setDataSourcesBuffer.toJSON());
  expect(
    setDataSourcesBuffer.equals(
      Buffer.from([
        80, 84, 71, 77, 1, 2, 234, 147, 2, 0, 1, 107, 177, 69, 9, 166, 18, 240,
        31, 187, 196, 207, 254, 235, 212, 187, 251, 73, 42, 134, 223, 113, 126,
        190, 146, 235, 109, 244, 50, 163, 240, 10, 37, 0, 26, 248, 205, 35, 194,
        171, 145, 35, 119, 48, 119, 11, 190, 160, 141, 97, 0, 92, 221, 160, 152,
        67, 72, 243, 246, 238, 203, 85, 150, 56, 192, 187, 160,
      ])
    )
  ).toBeTruthy();

  const setWormholeAddress = new StarknetSetWormholeAddress(
    "starknet",
    "05033f06d5c47bcce7960ea703b04a0bf64bf33f6f2eb5613496da747522d9c2"
  );
  const setWormholeAddressBuffer = setWormholeAddress.encode();
  console.log(setWormholeAddressBuffer.toJSON());
  expect(
    setWormholeAddressBuffer.equals(
      Buffer.from([
        80, 84, 71, 77, 1, 6, 234, 147, 5, 3, 63, 6, 213, 196, 123, 204, 231,
        150, 14, 167, 3, 176, 74, 11, 246, 75, 243, 63, 111, 46, 181, 97, 52,
        150, 218, 116, 117, 34, 217, 194,
      ])
    )
  ).toBeTruthy();

  const upgradeContract = new StarknetUpgradeContract(
    "starknet",
    "043d0ed8155263af0862372df3af9403c502358661f317f62fbdc026d03beaee"
  );
  const upgradeContractBuffer = upgradeContract.encode();
  console.log(upgradeContractBuffer.toJSON());
  expect(
    upgradeContractBuffer.equals(
      Buffer.from([
        80, 84, 71, 77, 1, 0, 234, 147, 4, 61, 14, 216, 21, 82, 99, 175, 8, 98,
        55, 45, 243, 175, 148, 3, 197, 2, 53, 134, 97, 243, 23, 246, 47, 189,
        192, 38, 208, 59, 234, 238,
      ])
    )
  ).toBeTruthy();

  done();
});
