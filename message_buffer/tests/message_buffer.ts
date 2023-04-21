import * as anchor from "@coral-xyz/anchor";
import { IdlTypes, Program, BorshAccountsCoder } from "@coral-xyz/anchor";
import { MessageBuffer } from "../target/types/message_buffer";
import { MockCpiCaller } from "../target/types/mock_cpi_caller";
import lumina from "@lumina-dev/test";
import { assert } from "chai";
import { AccountMeta, ComputeBudgetProgram } from "@solana/web3.js";
import bs58 from "bs58";

// Enables tool that runs in local browser for easier debugging of
// transactions in this test -  https://lumina.fyi/debug
lumina();

const messageBufferProgram = anchor.workspace
  .MessageBuffer as Program<MessageBuffer>;
const mockCpiProg = anchor.workspace.MockCpiCaller as Program<MockCpiCaller>;
let whitelistAuthority = anchor.web3.Keypair.generate();
const [mockCpiCallerAuth] = anchor.web3.PublicKey.findProgramAddressSync(
  [messageBufferProgram.programId.toBuffer(), Buffer.from("cpi")],
  mockCpiProg.programId
);
const [fundPda] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("fund")],
  messageBufferProgram.programId
);

const pythPriceAccountId = new anchor.BN(1);
const addPriceParams = {
  id: pythPriceAccountId,
  price: new anchor.BN(2),
  priceExpo: new anchor.BN(3),
  ema: new anchor.BN(4),
  emaExpo: new anchor.BN(5),
};
const [pythPriceAccountPk] = anchor.web3.PublicKey.findProgramAddressSync(
  [
    Buffer.from("pyth"),
    Buffer.from("price"),
    pythPriceAccountId.toArrayLike(Buffer, "le", 8),
  ],
  mockCpiProg.programId
);

const [accumulatorPdaKey] = anchor.web3.PublicKey.findProgramAddressSync(
  [
    mockCpiCallerAuth.toBuffer(),
    Buffer.from("accumulator"),
    pythPriceAccountPk.toBuffer(),
  ],
  messageBufferProgram.programId
);

let fundBalance = 100 * anchor.web3.LAMPORTS_PER_SOL;
describe("accumulator_updater", () => {
  // Configure the client to use the local cluster.
  let provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const [whitelistPubkey, whitelistBump] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("accumulator"), Buffer.from("whitelist")],
      messageBufferProgram.programId
    );

  before("transfer lamports to the fund", async () => {
    await provider.connection.requestAirdrop(fundPda, fundBalance);
  });

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await messageBufferProgram.methods
      .initialize(whitelistAuthority.publicKey)
      .accounts({})
      .rpc();
    console.log("Your transaction signature", tx);

    const whitelist = await messageBufferProgram.account.whitelist.fetch(
      whitelistPubkey
    );
    assert.strictEqual(whitelist.bump, whitelistBump);
    assert.isTrue(whitelist.authority.equals(whitelistAuthority.publicKey));
    console.info(`whitelist: ${JSON.stringify(whitelist)}`);
  });

  it("Sets allowed programs to the whitelist", async () => {
    const allowedProgramAuthorities = [mockCpiCallerAuth];
    await messageBufferProgram.methods
      .setAllowedPrograms(allowedProgramAuthorities)
      .accounts({
        authority: whitelistAuthority.publicKey,
      })
      .signers([whitelistAuthority])
      .rpc();
    const whitelist = await messageBufferProgram.account.whitelist.fetch(
      whitelistPubkey
    );
    console.info(`whitelist after add: ${JSON.stringify(whitelist)}`);
    const whitelistAllowedPrograms = whitelist.allowedPrograms.map((pk) =>
      pk.toString()
    );
    assert.deepEqual(
      whitelistAllowedPrograms,
      allowedProgramAuthorities.map((p) => p.toString())
    );
  });

  it("Updates the whitelist authority", async () => {
    const newWhitelistAuthority = anchor.web3.Keypair.generate();
    await messageBufferProgram.methods
      .updateWhitelistAuthority(newWhitelistAuthority.publicKey)
      .accounts({
        authority: whitelistAuthority.publicKey,
      })
      .signers([whitelistAuthority])
      .rpc();

    const whitelist = await messageBufferProgram.account.whitelist.fetch(
      whitelistPubkey
    );
    assert.isTrue(whitelist.authority.equals(newWhitelistAuthority.publicKey));

    whitelistAuthority = newWhitelistAuthority;
  });

  it("Mock CPI program - AddPrice", async () => {
    const mockCpiCallerAddPriceTxPubkeys = await mockCpiProg.methods
      .addPrice(addPriceParams)
      .accounts({
        fund: fundPda,
        systemProgram: anchor.web3.SystemProgram.programId,
        auth: mockCpiCallerAuth,
        accumulatorWhitelist: whitelistPubkey,
        messageBufferProgram: messageBufferProgram.programId,
      })
      .pubkeys();

    const accumulatorPdaMetas = [
      {
        pubkey: accumulatorPdaKey,
        isSigner: false,
        isWritable: true,
      },
    ];

    const mockCpiCallerAddPriceTxPrep = await mockCpiProg.methods
      .addPrice(addPriceParams)
      .accounts({
        ...mockCpiCallerAddPriceTxPubkeys,
      })
      .remainingAccounts(accumulatorPdaMetas)
      .prepare();

    console.log(
      `ix: ${JSON.stringify(
        mockCpiCallerAddPriceTxPrep.instruction,
        (k, v) => {
          if (k === "data") {
            return v.toString();
          } else {
            return v;
          }
        },
        2
      )}`
    );
    for (const prop in mockCpiCallerAddPriceTxPrep.pubkeys) {
      console.log(
        `${prop}: ${mockCpiCallerAddPriceTxPrep.pubkeys[prop].toString()}`
      );
    }

    const addPriceTx = await mockCpiProg.methods
      .addPrice(addPriceParams)
      .accounts({
        ...mockCpiCallerAddPriceTxPubkeys,
      })
      .remainingAccounts(accumulatorPdaMetas)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      ])
      .rpc({
        skipPreflight: true,
      });

    console.log(`addPriceTx: ${addPriceTx}`);
    const pythPriceAccount = await provider.connection.getAccountInfo(
      mockCpiCallerAddPriceTxPubkeys.pythPriceAccount
    );

    const messageBuffer =
      await messageBufferProgram.account.messageBuffer.fetch(accumulatorPdaKey);

    const accumulatorPriceMessages = parseMessageBuffer(messageBuffer);

    console.log(
      `accumulatorPriceMessages: ${JSON.stringify(
        accumulatorPriceMessages,
        null,
        2
      )}`
    );
    accumulatorPriceMessages.forEach((pm) => {
      assert.isTrue(pm.id.eq(addPriceParams.id));
      assert.isTrue(pm.price.eq(addPriceParams.price));
      assert.isTrue(pm.priceExpo.eq(addPriceParams.priceExpo));
    });

    const fundBalanceAfter = await provider.connection.getBalance(fundPda);
    assert.isTrue(fundBalance > fundBalanceAfter);
  });

  it("Fetches MessageBuffer using getProgramAccounts with discriminator", async () => {
    let discriminator =
      BorshAccountsCoder.accountDiscriminator("MessageBuffer");
    let messageBufferDiscriminator = bs58.encode(discriminator);

    // fetch using `getProgramAccounts` and memcmp filter
    const messageBufferAccounts = await provider.connection.getProgramAccounts(
      messageBufferProgram.programId,
      {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: messageBufferDiscriminator,
            },
          },
        ],
      }
    );
    const msgBufferAcctKeys = messageBufferAccounts.map((ai) =>
      ai.pubkey.toString()
    );
    console.log(
      `messageBufferAccounts: ${JSON.stringify(msgBufferAcctKeys, null, 2)}`
    );

    assert.isTrue(messageBufferAccounts.length === 1);
    msgBufferAcctKeys.includes(accumulatorPdaKey.toString());
  });

  it("Mock CPI Program - UpdatePrice", async () => {
    const updatePriceParams = {
      price: new anchor.BN(5),
      priceExpo: new anchor.BN(6),
      ema: new anchor.BN(7),
      emaExpo: new anchor.BN(8),
    };

    let accumulatorPdaMeta = getAccumulatorPdaMeta(
      mockCpiCallerAuth,
      pythPriceAccountPk
    );
    await mockCpiProg.methods
      .updatePrice(updatePriceParams)
      .accounts({
        fund: fundPda,
        pythPriceAccount: pythPriceAccountPk,
        auth: mockCpiCallerAuth,
        accumulatorWhitelist: whitelistPubkey,
        messageBufferProgram: messageBufferProgram.programId,
      })
      .remainingAccounts([accumulatorPdaMeta])
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      ])
      .rpc({
        skipPreflight: true,
      });

    const pythPriceAccount = await mockCpiProg.account.priceAccount.fetch(
      pythPriceAccountPk
    );
    assert.isTrue(pythPriceAccount.price.eq(updatePriceParams.price));
    assert.isTrue(pythPriceAccount.priceExpo.eq(updatePriceParams.priceExpo));
    assert.isTrue(pythPriceAccount.ema.eq(updatePriceParams.ema));
    assert.isTrue(pythPriceAccount.emaExpo.eq(updatePriceParams.emaExpo));
    const messageBuffer =
      await messageBufferProgram.account.messageBuffer.fetch(
        accumulatorPdaMeta.pubkey
      );
    const updatedAccumulatorPriceMessages = parseMessageBuffer(messageBuffer);

    console.log(
      `updatedAccumulatorPriceMessages: ${JSON.stringify(
        updatedAccumulatorPriceMessages,
        null,
        2
      )}`
    );
    updatedAccumulatorPriceMessages.forEach((pm) => {
      assert.isTrue(pm.id.eq(addPriceParams.id));
      assert.isTrue(pm.price.eq(updatePriceParams.price));
      assert.isTrue(pm.priceExpo.eq(updatePriceParams.priceExpo));
    });
  });

  it("Mock CPI Program - CPI Max Test", async () => {
    // with loosen CPI feature activated, max cpi instruction size len is 10KB
    let testCases = [[1024], [1024, 2048], [1024, 2048, 4096]];
    // for (let i = 1; i < 8; i++) {
    for (let i = 0; i < testCases.length; i++) {
      let testCase = testCases[i];
      console.info(`testCase: ${testCase}`);
      const updatePriceParams = {
        price: new anchor.BN(10 * i + 5),
        priceExpo: new anchor.BN(10 & (i + 6)),
        ema: new anchor.BN(10 * i + 7),
        emaExpo: new anchor.BN(10 * i + 8),
      };

      let accumulatorPdaMeta = getAccumulatorPdaMeta(
        mockCpiCallerAuth,
        pythPriceAccountPk
      );
      await mockCpiProg.methods
        .cpiMaxTest(updatePriceParams, testCase)
        .accounts({
          fund: fundPda,
          pythPriceAccount: pythPriceAccountPk,
          auth: mockCpiCallerAuth,
          accumulatorWhitelist: whitelistPubkey,
          messageBufferProgram: messageBufferProgram.programId,
        })
        .remainingAccounts([accumulatorPdaMeta])
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
        ])
        .rpc({
          skipPreflight: true,
        });

      const pythPriceAccount = await mockCpiProg.account.priceAccount.fetch(
        pythPriceAccountPk
      );
      assert.isTrue(pythPriceAccount.price.eq(updatePriceParams.price));
      assert.isTrue(pythPriceAccount.priceExpo.eq(updatePriceParams.priceExpo));
      assert.isTrue(pythPriceAccount.ema.eq(updatePriceParams.ema));
      assert.isTrue(pythPriceAccount.emaExpo.eq(updatePriceParams.emaExpo));
      const messageBuffer =
        await messageBufferProgram.account.messageBuffer.fetch(
          accumulatorPdaMeta.pubkey
        );
      const updatedAccumulatorPriceMessages = parseMessageBuffer(messageBuffer);

      console.log(
        `updatedAccumulatorPriceMessages: ${JSON.stringify(
          updatedAccumulatorPriceMessages,
          null,
          2
        )}`
      );
      updatedAccumulatorPriceMessages.forEach((pm) => {
        assert.isTrue(pm.id.eq(addPriceParams.id));
        assert.isTrue(pm.price.eq(updatePriceParams.price));
        assert.isTrue(pm.priceExpo.eq(updatePriceParams.priceExpo));
      });
    }
  });

  it("Mock CPI Program - CPI Max Test Fail", async () => {
    // with loosen CPI feature activated, max cpi instruction size len is 10KB
    let testCases = [[1024, 2048, 4096, 8192]];
    // for (let i = 1; i < 8; i++) {
    for (let i = 0; i < testCases.length; i++) {
      let testCase = testCases[i];
      console.info(`testCase: ${testCase}`);
      const updatePriceParams = {
        price: new anchor.BN(10 * i + 5),
        priceExpo: new anchor.BN(10 & (i + 6)),
        ema: new anchor.BN(10 * i + 7),
        emaExpo: new anchor.BN(10 * i + 8),
      };

      let accumulatorPdaMeta = getAccumulatorPdaMeta(
        mockCpiCallerAuth,
        pythPriceAccountPk
      );
      let errorThrown = false;
      try {
        await mockCpiProg.methods
          .cpiMaxTest(updatePriceParams, testCase)
          .accounts({
            fund: fundPda,
            pythPriceAccount: pythPriceAccountPk,
            auth: mockCpiCallerAuth,
            accumulatorWhitelist: whitelistPubkey,
            messageBufferProgram: messageBufferProgram.programId,
          })
          .remainingAccounts([accumulatorPdaMeta])
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
          ])
          .rpc({
            skipPreflight: true,
          });
      } catch (_err) {
        errorThrown = true;
      }
      assert.ok(errorThrown);
    }
  });
});

export const getAccumulatorPdaMeta = (
  cpiCallerAuth: anchor.web3.PublicKey,
  pythAccount: anchor.web3.PublicKey
): AccountMeta => {
  const accumulatorPdaKey = anchor.web3.PublicKey.findProgramAddressSync(
    [
      cpiCallerAuth.toBuffer(),
      Buffer.from("accumulator"),
      pythAccount.toBuffer(),
    ],
    messageBufferProgram.programId
  )[0];
  return {
    pubkey: accumulatorPdaKey,
    isSigner: false,
    isWritable: true,
  };
};

type BufferHeader = IdlTypes<MessageBuffer>["BufferHeader"];

// Parses MessageBuffer.data into a PriceAccount or PriceOnly object based on the
// accountType and accountSchema.
function parseMessageBuffer({
  header,
  messages,
}: {
  header: BufferHeader;
  messages: number[];
}): AccumulatorPriceMessage[] {
  const accumulatorMessages = [];
  let dataBuffer = Buffer.from(messages);

  let start = 0;
  for (let i = 0; i < header.endOffsets.length; i++) {
    const endOffset = header.endOffsets[i];

    if (endOffset == 0) {
      console.log(`endOffset = 0. breaking`);
      break;
    }

    const messageBytes = dataBuffer.subarray(start, endOffset);
    const { header: msgHeader, data: msgData } =
      parseMessageBytes(messageBytes);
    console.info(`header: ${JSON.stringify(msgHeader, null, 2)}`);
    if (msgHeader.schema == 0) {
      accumulatorMessages.push(parseFullPriceMessage(msgData));
    } else if (msgHeader.schema == 1) {
      accumulatorMessages.push(parseCompactPriceMessage(msgData));
    } else {
      console.warn("unknown msgHeader.schema: " + i);
      continue;
    }
    start = endOffset;
  }
  return accumulatorMessages;
}

type MessageHeader = {
  schema: number;
  version: number;
  size: number;
};

type MessageBuffer = {
  header: MessageHeader;
  data: Buffer;
};

function parseMessageBytes(data: Buffer): MessageBuffer {
  let offset = 0;

  const schema = data.readInt8(offset);
  offset += 1;

  const version = data.readInt16BE(offset);
  offset += 2;

  const size = data.readUInt32BE(offset);
  offset += 4;

  const messageHeader = {
    schema,
    version,
    size,
  };
  let messageData = data.subarray(offset, offset + size);
  return {
    header: messageHeader,
    data: messageData,
  };
}

//TODO: follow wormhole sdk parsing structure?
// - https://github.com/wormhole-foundation/wormhole/blob/main/sdk/js/src/vaa/generic.ts
type AccumulatorPriceMessage = FullPriceMessage | CompactPriceMessage;

type FullPriceMessage = {
  id: anchor.BN;
  price: anchor.BN;
  priceExpo: anchor.BN;
  ema: anchor.BN;
  emaExpo: anchor.BN;
};
function parseFullPriceMessage(data: Uint8Array): FullPriceMessage {
  return {
    id: new anchor.BN(data.subarray(0, 8), "be"),
    price: new anchor.BN(data.subarray(8, 16), "be"),
    priceExpo: new anchor.BN(data.subarray(16, 24), "be"),
    ema: new anchor.BN(data.subarray(24, 32), "be"),
    emaExpo: new anchor.BN(data.subarray(32, 40), "be"),
  };
}

type CompactPriceMessage = {
  id: anchor.BN;
  price: anchor.BN;
  priceExpo: anchor.BN;
};

function parseCompactPriceMessage(data: Uint8Array): CompactPriceMessage {
  return {
    id: new anchor.BN(data.subarray(0, 8), "be"),
    price: new anchor.BN(data.subarray(8, 16), "be"),
    priceExpo: new anchor.BN(data.subarray(16, 24), "be"),
  };
}
