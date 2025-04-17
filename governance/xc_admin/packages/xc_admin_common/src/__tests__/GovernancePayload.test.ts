import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  PythGovernanceHeader,
  ExecutePostedVaa,
  MODULES,
  MODULE_EXECUTOR,
  TargetAction,
  ExecutorAction,
  ActionName,
  PythGovernanceAction,
  decodeGovernancePayload,
  EvmSetWormholeAddress,
  EvmExecutorAction,
  EvmExecute,
  StarknetSetWormholeAddress,
} from "..";
import * as fc from "fast-check";
import { ChainName, CHAINS } from "../chains";
import { Arbitrary, IntArrayConstraints } from "fast-check";
import {
  CosmosUpgradeContract,
  EvmUpgradeContract,
  UpgradeContract256Bit,
} from "../governance_payload/UpgradeContract";
import {
  AuthorizeGovernanceDataSourceTransfer,
  RequestGovernanceDataSourceTransfer,
} from "../governance_payload/GovernanceDataSourceTransfer";
import { SetFee, SetFeeInToken } from "../governance_payload/SetFee";
import { SetValidPeriod } from "../governance_payload/SetValidPeriod";
import {
  DataSource,
  SetDataSources,
} from "../governance_payload/SetDataSources";
import { SetTransactionFee } from "../governance_payload/SetTransactionFee";
import { WithdrawFee } from "../governance_payload/WithdrawFee";

test("GovernancePayload ser/de", (done) => {
  jest.setTimeout(60000);

  // Valid header 1
  let expectedGovernanceHeader = new PythGovernanceHeader(
    "pythnet",
    "ExecutePostedVaa",
  );
  let buffer = expectedGovernanceHeader.encode();
  expect(
    buffer.equals(Buffer.from([80, 84, 71, 77, 0, 0, 0, 26])),
  ).toBeTruthy();
  let governanceHeader = PythGovernanceHeader.decode(buffer);
  expect(governanceHeader?.targetChainId).toBe("pythnet");
  expect(governanceHeader?.action).toBe("ExecutePostedVaa");

  // Valid header 2
  expectedGovernanceHeader = new PythGovernanceHeader(
    "unset",
    "ExecutePostedVaa",
  );
  buffer = expectedGovernanceHeader.encode();
  expect(buffer.equals(Buffer.from([80, 84, 71, 77, 0, 0, 0, 0]))).toBeTruthy();
  governanceHeader = PythGovernanceHeader.decode(buffer);
  expect(governanceHeader?.targetChainId).toBe("unset");
  expect(governanceHeader?.action).toBe("ExecutePostedVaa");

  // Valid header 3
  expectedGovernanceHeader = new PythGovernanceHeader("solana", "SetFee");
  buffer = expectedGovernanceHeader.encode();
  expect(buffer.equals(Buffer.from([80, 84, 71, 77, 1, 3, 0, 1]))).toBeTruthy();
  governanceHeader = PythGovernanceHeader.decode(buffer);
  expect(governanceHeader?.targetChainId).toBe("solana");
  expect(governanceHeader?.action).toBe("SetFee");

  // Valid header 3
  expectedGovernanceHeader = new PythGovernanceHeader("solana", "Execute");
  buffer = expectedGovernanceHeader.encode();
  expect(buffer.equals(Buffer.from([80, 84, 71, 77, 2, 0, 0, 1]))).toBeTruthy();
  governanceHeader = PythGovernanceHeader.decode(buffer);
  expect(governanceHeader?.targetChainId).toBe("solana");
  expect(governanceHeader?.action).toBe("Execute");

  // Wrong magic number
  expect(
    PythGovernanceHeader.decode(
      Buffer.from([0, 0, 0, 0, 0, 0, 0, 26, 0, 0, 0, 0]),
    ),
  ).toBeUndefined();

  // Wrong chain
  expect(
    PythGovernanceHeader.decode(
      Buffer.from([80, 84, 71, 77, 0, 0, 255, 255, 0, 0, 0, 0]),
    ),
  ).toBeUndefined();

  // Wrong module/action combination
  expect(
    PythGovernanceHeader.decode(
      Buffer.from([80, 84, 71, 77, 0, 1, 0, 26, 0, 0, 0, 0]),
    ),
  ).toBeUndefined();

  // Decode executePostVaa with empty instructions
  let expectedExecutePostedVaa = new ExecutePostedVaa("pythnet", []);
  buffer = expectedExecutePostedVaa.encode();
  expect(
    buffer.equals(Buffer.from([80, 84, 71, 77, 0, 0, 0, 26, 0, 0, 0, 0])),
  ).toBeTruthy();
  let executePostedVaaArgs = ExecutePostedVaa.decode(buffer);
  expect(executePostedVaaArgs?.targetChainId).toBe("pythnet");
  expect(executePostedVaaArgs?.instructions.length).toBe(0);

  // Decode executePostVaa with one system instruction
  expectedExecutePostedVaa = new ExecutePostedVaa("pythnet", [
    SystemProgram.transfer({
      fromPubkey: new PublicKey("AWQ18oKzd187aM2oMB4YirBcdgX1FgWfukmqEX91BRES"),
      toPubkey: new PublicKey("J25GT2knN8V2Wvg9jNrYBuj9SZdsLnU6bK7WCGrL7daj"),
      lamports: 890880,
    }),
  ]);

  buffer = expectedExecutePostedVaa.encode();
  expect(
    buffer.equals(
      Buffer.from([
        80, 84, 71, 77, 0, 0, 0, 26, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0,
        0, 0, 141, 65, 8, 219, 216, 57, 229, 94, 74, 17, 138, 50, 121, 176, 38,
        178, 50, 229, 210, 103, 232, 253, 133, 66, 14, 47, 228, 224, 162, 147,
        232, 251, 1, 1, 252, 221, 21, 33, 156, 1, 72, 252, 246, 229, 150, 218,
        109, 165, 127, 11, 165, 252, 140, 6, 121, 57, 204, 91, 119, 165, 106,
        241, 234, 131, 75, 180, 0, 1, 12, 0, 0, 0, 2, 0, 0, 0, 0, 152, 13, 0, 0,
        0, 0, 0,
      ]),
    ),
  ).toBeTruthy();
  executePostedVaaArgs = ExecutePostedVaa.decode(buffer);
  expect(executePostedVaaArgs?.targetChainId).toBe("pythnet");
  expect(executePostedVaaArgs?.instructions.length).toBe(1);
  expect(
    executePostedVaaArgs?.instructions[0].programId.equals(
      SystemProgram.programId,
    ),
  ).toBeTruthy();
  expect(
    executePostedVaaArgs?.instructions[0].keys[0].pubkey.equals(
      new PublicKey("AWQ18oKzd187aM2oMB4YirBcdgX1FgWfukmqEX91BRES"),
    ),
  ).toBeTruthy();
  expect(executePostedVaaArgs?.instructions[0].keys[0].isSigner).toBeTruthy();
  expect(executePostedVaaArgs?.instructions[0].keys[0].isWritable).toBeTruthy();
  expect(
    executePostedVaaArgs?.instructions[0].keys[1].pubkey.equals(
      new PublicKey("J25GT2knN8V2Wvg9jNrYBuj9SZdsLnU6bK7WCGrL7daj"),
    ),
  ).toBeTruthy();
  expect(!executePostedVaaArgs?.instructions[0].keys[1].isSigner).toBeTruthy();
  expect(executePostedVaaArgs?.instructions[0].keys[1].isWritable).toBeTruthy();
  expect(
    executePostedVaaArgs?.instructions[0].data.equals(
      Buffer.from([2, 0, 0, 0, 0, 152, 13, 0, 0, 0, 0, 0]),
    ),
  );

  const requestGovernanceDataSourceTransfer =
    new RequestGovernanceDataSourceTransfer("starknet", 1);
  const requestGovernanceDataSourceTransferBuffer =
    requestGovernanceDataSourceTransfer.encode();
  console.log(requestGovernanceDataSourceTransferBuffer.toJSON());
  expect(
    requestGovernanceDataSourceTransferBuffer.equals(
      Buffer.from([80, 84, 71, 77, 1, 5, 234, 147, 0, 0, 0, 1]),
    ),
  ).toBeTruthy();

  const authorizeGovernanceDataSourceTransfer =
    new AuthorizeGovernanceDataSourceTransfer(
      "starknet",
      Buffer.from([1, 2, 3]),
    );
  const authorizeGovernanceDataSourceTransferBuffer =
    authorizeGovernanceDataSourceTransfer.encode();
  console.log(authorizeGovernanceDataSourceTransferBuffer.toJSON());
  expect(
    authorizeGovernanceDataSourceTransferBuffer.equals(
      Buffer.from([80, 84, 71, 77, 1, 1, 234, 147, 1, 2, 3]),
    ),
  ).toBeTruthy();

  const setFee = new SetFee("starknet", 42n, 8n);
  const setFeeBuffer = setFee.encode();
  console.log(setFeeBuffer.toJSON());
  expect(
    setFeeBuffer.equals(
      Buffer.from([
        80, 84, 71, 77, 1, 3, 234, 147, 0, 0, 0, 0, 0, 0, 0, 42, 0, 0, 0, 0, 0,
        0, 0, 8,
      ]),
    ),
  ).toBeTruthy();

  const setFeeInToken = new SetFeeInToken(
    "starknet",
    42n,
    8n,
    Buffer.from(
      "049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
      "hex",
    ),
  );
  const setFeeInTokenBuffer = setFeeInToken.encode();
  console.log(setFeeInTokenBuffer.toJSON());
  expect(
    setFeeInTokenBuffer.equals(
      Buffer.from([
        80, 84, 71, 77, 1, 7, 234, 147, 0, 0, 0, 0, 0, 0, 0, 42, 0, 0, 0, 0, 0,
        0, 0, 8, 32, 4, 157, 54, 87, 13, 78, 70, 244, 142, 153, 103, 75, 211,
        252, 200, 70, 68, 221, 214, 185, 111, 124, 116, 27, 21, 98, 184, 47,
        158, 0, 77, 199,
      ]),
    ),
  ).toBeTruthy();

  const setDataSources = new SetDataSources("starknet", [
    {
      emitterChain: 1,
      emitterAddress:
        "6bb14509a612f01fbbc4cffeebd4bbfb492a86df717ebe92eb6df432a3f00a25",
    },
    {
      emitterChain: 3,
      emitterAddress:
        "000000000000000000000000000000000000000000000000000000000000012d",
    },
  ]);
  const setDataSourcesBuffer = setDataSources.encode();
  console.log(setDataSourcesBuffer.toJSON());
  expect(
    setDataSourcesBuffer.equals(
      Buffer.from([
        80, 84, 71, 77, 1, 2, 234, 147, 2, 0, 1, 107, 177, 69, 9, 166, 18, 240,
        31, 187, 196, 207, 254, 235, 212, 187, 251, 73, 42, 134, 223, 113, 126,
        190, 146, 235, 109, 244, 50, 163, 240, 10, 37, 0, 3, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        1, 45,
      ]),
    ),
  ).toBeTruthy();

  const setWormholeAddress = new StarknetSetWormholeAddress(
    "starknet",
    "05033f06d5c47bcce7960ea703b04a0bf64bf33f6f2eb5613496da747522d9c2",
  );
  const setWormholeAddressBuffer = setWormholeAddress.encode();
  console.log(setWormholeAddressBuffer.toJSON());
  expect(
    setWormholeAddressBuffer.equals(
      Buffer.from([
        80, 84, 71, 77, 1, 6, 234, 147, 5, 3, 63, 6, 213, 196, 123, 204, 231,
        150, 14, 167, 3, 176, 74, 11, 246, 75, 243, 63, 111, 46, 181, 97, 52,
        150, 218, 116, 117, 34, 217, 194,
      ]),
    ),
  ).toBeTruthy();

  const upgradeContract = new UpgradeContract256Bit(
    "starknet",
    "043d0ed8155263af0862372df3af9403c502358661f317f62fbdc026d03beaee",
  );
  const upgradeContractBuffer = upgradeContract.encode();
  console.log(upgradeContractBuffer.toJSON());
  expect(
    upgradeContractBuffer.equals(
      Buffer.from([
        80, 84, 71, 77, 1, 0, 234, 147, 4, 61, 14, 216, 21, 82, 99, 175, 8, 98,
        55, 45, 243, 175, 148, 3, 197, 2, 53, 134, 97, 243, 23, 246, 47, 189,
        192, 38, 208, 59, 234, 238,
      ]),
    ),
  ).toBeTruthy();

  done();
});

/** Fastcheck generator for arbitrary PythGovernanceHeaders */
function governanceHeaderArb(): Arbitrary<PythGovernanceHeader> {
  const actions = [
    ...Object.keys(ExecutorAction),
    ...Object.keys(TargetAction),
    ...Object.keys(EvmExecutorAction),
  ] as ActionName[];
  const actionArb = fc.constantFrom(...actions);
  const targetChainIdArb = fc.constantFrom(
    ...(Object.keys(CHAINS) as ChainName[]),
  );

  return actionArb.chain((action) => {
    return targetChainIdArb.chain((chainId) => {
      return fc.constant(new PythGovernanceHeader(chainId, action));
    });
  });
}

/** Fastcheck generator for arbitrary Buffers */
function bufferArb(constraints?: IntArrayConstraints): Arbitrary<Buffer> {
  return fc.uint8Array(constraints).map((a) => Buffer.from(a));
}

/** Fastcheck generator for a uint of numBits bits. Warning: don't pass numBits > float precision */
function uintArb(numBits: number): Arbitrary<number> {
  return fc.bigUintN(numBits).map((x) => Number.parseInt(x.toString()));
}

/** Fastcheck generator for a byte array encoded as a hex string. */
function hexBytesArb(constraints?: IntArrayConstraints): Arbitrary<string> {
  return fc.uint8Array(constraints).map((a) => Buffer.from(a).toString("hex"));
}

function dataSourceArb(): Arbitrary<DataSource> {
  return fc.record({
    emitterChain: uintArb(16),
    emitterAddress: hexBytesArb({ minLength: 32, maxLength: 32 }),
  });
}

/**
 * Fastcheck generator for arbitrary PythGovernanceActions.
 *
 * Note that this generator doesn't generate ExecutePostedVaa instruction payloads because they're hard to generate.
 */
function governanceActionArb(): Arbitrary<PythGovernanceAction> {
  return governanceHeaderArb().chain<PythGovernanceAction>((header) => {
    if (header.action === "ExecutePostedVaa") {
      // NOTE: the instructions field is hard to generatively test, so we're using the hardcoded
      // tests above instead.
      return fc.constant(new ExecutePostedVaa(header.targetChainId, []));
    } else if (header.action === "UpgradeContract") {
      const cosmosArb = fc.bigUintN(64).map((codeId) => {
        return new CosmosUpgradeContract(header.targetChainId, codeId);
      });
      const arb256bit = hexBytesArb({ minLength: 32, maxLength: 32 }).map(
        (buffer) => {
          return new UpgradeContract256Bit(header.targetChainId, buffer);
        },
      );

      const evmArb = hexBytesArb({ minLength: 20, maxLength: 20 }).map(
        (address) => {
          return new EvmUpgradeContract(header.targetChainId, address);
        },
      );

      return fc.oneof(cosmosArb, arb256bit, evmArb);
    } else if (header.action === "AuthorizeGovernanceDataSourceTransfer") {
      return bufferArb().map((claimVaa) => {
        return new AuthorizeGovernanceDataSourceTransfer(
          header.targetChainId,
          claimVaa,
        );
      });
    } else if (header.action === "SetDataSources") {
      return fc.array(dataSourceArb()).map((dataSources) => {
        return new SetDataSources(header.targetChainId, dataSources);
      });
    } else if (header.action === "SetFee") {
      return fc
        .record({ v: fc.bigUintN(64), e: fc.bigUintN(64) })
        .map(({ v, e }) => {
          return new SetFee(header.targetChainId, v, e);
        });
    } else if (header.action === "SetValidPeriod") {
      return fc.bigUintN(64).map((period) => {
        return new SetValidPeriod(header.targetChainId, period);
      });
    } else if (header.action === "RequestGovernanceDataSourceTransfer") {
      return fc.bigUintN(32).map((index) => {
        return new RequestGovernanceDataSourceTransfer(
          header.targetChainId,
          parseInt(index.toString()),
        );
      });
    } else if (header.action === "SetWormholeAddress") {
      const evmArb = hexBytesArb({ minLength: 20, maxLength: 20 }).map(
        (address) => {
          return new EvmSetWormholeAddress(header.targetChainId, address);
        },
      );
      const starknetArb = hexBytesArb({ minLength: 32, maxLength: 32 }).map(
        (address) => {
          return new StarknetSetWormholeAddress(header.targetChainId, address);
        },
      );
      return fc.oneof(evmArb, starknetArb);
    } else if (header.action === "Execute") {
      return fc
        .record({
          executerAddress: hexBytesArb({ minLength: 20, maxLength: 20 }),
          callAddress: hexBytesArb({ minLength: 20, maxLength: 20 }),
          value: fc.bigUintN(256),
          callData: bufferArb(),
        })
        .map(
          ({ executerAddress, callAddress, value, callData }) =>
            new EvmExecute(
              header.targetChainId,
              executerAddress,
              callAddress,
              value,
              callData,
            ),
        );
    } else if (header.action === "SetFeeInToken") {
      return fc
        .record({
          value: fc.bigUintN(64),
          expo: fc.bigUintN(64),
          token: fc.array(fc.integer({ min: 0, max: 255 }), {
            minLength: 0,
            maxLength: 128,
          }),
        })
        .map(({ value, expo, token }) => {
          return new SetFeeInToken(
            header.targetChainId,
            value,
            expo,
            Buffer.from(token),
          );
        });
    } else if (header.action === "SetTransactionFee") {
      return fc
        .record({ v: fc.bigUintN(64), e: fc.bigUintN(64) })
        .map(({ v, e }) => {
          return new SetTransactionFee(header.targetChainId, v, e);
        });
    } else if (header.action === "WithdrawFee") {
      return fc
        .record({
          targetAddress: hexBytesArb({ minLength: 20, maxLength: 20 }),
          value: fc.bigUintN(64),
          expo: fc.bigUintN(64),
        })
        .map(({ targetAddress, value, expo }) => {
          return new WithdrawFee(
            header.targetChainId,
            Buffer.from(targetAddress, "hex"),
            value,
            expo,
          );
        });
    } else {
      throw new Error("Unsupported action type");
    }
  });
}

test("Header serialization round-trip test", (done) => {
  fc.assert(
    fc.property(governanceHeaderArb(), (original) => {
      const decoded = PythGovernanceHeader.decode(original.encode());
      if (decoded === undefined) {
        return false;
      }

      return (
        decoded.action === original.action &&
        decoded.targetChainId === original.targetChainId
      );
    }),
  );

  done();
});

test("Governance action serialization round-trip test", (done) => {
  fc.assert(
    fc.property(governanceActionArb(), (original) => {
      const encoded = original.encode();
      const decoded = decodeGovernancePayload(encoded);
      if (decoded === undefined) {
        return false;
      }

      // TODO: not sure if i love this test.
      return decoded.encode().equals(original.encode());
    }),
  );

  done();
});
