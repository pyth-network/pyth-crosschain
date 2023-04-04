import * as anchor from "@coral-xyz/anchor";
import { IdlTypes, Program, BorshAccountsCoder } from "@coral-xyz/anchor";
import { AccumulatorUpdater } from "../target/types/accumulator_updater";
import { MockCpiCaller } from "../target/types/mock_cpi_caller";
import lumina from "@lumina-dev/test";
import { assert } from "chai";
import { AccountMeta, ComputeBudgetProgram } from "@solana/web3.js";
import bs58 from "bs58";

// Enables tool that runs in local browser for easier debugging of
// transactions in this test -  https://lumina.fyi/debug
lumina();

const accumulatorUpdaterProgram = anchor.workspace
  .AccumulatorUpdater as Program<AccumulatorUpdater>;
const mockCpiProg = anchor.workspace.MockCpiCaller as Program<MockCpiCaller>;
let whitelistAuthority = anchor.web3.Keypair.generate();

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

const PRICE_SCHEMAS = [0, 1];


describe("accumulator_updater", () => {
  // Configure the client to use the local cluster.
  let provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const [whitelistPubkey, whitelistBump] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("accumulator"), Buffer.from("whitelist")],
      accumulatorUpdaterProgram.programId
    );

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await accumulatorUpdaterProgram.methods
      .initialize(whitelistAuthority.publicKey)
      .accounts({})
      .rpc();
    console.log("Your transaction signature", tx);

    const whitelist = await accumulatorUpdaterProgram.account.whitelist.fetch(
      whitelistPubkey
    );
    assert.strictEqual(whitelist.bump, whitelistBump);
    assert.isTrue(whitelist.authority.equals(whitelistAuthority.publicKey));
    console.info(`whitelist: ${JSON.stringify(whitelist)}`);
  });

  it("Sets allowed programs to the whitelist", async () => {
    const allowedPrograms = [mockCpiProg.programId];
    await accumulatorUpdaterProgram.methods
      .setAllowedPrograms(allowedPrograms)
      .accounts({
        authority: whitelistAuthority.publicKey,
      })
      .signers([whitelistAuthority])
      .rpc();
    const whitelist = await accumulatorUpdaterProgram.account.whitelist.fetch(
      whitelistPubkey
    );
    console.info(`whitelist after add: ${JSON.stringify(whitelist)}`);
    const whitelistAllowedPrograms = whitelist.allowedPrograms.map((pk) =>
      pk.toString()
    );
    assert.deepEqual(
      whitelistAllowedPrograms,
      allowedPrograms.map((p) => p.toString())
    );
  });

  it("Updates the whitelist authority", async () => {
    const newWhitelistAuthority = anchor.web3.Keypair.generate();
    await accumulatorUpdaterProgram.methods
      .updateWhitelistAuthority(newWhitelistAuthority.publicKey)
      .accounts({
        authority: whitelistAuthority.publicKey,
      })
      .signers([whitelistAuthority])
      .rpc();

    const whitelist = await accumulatorUpdaterProgram.account.whitelist.fetch(
      whitelistPubkey
    );
    assert.isTrue(whitelist.authority.equals(newWhitelistAuthority.publicKey));

    whitelistAuthority = newWhitelistAuthority;
  });

  it("Mock CPI program - AddPrice", async () => {
    const mockCpiCallerAddPriceTxPubkeys = await mockCpiProg.methods
      .addPrice(addPriceParams)
      .accounts({
        systemProgram: anchor.web3.SystemProgram.programId,
        ixsSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        accumulatorWhitelist: whitelistPubkey,
        accumulatorProgram: accumulatorUpdaterProgram.programId,
      })
      .pubkeys();

    const accumulatorPdaKeys = PRICE_SCHEMAS.map((pythSchema) => {
      return anchor.web3.PublicKey.findProgramAddressSync(
        [
          mockCpiProg.programId.toBuffer(),
          Buffer.from("accumulator"),
          // mockCpiCallerAddPriceTxPubkeys.pythPriceAccount.toBuffer(),
          pythPriceAccountPk.toBuffer(),
          new anchor.BN(pythSchema).toArrayLike(Buffer, "le", 1),
        ],
        accumulatorUpdaterProgram.programId
      )[0];
    });
    const accumulatorPdaMetas = accumulatorPdaKeys.map((pda) => {
      return {
        pubkey: pda,
        isSigner: false,
        isWritable: true,
      };
      // return pda;
    });

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
    console.log(`pythPriceAccount: ${pythPriceAccount.data.toString("hex")}`);

    const accumulatorInputs =
      await accumulatorUpdaterProgram.account.accumulatorInput.fetchMultiple(
        accumulatorPdaKeys
      );

    const accumulatorPriceMessages = accumulatorInputs.map((ai) => {
      return parseAccumulatorInput(ai);
    });
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

    let discriminator =
      BorshAccountsCoder.accountDiscriminator("AccumulatorInput");
    let accumulatorInputDiscriminator = bs58.encode(discriminator);

    // fetch using `getProgramAccounts` and memcmp filter
    const accumulatorAccounts = await provider.connection.getProgramAccounts(
      accumulatorUpdaterProgram.programId,
      {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: accumulatorInputDiscriminator,
            },
          },
        ],
      }
    );
    const accumulatorInputKeyStrings = accumulatorPdaKeys.map((k) =>
      k.toString()
    );
    accumulatorAccounts.forEach((a) => {
      assert.isTrue(accumulatorInputKeyStrings.includes(a.pubkey.toString()));
    });
  });

  it("Mock CPI Program - UpdatePrice", async () => {
    const updatePriceParams = {
      price: new anchor.BN(5),
      priceExpo: new anchor.BN(6),
      ema: new anchor.BN(7),
      emaExpo: new anchor.BN(8),
    };

    let accumulatorPdaMetas = getAccumulatorPdaMetas(
      pythPriceAccountPk,
      PRICE_SCHEMAS
    );
    await mockCpiProg.methods
      .updatePrice(updatePriceParams)
      .accounts({
        pythPriceAccount: pythPriceAccountPk,
        ixsSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        accumulatorWhitelist: whitelistPubkey,
        accumulatorProgram: accumulatorUpdaterProgram.programId,
      })
      .remainingAccounts(accumulatorPdaMetas)
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
    const accumulatorInputs =
      await accumulatorUpdaterProgram.account.accumulatorInput.fetchMultiple(
        accumulatorPdaMetas.map((m) => m.pubkey)
      );
    const updatedAccumulatorPriceMessages = accumulatorInputs.map((ai) => {
      return parseAccumulatorInput(ai);
    });

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

    let discriminator =
      BorshAccountsCoder.accountDiscriminator("AccumulatorInput");
    let accumulatorInputDiscriminator = bs58.encode(discriminator);

    // fetch using `getProgramAccounts` and memcmp filter
    const accumulatorAccounts = await provider.connection.getProgramAccounts(
      accumulatorUpdaterProgram.programId,
      {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: accumulatorInputDiscriminator,
            },
          },
        ],
      }
    );
    const accumulatorInputKeyStrings = accumulatorInputKeys.map((k) =>
      k.toString()
    );
    accumulatorAccounts.forEach((a) => {
      assert.isTrue(accumulatorInputKeyStrings.includes(a.pubkey.toString()));
    });
  });
});

export const getAccumulatorPdaMetas = (
  pythAccount: anchor.web3.PublicKey,
  schemas: number[]
): AccountMeta[] => {
  const accumulatorPdaKeys = schemas.map((pythSchema) => {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        mockCpiProg.programId.toBuffer(),
        Buffer.from("accumulator"),
        pythAccount.toBuffer(),
        new anchor.BN(pythSchema).toArrayLike(Buffer, "le", 1),
      ],
      accumulatorUpdaterProgram.programId
    )[0];
  });
  return accumulatorPdaKeys.map((pda) => {
    return {
      pubkey: pda,
      isSigner: false,
      isWritable: true,
    };
  });
};

type AccumulatorInputHeader = IdlTypes<AccumulatorUpdater>["AccumulatorHeader"];

// Parses AccumulatorInput.data into a PriceAccount or PriceOnly object based on the
// accountType and accountSchema.
function parseAccumulatorInput({
  header,
  data,
}: {
  header: AccumulatorInputHeader;
  data: Buffer;
}): AccumulatorPriceMessage {
  console.log(`header: ${JSON.stringify(header)}`);
  assert.strictEqual(header.accountType, 3);
  if (header.accountSchema === 0) {
    console.log(`[full]data: ${data.toString("hex")}`);
    return parseFullPriceMessage(data);
  } else {
    console.log(`[compact]data: ${data.toString("hex")}`);
    return parseCompactPriceMessage(data);
  }
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

function parseFullPriceMessage(data: Buffer): FullPriceMessage {
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

function parseCompactPriceMessage(data: Buffer): CompactPriceMessage {
  return {
    id: new anchor.BN(data.subarray(0, 8), "be"),
    price: new anchor.BN(data.subarray(8, 16), "be"),
    priceExpo: new anchor.BN(data.subarray(16, 24), "be"),
  };
}

interface AccumulatorInput<T> {
  header: AccumulatorInputHeader;
  account: T;
}
