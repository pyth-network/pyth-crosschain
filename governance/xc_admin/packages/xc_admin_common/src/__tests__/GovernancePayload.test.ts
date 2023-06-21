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
} from "..";
import * as fc from "fast-check";
import {
  ChainId,
  ChainName,
  CHAINS,
  toChainId,
  toChainName,
} from "@certusone/wormhole-sdk";
import { Arbitrary } from "fast-check";
import { CosmosUpgradeContract } from "../governance_payload/UpgradeContract";
import {
  AuthorizeGovernanceDataSourceTransfer,
  RequestGovernanceDataSourceTransfer,
} from "../governance_payload/GovernanceDataSourceTransfer";
import { SetFee } from "../governance_payload/SetFee";
import { SetValidPeriod } from "../governance_payload/SetValidPeriod";

test("GovernancePayload ser/de", (done) => {
  jest.setTimeout(60000);

  // Valid header 1
  let expectedGovernanceHeader = new PythGovernanceHeader(
    "pythnet",
    "ExecutePostedVaa"
  );
  let buffer = expectedGovernanceHeader.encode();
  expect(
    buffer.equals(Buffer.from([80, 84, 71, 77, 0, 0, 0, 26]))
  ).toBeTruthy();
  let governanceHeader = PythGovernanceHeader.decode(buffer);
  expect(governanceHeader?.targetChainId).toBe("pythnet");
  expect(governanceHeader?.action).toBe("ExecutePostedVaa");

  // Valid header 2
  expectedGovernanceHeader = new PythGovernanceHeader(
    "unset",
    "ExecutePostedVaa"
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

  // Wrong magic number
  expect(
    PythGovernanceHeader.decode(
      Buffer.from([0, 0, 0, 0, 0, 0, 0, 26, 0, 0, 0, 0])
    )
  ).toBeUndefined();

  // Wrong chain
  expect(
    PythGovernanceHeader.decode(
      Buffer.from([80, 84, 71, 77, 0, 0, 255, 255, 0, 0, 0, 0])
    )
  ).toBeUndefined();

  // Wrong module/action combination
  expect(
    PythGovernanceHeader.decode(
      Buffer.from([80, 84, 71, 77, 0, 1, 0, 26, 0, 0, 0, 0])
    )
  ).toBeUndefined();

  // Decode executePostVaa with empty instructions
  let expectedExecutePostedVaa = new ExecutePostedVaa("pythnet", []);
  buffer = expectedExecutePostedVaa.encode();
  expect(
    buffer.equals(Buffer.from([80, 84, 71, 77, 0, 0, 0, 26, 0, 0, 0, 0]))
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
      ])
    )
  ).toBeTruthy();
  executePostedVaaArgs = ExecutePostedVaa.decode(buffer);
  expect(executePostedVaaArgs?.targetChainId).toBe("pythnet");
  expect(executePostedVaaArgs?.instructions.length).toBe(1);
  expect(
    executePostedVaaArgs?.instructions[0].programId.equals(
      SystemProgram.programId
    )
  ).toBeTruthy();
  expect(
    executePostedVaaArgs?.instructions[0].keys[0].pubkey.equals(
      new PublicKey("AWQ18oKzd187aM2oMB4YirBcdgX1FgWfukmqEX91BRES")
    )
  ).toBeTruthy();
  expect(executePostedVaaArgs?.instructions[0].keys[0].isSigner).toBeTruthy();
  expect(executePostedVaaArgs?.instructions[0].keys[0].isWritable).toBeTruthy();
  expect(
    executePostedVaaArgs?.instructions[0].keys[1].pubkey.equals(
      new PublicKey("J25GT2knN8V2Wvg9jNrYBuj9SZdsLnU6bK7WCGrL7daj")
    )
  ).toBeTruthy();
  expect(!executePostedVaaArgs?.instructions[0].keys[1].isSigner).toBeTruthy();
  expect(executePostedVaaArgs?.instructions[0].keys[1].isWritable).toBeTruthy();
  expect(
    executePostedVaaArgs?.instructions[0].data.equals(
      Buffer.from([2, 0, 0, 0, 0, 152, 13, 0, 0, 0, 0, 0])
    )
  );

  done();
});

function governanceHeaderArb(): Arbitrary<PythGovernanceHeader> {
  const actions = [
    ...Object.keys(ExecutorAction),
    ...Object.keys(TargetAction),
  ] as ActionName[];
  const actionArb = fc.constantFrom(...actions);
  const targetChainIdArb = fc.constantFrom(
    ...(Object.keys(CHAINS) as ChainName[])
  );

  return actionArb.chain((action) => {
    return targetChainIdArb.chain((chainId) => {
      return fc.constant(new PythGovernanceHeader(chainId, action));
    });
  });
}

function bufferArb(): Arbitrary<Buffer> {
  return fc.uint8Array().map((a) => Buffer.from(a));
}

function governanceActionArb(): Arbitrary<PythGovernanceAction> {
  return governanceHeaderArb().chain<PythGovernanceAction>((header) => {
    if (header.action === "ExecutePostedVaa") {
      // NOTE: the instructions field is hard to generatively test, so we're using the hardcoded
      // tests above instead.
      return fc.constant(new ExecutePostedVaa(header.targetChainId, []));
    } else if (header.action === "UpgradeContract") {
      // TODO: other upgrade contracts
      return fc.bigUintN(64).map((codeId) => {
        return new CosmosUpgradeContract(header.targetChainId, codeId);
      });
    } else if (header.action === "AuthorizeGovernanceDataSourceTransfer") {
      return bufferArb().map((claimVaa) => {
        return new AuthorizeGovernanceDataSourceTransfer(
          header.targetChainId,
          claimVaa
        );
      });
    } else if (header.action === "SetDataSources") {
      // FIXME
      return bufferArb().map((claimVaa) => {
        return new AuthorizeGovernanceDataSourceTransfer(
          header.targetChainId,
          claimVaa
        );
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
          parseInt(index.toString())
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
    })
  );

  done();
});

test("Governance action serialization round-trip test", (done) => {
  fc.assert(
    fc.property(governanceActionArb(), (original) => {
      const encoded = original.encode();
      const decoded = decodeGovernancePayload(encoded);
      console.log(original);
      console.log(encoded);
      console.log(decoded);
      if (decoded === undefined) {
        return false;
      }

      // TODO: not sure if i love this test.
      return decoded.encode().equals(original.encode());
    })
  );

  done();
});
