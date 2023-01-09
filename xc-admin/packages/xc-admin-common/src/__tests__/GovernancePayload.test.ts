import { ChainName } from "@certusone/wormhole-sdk";
import {
  PACKET_DATA_SIZE,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ActionName,
  decodeExecutePostedVaa,
  decodeHeader,
  encodeHeader,
} from "..";
import { encodeExecutePostedVaa } from "../governance_payload/ExecutePostedVaa";

test("GovernancePayload ser/de", (done) => {
  jest.setTimeout(60000);

  // Valid header 1
  let expectedGovernanceHeader = {
    targetChainId: "pythnet" as ChainName,
    action: "ExecutePostedVaa" as ActionName,
  };
  let buffer = Buffer.alloc(PACKET_DATA_SIZE);
  let span = encodeHeader(expectedGovernanceHeader, buffer);
  expect(
    buffer.subarray(0, span).equals(Buffer.from([80, 84, 71, 77, 0, 0, 0, 26]))
  ).toBeTruthy();

  let governanceHeader = decodeHeader(buffer.subarray(0, span));
  expect(governanceHeader?.targetChainId).toBe("pythnet");
  expect(governanceHeader?.action).toBe("ExecutePostedVaa");

  // Valid header 2
  expectedGovernanceHeader = {
    targetChainId: "unset" as ChainName,
    action: "ExecutePostedVaa" as ActionName,
  };
  buffer = Buffer.alloc(PACKET_DATA_SIZE);
  span = encodeHeader(expectedGovernanceHeader, buffer);
  expect(
    buffer.subarray(0, span).equals(Buffer.from([80, 84, 71, 77, 0, 0, 0, 0]))
  ).toBeTruthy();
  governanceHeader = decodeHeader(buffer.subarray(0, span));
  expect(governanceHeader?.targetChainId).toBe("unset");
  expect(governanceHeader?.action).toBe("ExecutePostedVaa");

  // Valid header 3
  expectedGovernanceHeader = {
    targetChainId: "solana" as ChainName,
    action: "SetFee" as ActionName,
  };
  buffer = Buffer.alloc(PACKET_DATA_SIZE);
  span = encodeHeader(expectedGovernanceHeader, buffer);
  expect(
    buffer.subarray(0, span).equals(Buffer.from([80, 84, 71, 77, 1, 3, 0, 1]))
  ).toBeTruthy();
  governanceHeader = decodeHeader(buffer.subarray(0, span));
  expect(governanceHeader?.targetChainId).toBe("solana");
  expect(governanceHeader?.action).toBe("SetFee");

  // Wrong magic number
  governanceHeader = decodeHeader(
    Buffer.from([0, 0, 0, 0, 0, 0, 0, 26, 0, 0, 0, 0])
  );
  expect(governanceHeader).toBeUndefined();

  // Wrong chain
  governanceHeader = decodeHeader(
    Buffer.from([80, 84, 71, 77, 0, 0, 255, 255, 0, 0, 0, 0])
  );
  expect(governanceHeader).toBeUndefined();

  // Wrong module/action combination
  governanceHeader = decodeHeader(
    Buffer.from([80, 84, 71, 77, 0, 1, 0, 26, 0, 0, 0, 0])
  );
  expect(governanceHeader).toBeUndefined();

  // Decode executePostVaa with empty instructions
  let expectedExecuteVaaArgs = {
    targetChainId: "pythnet" as ChainName,
    instructions: [] as TransactionInstruction[],
  };
  buffer = encodeExecutePostedVaa(expectedExecuteVaaArgs);
  expect(
    buffer.equals(Buffer.from([80, 84, 71, 77, 0, 0, 0, 26, 0, 0, 0, 0]))
  ).toBeTruthy();
  let executePostedVaaArgs = decodeExecutePostedVaa(buffer);
  expect(executePostedVaaArgs?.targetChainId).toBe("pythnet");
  expect(executePostedVaaArgs?.instructions.length).toBe(0);

  // Decode executePostVaa with one system instruction
  expectedExecuteVaaArgs = {
    targetChainId: "pythnet" as ChainName,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: new PublicKey(
          "AWQ18oKzd187aM2oMB4YirBcdgX1FgWfukmqEX91BRES"
        ),
        toPubkey: new PublicKey("J25GT2knN8V2Wvg9jNrYBuj9SZdsLnU6bK7WCGrL7daj"),
        lamports: 890880,
      }),
    ] as TransactionInstruction[],
  };
  buffer = encodeExecutePostedVaa(expectedExecuteVaaArgs);
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
  executePostedVaaArgs = decodeExecutePostedVaa(buffer);
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
