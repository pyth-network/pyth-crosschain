import { PublicKey, SystemProgram } from "@solana/web3.js";
import { decodeExecutePostedVaa, decodeHeader, encodeHeader } from "..";
import { encodeExecutePostedVaa } from "../governance_payload/ExecutePostedVaa";

test("GovernancePayload ser/de", (done) => {
  jest.setTimeout(60000);

  let governanceHeader = decodeHeader(
    Buffer.from([80, 84, 71, 77, 0, 0, 0, 26, 0, 0, 0, 0])
  );
  expect(governanceHeader?.targetChainId).toBe("pythnet");
  expect(governanceHeader?.action).toBe("ExecutePostedVaa");

  let buffer = Buffer.alloc(1000);
  let span = encodeHeader(governanceHeader!, buffer);
  expect(
    buffer.subarray(0, span).equals(Buffer.from([80, 84, 71, 77, 0, 0, 0, 26]))
  ).toBeTruthy();

  governanceHeader = decodeHeader(
    Buffer.from([80, 84, 71, 77, 0, 0, 0, 0, 0, 0, 0, 0])
  );
  expect(governanceHeader?.targetChainId).toBe("unset");
  expect(governanceHeader?.action).toBe("ExecutePostedVaa");

  buffer = Buffer.alloc(1000);
  span = encodeHeader(governanceHeader!, buffer);
  expect(
    buffer.subarray(0, span).equals(Buffer.from([80, 84, 71, 77, 0, 0, 0, 0]))
  ).toBeTruthy();

  governanceHeader = decodeHeader(
    Buffer.from([80, 84, 71, 77, 1, 3, 0, 1, 0, 0, 0, 0])
  );
  expect(governanceHeader?.targetChainId).toBe("solana");
  expect(governanceHeader?.action).toBe("SetFee");

  buffer = Buffer.alloc(1000);
  span = encodeHeader(governanceHeader!, buffer);
  expect(
    buffer.subarray(0, span).equals(Buffer.from([80, 84, 71, 77, 1, 3, 0, 1]))
  ).toBeTruthy();

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

  // Decode executePostVaa
  let executePostedVaaArgs = decodeExecutePostedVaa(
    Buffer.from([80, 84, 71, 77, 0, 0, 0, 26, 0, 0, 0, 0])
  );
  expect(executePostedVaaArgs?.header.targetChainId).toBe("pythnet");
  expect(executePostedVaaArgs?.header.action).toBe("ExecutePostedVaa");
  expect(executePostedVaaArgs?.instructions.length).toBe(0);

  buffer = Buffer.alloc(1000);
  span = encodeExecutePostedVaa(executePostedVaaArgs!, buffer);

  expect(
    buffer
      .subarray(0, span)
      .equals(Buffer.from([80, 84, 71, 77, 0, 0, 0, 26, 0, 0, 0, 0]))
  ).toBeTruthy();

  executePostedVaaArgs = decodeExecutePostedVaa(
    Buffer.from([
      80, 84, 71, 77, 0, 0, 0, 26, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0,
      141, 65, 8, 219, 216, 57, 229, 94, 74, 17, 138, 50, 121, 176, 38, 178, 50,
      229, 210, 103, 232, 253, 133, 66, 14, 47, 228, 224, 162, 147, 232, 251, 1,
      1, 252, 221, 21, 33, 156, 1, 72, 252, 246, 229, 150, 218, 109, 165, 127,
      11, 165, 252, 140, 6, 121, 57, 204, 91, 119, 165, 106, 241, 234, 131, 75,
      180, 0, 1, 12, 0, 0, 0, 2, 0, 0, 0, 0, 152, 13, 0, 0, 0, 0, 0,
    ])
  );
  expect(executePostedVaaArgs?.header.targetChainId).toBe("pythnet");
  expect(executePostedVaaArgs?.header.action).toBe("ExecutePostedVaa");
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

  buffer = Buffer.alloc(1000);
  span = encodeExecutePostedVaa(executePostedVaaArgs!, buffer);
  expect(
    buffer
      .subarray(0, span)
      .equals(
        Buffer.from([
          80, 84, 71, 77, 0, 0, 0, 26, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2,
          0, 0, 0, 141, 65, 8, 219, 216, 57, 229, 94, 74, 17, 138, 50, 121, 176,
          38, 178, 50, 229, 210, 103, 232, 253, 133, 66, 14, 47, 228, 224, 162,
          147, 232, 251, 1, 1, 252, 221, 21, 33, 156, 1, 72, 252, 246, 229, 150,
          218, 109, 165, 127, 11, 165, 252, 140, 6, 121, 57, 204, 91, 119, 165,
          106, 241, 234, 131, 75, 180, 0, 1, 12, 0, 0, 0, 2, 0, 0, 0, 0, 152,
          13, 0, 0, 0, 0, 0,
        ])
      )
  ).toBeTruthy();

  done();
});
