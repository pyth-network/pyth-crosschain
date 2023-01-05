import { decodeHeader } from "..";

test("GovernancePayload", (done) => {
  jest.setTimeout(60000);

  let governanceHeader = decodeHeader(
    Buffer.from([80, 84, 71, 77, 0, 0, 0, 26, 0, 0, 0, 0])
  );
  expect(governanceHeader?.targetChainId).toBe("pythnet");
  expect(governanceHeader?.action).toBe("ExecutePostedVaa");

  governanceHeader = decodeHeader(
    Buffer.from([80, 84, 71, 77, 0, 0, 0, 0, 0, 0, 0, 0])
  );
  expect(governanceHeader?.targetChainId).toBe("unset");
  expect(governanceHeader?.action).toBe("ExecutePostedVaa");

  governanceHeader = decodeHeader(
    Buffer.from([80, 84, 71, 77, 1, 3, 0, 1, 0, 0, 0, 0])
  );
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

  done();
});
