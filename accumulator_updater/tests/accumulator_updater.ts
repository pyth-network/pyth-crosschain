import * as anchor from "@coral-xyz/anchor";
import { IdlTypes, Program, IdlAccounts } from "@coral-xyz/anchor";
import { AccumulatorUpdater } from "../target/types/accumulator_updater";
import { MockCpiCaller } from "../target/types/mock_cpi_caller";
import lumina from "@lumina-dev/test";
import { assert } from "chai";
import { ComputeBudgetProgram } from "@solana/web3.js";

// Enables tool that runs in localbrowser for easier debugging of txns
// in this test -  https://lumina.fyi/debug
lumina();

const accumulatorUpdaterProgram = anchor.workspace
  .AccumulatorUpdater as Program<AccumulatorUpdater>;
const mockCpiProg = anchor.workspace.MockCpiCaller as Program<MockCpiCaller>;

describe("accumulator_updater", () => {
  // Configure the client to use the local cluster.
  let provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const [whitelistPda, whitelistBump] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("accumulator"), Buffer.from("whitelist")],
      accumulatorUpdaterProgram.programId
    );

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await accumulatorUpdaterProgram.methods
      .initialize()
      .accounts({})
      .rpc();
    console.log("Your transaction signature", tx);

    const whitelist = await accumulatorUpdaterProgram.account.whitelist.fetch(
      whitelistPda
    );
    assert.strictEqual(whitelist.bump, whitelistBump);
    console.info(`whitelist: ${JSON.stringify(whitelist)}`);
  });

  it("Adds a program to the whitelist", async () => {
    const addToWhitelistTx = await accumulatorUpdaterProgram.methods
      .addAllowedProgram(mockCpiProg.programId)
      .accounts({})
      .rpc();
    const whitelist = await accumulatorUpdaterProgram.account.whitelist.fetch(
      whitelistPda
    );
    console.info(`whitelist after add: ${JSON.stringify(whitelist)}`);

    assert.isTrue(
      whitelist.allowedPrograms
        .map((pk) => pk.toString())
        .includes(mockCpiProg.programId.toString())
    );
  });

  it("Mock CPI program - AddPrice", async () => {
    const addPriceParams = {
      id: new anchor.BN(1),
      price: new anchor.BN(2),
      priceExpo: new anchor.BN(3),
      ema: new anchor.BN(4),
      emaExpo: new anchor.BN(5),
    };

    const mockCpiCallerAddPriceTxPubkeys = await mockCpiProg.methods
      .addPrice(addPriceParams)
      .accounts({
        systemProgram: anchor.web3.SystemProgram.programId,
        ixsSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        accumulatorWhitelist: whitelistPda,
        accumulatorProgram: accumulatorUpdaterProgram.programId,
      })
      .pubkeys();

    const accumulatorPdas = [0, 1].map((pythSchema) => {
      const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          mockCpiProg.programId.toBuffer(),
          Buffer.from("accumulator"),
          mockCpiCallerAddPriceTxPubkeys.pythPriceAccount.toBuffer(),
          new anchor.BN(pythSchema).toArrayLike(Buffer, "le", 1),
        ],
        accumulatorUpdaterProgram.programId
      );
      console.log(`pda for pyth schema ${pythSchema}: ${pda.toString()}`);
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
      .remainingAccounts(accumulatorPdas)
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
      .remainingAccounts(accumulatorPdas)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      ])
      .rpc({
        skipPreflight: true,
      });

    console.log(`addPriceTx: ${addPriceTx}`);
    const accumulatorInputkeys = accumulatorPdas.map((a) => a.pubkey);

    const accumulatorInputs =
      await accumulatorUpdaterProgram.account.accumulatorInput.fetchMultiple(
        accumulatorInputkeys
      );

    const accumulatorPriceAccounts = accumulatorInputs.map((ai) => {
      const { header, data } = ai;

      return parseAccumulatorInput(ai);
    });
    console.log(
      `accumulatorPriceAccounts: ${JSON.stringify(
        accumulatorPriceAccounts,
        null,
        2
      )}`
    );
    accumulatorPriceAccounts.forEach((pa) => {
      assert.isTrue(pa.id.eq(addPriceParams.id));
      assert.isTrue(pa.price.eq(addPriceParams.price));
      assert.isTrue(pa.priceExpo.eq(addPriceParams.priceExpo));
    });
  });
});

type AccumulatorInputHeader = IdlTypes<AccumulatorUpdater>["AccumulatorHeader"];
type AccumulatorInputPriceAccountTypes =
  | IdlAccounts<MockCpiCaller>["priceAccount"] // case-sensitive
  | IdlTypes<MockCpiCaller>["PriceOnly"];

// Parses AccumulatorInput.data into a PriceAccount or PriceOnly object based on the
// accountType and accountSchema.
//
// AccumulatorInput.data for AccumulatorInput<PriceAccount> will
// have mockCpiCaller::PriceAccount.discriminator()
// AccumulatorInput<PriceOnly> will not since its not an account
function parseAccumulatorInput({
  header,
  data,
}: {
  header: AccumulatorInputHeader;
  data: Buffer;
}): AccumulatorInputPriceAccountTypes {
  console.log(`header: ${JSON.stringify(header)}`);
  assert.strictEqual(header.accountType, 3);
  if (header.accountSchema === 0) {
    console.log(`[full]data: ${data.toString("hex")}`);
    // case-sensitive. Note that "P" is capitalized here and not in
    // the AccumulatorInputPriceAccountTypes type alias.
    return mockCpiProg.coder.accounts.decode("PriceAccount", data);
  } else {
    console.log(`[compact]data: ${data.toString("hex")}`);
    return mockCpiProg.coder.types.decode("PriceOnly", data);
  }
}
