import * as anchor from "@coral-xyz/anchor";
import {
  IdlAccounts,
  IdlTypes,
  Program,
  BorshAccountsCoder,
} from "@coral-xyz/anchor";
import { MessageBuffer } from "../target/types/message_buffer";
import { MockCpiCaller } from "../target/types/mock_cpi_caller";
import lumina from "@lumina-dev/test";
import { assert } from "chai";
import { AccountMeta, ComputeBudgetProgram } from "@solana/web3.js";
import bs58 from "bs58";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

// Enables tool that runs in local browser for easier debugging of
// transactions in this test -  https://lumina.fyi/debug
// lumina();

const messageBufferProgram = anchor.workspace
  .MessageBuffer as Program<MessageBuffer>;
const mockCpiProg = anchor.workspace.MockCpiCaller as Program<MockCpiCaller>;

const [mockCpiCallerAuth] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("upd_price_write"), messageBufferProgram.programId.toBuffer()],
  mockCpiProg.programId,
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
  mockCpiProg.programId,
);
const MESSAGE = Buffer.from("message");
const [messageBufferPda, messageBufferBump] =
  anchor.web3.PublicKey.findProgramAddressSync(
    [mockCpiCallerAuth.toBuffer(), MESSAGE, pythPriceAccountPk.toBuffer()],
    messageBufferProgram.programId,
  );

const pythPriceAccountId2 = new anchor.BN(2);
const [pythPriceAccountPk2] = anchor.web3.PublicKey.findProgramAddressSync(
  [
    Buffer.from("pyth"),
    Buffer.from("price"),
    pythPriceAccountId2.toArrayLike(Buffer, "le", 8),
  ],
  mockCpiProg.programId,
);

const [messageBufferPda2, messageBufferBump2] =
  anchor.web3.PublicKey.findProgramAddressSync(
    [mockCpiCallerAuth.toBuffer(), MESSAGE, pythPriceAccountPk2.toBuffer()],
    messageBufferProgram.programId,
  );

const messageBufferPdaMeta2 = {
  pubkey: messageBufferPda2,
  isSigner: false,
  isWritable: true,
};

const discriminator = BorshAccountsCoder.accountDiscriminator("MessageBuffer");
const messageBufferDiscriminator = bs58.encode(discriminator);

let provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const payer = provider.wallet as NodeWallet;
let whitelistAdmin = anchor.web3.Keypair.generate();

const [whitelistPubkey, whitelistBump] =
  anchor.web3.PublicKey.findProgramAddressSync(
    [MESSAGE, Buffer.from("whitelist")],
    messageBufferProgram.programId,
  );

describe("message_buffer", () => {
  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await messageBufferProgram.methods
      .initialize()
      .accounts({
        admin: whitelistAdmin.publicKey,
        payer: payer.publicKey,
      })
      .signers([whitelistAdmin])
      .rpc();
    console.log("Your transaction signature", tx);

    const whitelist =
      await messageBufferProgram.account.whitelist.fetch(whitelistPubkey);
    assert.strictEqual(whitelist.bump, whitelistBump);
    assert.isTrue(whitelist.admin.equals(whitelistAdmin.publicKey));
    console.info(`whitelist: ${JSON.stringify(whitelist)}`);
  });

  it("Sets allowed programs to the whitelist", async () => {
    const allowedProgramAuthorities = [mockCpiCallerAuth];
    await messageBufferProgram.methods
      .setAllowedPrograms(allowedProgramAuthorities)
      .accounts({
        admin: whitelistAdmin.publicKey,
      })
      .signers([whitelistAdmin])
      .rpc();
    const whitelist =
      await messageBufferProgram.account.whitelist.fetch(whitelistPubkey);
    console.info(`whitelist after add: ${JSON.stringify(whitelist)}`);
    const whitelistAllowedPrograms = whitelist.allowedPrograms.map((pk) =>
      pk.toString(),
    );
    assert.deepEqual(
      whitelistAllowedPrograms,
      allowedProgramAuthorities.map((p) => p.toString()),
    );
  });

  it("Creates a buffer", async () => {
    const msgBufferPdaMetas = [
      {
        pubkey: messageBufferPda,
        isSigner: false,
        isWritable: true,
      },
    ];

    await messageBufferProgram.methods
      .createBuffer(mockCpiCallerAuth, pythPriceAccountPk, 1024 * 8)
      .accounts({
        whitelist: whitelistPubkey,
        admin: whitelistAdmin.publicKey,
        payer: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([whitelistAdmin])
      .remainingAccounts(msgBufferPdaMetas)
      .rpc({ skipPreflight: true });

    const messageBufferAccountData = await getMessageBuffer(
      provider.connection,
      messageBufferPda,
    );
    const messageBufferHeader = deserializeMessageBufferHeader(
      messageBufferProgram,
      messageBufferAccountData,
    );
    assert.equal(messageBufferHeader.version, 1);
    assert.equal(messageBufferHeader.bump, messageBufferBump);
  });

  it("Creates a buffer even if the account already has lamports", async () => {
    const minimumEmptyRent =
      await provider.connection.getMinimumBalanceForRentExemption(0);
    await provider.sendAndConfirm(
      (() => {
        const tx = new anchor.web3.Transaction();
        tx.add(
          anchor.web3.SystemProgram.transfer({
            fromPubkey: provider.wallet.publicKey,
            toPubkey: messageBufferPda2,
            lamports: minimumEmptyRent,
          }),
        );
        return tx;
      })(),
    );

    const accumulatorPdaBalance =
      await provider.connection.getBalance(messageBufferPda2);
    console.log(`accumulatorPdaBalance: ${accumulatorPdaBalance}`);
    assert.isTrue(accumulatorPdaBalance === minimumEmptyRent);

    await messageBufferProgram.methods
      .createBuffer(mockCpiCallerAuth, pythPriceAccountPk2, 1000)
      .accounts({
        whitelist: whitelistPubkey,
        admin: whitelistAdmin.publicKey,
        payer: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([whitelistAdmin])
      .remainingAccounts([messageBufferPdaMeta2])
      .rpc({ skipPreflight: true });

    const messageBufferAccountData = await getMessageBuffer(
      provider.connection,
      messageBufferPda2,
    );

    const minimumMessageBufferRent =
      await provider.connection.getMinimumBalanceForRentExemption(
        messageBufferAccountData.length,
      );
    const accumulatorPdaBalanceAfter =
      await provider.connection.getBalance(messageBufferPda2);
    assert.isTrue(accumulatorPdaBalanceAfter === minimumMessageBufferRent);
    const messageBufferHeader = deserializeMessageBufferHeader(
      messageBufferProgram,
      messageBufferAccountData,
    );

    console.log(`header: ${JSON.stringify(messageBufferHeader)}`);
    assert.equal(messageBufferHeader.bump, messageBufferBump2);
    assert.equal(messageBufferAccountData[8], messageBufferBump2);

    assert.equal(messageBufferHeader.version, 1);
  });

  it("Updates the whitelist authority", async () => {
    const newWhitelistAdmin = anchor.web3.Keypair.generate();
    await messageBufferProgram.methods
      .updateWhitelistAdmin(newWhitelistAdmin.publicKey)
      .accounts({
        admin: whitelistAdmin.publicKey,
      })
      .signers([whitelistAdmin])
      .rpc();

    let whitelist =
      await messageBufferProgram.account.whitelist.fetch(whitelistPubkey);
    assert.isTrue(whitelist.admin.equals(newWhitelistAdmin.publicKey));

    // swap back to original authority
    await messageBufferProgram.methods
      .updateWhitelistAdmin(whitelistAdmin.publicKey)
      .accounts({
        admin: newWhitelistAdmin.publicKey,
      })
      .signers([newWhitelistAdmin])
      .rpc();

    whitelist =
      await messageBufferProgram.account.whitelist.fetch(whitelistPubkey);
    assert.isTrue(whitelist.admin.equals(whitelistAdmin.publicKey));
  });

  it("Mock CPI program - AddPrice", async () => {
    const mockCpiCallerAddPriceTxPubkeys = await mockCpiProg.methods
      .addPrice(addPriceParams)
      .accounts({
        systemProgram: anchor.web3.SystemProgram.programId,
        auth: mockCpiCallerAuth,
        accumulatorWhitelist: whitelistPubkey,
        messageBufferProgram: messageBufferProgram.programId,
      })
      .pubkeys();

    const accumulatorPdaMetas = [
      {
        pubkey: messageBufferPda,
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
        2,
      )}`,
    );
    for (const prop in mockCpiCallerAddPriceTxPrep.pubkeys) {
      console.log(
        `${prop}: ${mockCpiCallerAddPriceTxPrep.pubkeys[prop].toString()}`,
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
      mockCpiCallerAddPriceTxPubkeys.pythPriceAccount,
    );

    const messageBufferAccount =
      await provider.connection.getAccountInfo(messageBufferPda);

    const accumulatorPriceMessages = parseMessageBuffer(
      messageBufferProgram,
      messageBufferAccount.data,
    );

    console.log(
      `accumulatorPriceMessages: ${JSON.stringify(
        accumulatorPriceMessages,
        null,
        2,
      )}`,
    );
    accumulatorPriceMessages.forEach((pm) => {
      assert.isTrue(pm.id.eq(addPriceParams.id));
      assert.isTrue(pm.price.eq(addPriceParams.price));
      assert.isTrue(pm.priceExpo.eq(addPriceParams.priceExpo));
    });
  });

  it("Fetches MessageBuffer using getProgramAccounts with discriminator", async () => {
    const messageBufferAccounts = await getProgramAccountsForMessageBuffers(
      provider.connection,
    );
    const msgBufferAcctKeys = messageBufferAccounts.map((ai) =>
      ai.pubkey.toString(),
    );
    console.log(
      `messageBufferAccounts: ${JSON.stringify(msgBufferAcctKeys, null, 2)}`,
    );

    assert.isTrue(messageBufferAccounts.length === 2);
    msgBufferAcctKeys.includes(messageBufferPda.toString());
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
      pythPriceAccountPk,
    );
    await mockCpiProg.methods
      .updatePrice(updatePriceParams)
      .accounts({
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

    const pythPriceAccount =
      await mockCpiProg.account.priceAccount.fetch(pythPriceAccountPk);
    assert.isTrue(pythPriceAccount.price.eq(updatePriceParams.price));
    assert.isTrue(pythPriceAccount.priceExpo.eq(updatePriceParams.priceExpo));
    assert.isTrue(pythPriceAccount.ema.eq(updatePriceParams.ema));
    assert.isTrue(pythPriceAccount.emaExpo.eq(updatePriceParams.emaExpo));

    const messageBufferAccountData = await getMessageBuffer(
      provider.connection,
      messageBufferPda,
    );

    const updatedAccumulatorPriceMessages = parseMessageBuffer(
      messageBufferProgram,
      messageBufferAccountData,
    );

    console.log(
      `updatedAccumulatorPriceMessages: ${JSON.stringify(
        updatedAccumulatorPriceMessages,
        null,
        2,
      )}`,
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
        price: new anchor.BN(10 * (i + 5)),
        priceExpo: new anchor.BN(10 * (i + 6)),
        ema: new anchor.BN(10 * i + 7),
        emaExpo: new anchor.BN(10 * i + 8),
      };
      console.log(`updatePriceParams: ${JSON.stringify(updatePriceParams)}`);

      let accumulatorPdaMeta = getAccumulatorPdaMeta(
        mockCpiCallerAuth,
        pythPriceAccountPk,
      );
      await mockCpiProg.methods
        .cpiMaxTest(updatePriceParams, testCase)
        .accounts({
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

      const pythPriceAccount =
        await mockCpiProg.account.priceAccount.fetch(pythPriceAccountPk);
      assert.isTrue(pythPriceAccount.price.eq(updatePriceParams.price));
      assert.isTrue(pythPriceAccount.priceExpo.eq(updatePriceParams.priceExpo));
      assert.isTrue(pythPriceAccount.ema.eq(updatePriceParams.ema));
      assert.isTrue(pythPriceAccount.emaExpo.eq(updatePriceParams.emaExpo));

      const messageBufferAccountData = await getMessageBuffer(
        provider.connection,
        messageBufferPda,
      );

      const messageBufferHeader = deserializeMessageBufferHeader(
        messageBufferProgram,
        messageBufferAccountData,
      );

      console.log(`header: ${JSON.stringify(messageBufferHeader)}`);
      let mockCpiMessageHeaderLen = 7;

      let currentExpectedOffset = 0;
      for (let j = 0; j < testCase.length; j++) {
        currentExpectedOffset += testCase[j];
        currentExpectedOffset += mockCpiMessageHeaderLen;
        console.log(`
          header.endOffsets[${j}]: ${messageBufferHeader.endOffsets[j]}
          currentExpectedOffset: ${currentExpectedOffset}
        `);
        assert.isTrue(
          messageBufferHeader.endOffsets[j] === currentExpectedOffset,
        );
      }
    }
  });

  it("Mock CPI Program - Exceed CPI Max Test ", async () => {
    // with loosen CPI feature activated, max cpi instruction size len is 10KB
    let testCases = [[1024, 2048, 4096, 8192]];
    // for (let i = 1; i < 8; i++) {
    for (let i = 0; i < testCases.length; i++) {
      let testCase = testCases[i];
      console.info(`testCase: ${testCase}`);
      const updatePriceParams = {
        price: new anchor.BN(10 * i + 5),
        priceExpo: new anchor.BN(10 * (i + 6)),
        ema: new anchor.BN(10 * i + 7),
        emaExpo: new anchor.BN(10 * i + 8),
      };

      let accumulatorPdaMeta = getAccumulatorPdaMeta(
        mockCpiCallerAuth,
        pythPriceAccountPk,
      );
      let errorThrown = false;
      try {
        await mockCpiProg.methods
          .cpiMaxTest(updatePriceParams, testCase)
          .accounts({
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

  it("Resizes a buffer to a valid larger size", async () => {
    const messageBufferAccountDataBefore = await getMessageBuffer(
      provider.connection,
      messageBufferPda2,
    );
    const messageBufferAccountDataLenBefore =
      messageBufferAccountDataBefore.length;

    // check that header is still the same as before
    const messageBufferHeaderBefore = deserializeMessageBufferHeader(
      messageBufferProgram,
      messageBufferAccountDataBefore,
    );

    const payerBalanceBefore = await provider.connection.getBalance(
      payer.publicKey,
    );
    console.log(`payerBalanceBefore: ${payerBalanceBefore}`);
    const targetSize = 10 * 1024;
    await messageBufferProgram.methods
      .resizeBuffer(mockCpiCallerAuth, pythPriceAccountPk2, targetSize)
      .accounts({
        whitelist: whitelistPubkey,
        admin: whitelistAdmin.publicKey,
        payer: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([whitelistAdmin])
      .rpc({ skipPreflight: true });

    const payerBalanceAftger = await provider.connection.getBalance(
      payer.publicKey,
    );
    assert.isTrue(payerBalanceAftger < payerBalanceBefore);

    const messageBufferAccountData = await getMessageBuffer(
      provider.connection,
      messageBufferPda2,
    );
    assert.equal(messageBufferAccountData.length, targetSize);

    // check that header is still the same as before
    const messageBufferHeader = deserializeMessageBufferHeader(
      messageBufferProgram,
      messageBufferAccountData,
    );
    assert.deepEqual(
      messageBufferHeader.endOffsets,
      messageBufferHeaderBefore.endOffsets,
    );
    assert.deepEqual(
      messageBufferAccountData.subarray(0, messageBufferAccountDataLenBefore),
      messageBufferAccountDataBefore,
    );
  });

  it("Resizes a buffer to a smaller size", async () => {
    const targetSize = 4 * 1024;
    await messageBufferProgram.methods
      .resizeBuffer(mockCpiCallerAuth, pythPriceAccountPk2, targetSize)
      .accounts({
        whitelist: whitelistPubkey,
        admin: whitelistAdmin.publicKey,
        payer: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        messageBuffer: messageBufferPda2,
      })
      .signers([whitelistAdmin])
      .rpc({ skipPreflight: true });

    const messageBufferAccountData = await getMessageBuffer(
      provider.connection,
      messageBufferPda2,
    );
    assert.equal(messageBufferAccountData.length, targetSize);
  });

  it("Fails to resize buffers to invalid sizes", async () => {
    // resize more than 10KB in one txn and less than header.header_len should be fail
    const testCases = [20 * 1024, 2];
    for (const testCase of testCases) {
      let errorThrown = false;
      try {
        await messageBufferProgram.methods
          .resizeBuffer(mockCpiCallerAuth, pythPriceAccountPk2, testCase)
          .accounts({
            whitelist: whitelistPubkey,
            admin: whitelistAdmin.publicKey,
            payer: payer.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            messageBuffer: messageBufferPda2,
          })
          .signers([whitelistAdmin])
          .rpc({ skipPreflight: true });
      } catch (_err) {
        errorThrown = true;
      }
      assert.ok(errorThrown);
    }
  });

  it("Deletes a buffer", async () => {
    await messageBufferProgram.methods
      .deleteBuffer(mockCpiCallerAuth, pythPriceAccountPk2)
      .accounts({
        whitelist: whitelistPubkey,
        admin: whitelistAdmin.publicKey,
        payer: payer.publicKey,
        messageBuffer: messageBufferPda2,
      })
      .signers([whitelistAdmin])
      .remainingAccounts([messageBufferPdaMeta2])
      .rpc({ skipPreflight: true });

    const messageBufferAccountData = await getMessageBuffer(
      provider.connection,
      messageBufferPda2,
    );

    if (messageBufferAccountData != null) {
      assert.fail("messageBufferAccountData should be null");
    }

    const messageBufferAccounts = await getProgramAccountsForMessageBuffers(
      provider.connection,
    );
    assert.equal(messageBufferAccounts.length, 1);

    assert.isFalse(
      messageBufferAccounts
        .map((a) => a.pubkey.toString())
        .includes(messageBufferPda2.toString()),
    );
  });

  it("Can recreate a buffer after it's been deleted", async () => {
    await messageBufferProgram.methods
      .createBuffer(mockCpiCallerAuth, pythPriceAccountPk2, 1000)
      .accounts({
        whitelist: whitelistPubkey,
        admin: whitelistAdmin.publicKey,
        payer: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([whitelistAdmin])
      .remainingAccounts([messageBufferPdaMeta2])
      .rpc({ skipPreflight: true });

    const messageBufferAccountData = await getMessageBuffer(
      provider.connection,
      messageBufferPda2,
    );

    const minimumMessageBufferRent =
      await provider.connection.getMinimumBalanceForRentExemption(
        messageBufferAccountData.length,
      );
    const accumulatorPdaBalanceAfter =
      await provider.connection.getBalance(messageBufferPda2);
    assert.isTrue(accumulatorPdaBalanceAfter === minimumMessageBufferRent);
    const messageBufferHeader = deserializeMessageBufferHeader(
      messageBufferProgram,
      messageBufferAccountData,
    );

    console.log(`header: ${JSON.stringify(messageBufferHeader)}`);
    assert.equal(messageBufferHeader.bump, messageBufferBump2);
    assert.equal(messageBufferAccountData[8], messageBufferBump2);

    assert.equal(messageBufferHeader.version, 1);
  });
});

export const getAccumulatorPdaMeta = (
  cpiCallerAuth: anchor.web3.PublicKey,
  pythAccount: anchor.web3.PublicKey,
): AccountMeta => {
  const accumulatorPdaKey = anchor.web3.PublicKey.findProgramAddressSync(
    [cpiCallerAuth.toBuffer(), MESSAGE, pythAccount.toBuffer()],
    messageBufferProgram.programId,
  )[0];
  return {
    pubkey: accumulatorPdaKey,
    isSigner: false,
    isWritable: true,
  };
};

async function getMessageBuffer(
  connection: anchor.web3.Connection,
  accountKey: anchor.web3.PublicKey,
): Promise<Buffer | null> {
  let accountInfo = await connection.getAccountInfo(accountKey);
  return accountInfo ? accountInfo.data : null;
}

// Parses MessageBuffer.data into a PriceAccount or PriceOnly object based on the
// accountType and accountSchema.
function parseMessageBuffer(
  messageBufferProgram: Program<MessageBuffer>,
  accountData: Buffer,
): AccumulatorPriceMessage[] {
  const msgBufferHeader = deserializeMessageBufferHeader(
    messageBufferProgram,
    accountData,
  );

  const accumulatorMessages = [];
  // let dataBuffer = Buffer.from(messages);

  let dataBuffer = accountData.subarray(
    msgBufferHeader.headerLen,
    accountData.length,
  );
  let start = 0;
  for (let i = 0; i < msgBufferHeader.endOffsets.length; i++) {
    const endOffset = msgBufferHeader.endOffsets[i];

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

type MessageBufferType = {
  header: MessageHeader;
  data: Buffer;
};

function deserializeMessageBufferHeader(
  messageBufferProgram: Program<MessageBuffer>,
  accountData: Buffer,
): IdlAccounts<MessageBuffer>["messageBuffer"] {
  return messageBufferProgram.coder.accounts.decode(
    "MessageBuffer",
    accountData,
  );
}

function parseMessageBytes(data: Buffer): MessageBufferType {
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

// fetch MessageBuffer accounts using `getProgramAccounts` and memcmp filter
async function getProgramAccountsForMessageBuffers(
  connection: anchor.web3.Connection,
) {
  return await connection.getProgramAccounts(messageBufferProgram.programId, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: messageBufferDiscriminator,
        },
      },
    ],
  });
}
