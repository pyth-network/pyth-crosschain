import path from "node:path";
import type { UTxO } from "@evolution-sdk/evolution";
import {
  AssetName,
  Assets,
  Data,
  PolicyId,
  Schema,
  TSchema,
} from "@evolution-sdk/evolution";
import type { SigningTransactionBuilder } from "@evolution-sdk/evolution/sdk/builders/TransactionBuilder";
import type { ClientContext } from "./client.js";
import { aikenEval } from "./eval.js";
import {
  ByteArray,
  CardanoTransactionValidityRange,
  Pairs_cardanoTransactionValidityRange_aikenCryptoScriptHash_,
  Pyth_price_pyth_price_publish,
  Pyth_price_pyth_price_withdraw,
  Pyth_state_init_mint,
  Pyth_state_update_spend,
  PythPyth,
  Wormhole_state_init_mint,
  Wormhole_state_update_spend,
  WormholeVaaPreparedVAA,
} from "./offchain.js";
import {
  MintingValidator,
  PublishingValidator,
  SpendingValidator,
  utxoToOutRef,
  WithdrawingValidator,
} from "./utils.js";
import type {
  PreparedGovernanceAction,
  PreparedGuardianSetUpgrade,
  PreparedVAA,
} from "./wormhole.js";

const WH_STATE_NFT = AssetName.fromBytes(Buffer.from("Pyth Wormhole", "utf-8"));
const WH_OWNER_NFT = AssetName.fromBytes(
  Buffer.from("Pyth Wormhole Ops", "utf-8"),
);

const wormholeStateMint = MintingValidator.new(Wormhole_state_init_mint);
const wormholeStateSpend = SpendingValidator.new(Wormhole_state_update_spend);

export async function initWormholeState(
  ctx: ClientContext,
  origin: UTxO.UTxO,
  initialGuardian: string,
): Promise<{ policy: PolicyId.PolicyId; tx: SigningTransactionBuilder }> {
  const spender = wormholeStateSpend.script();
  const minter = wormholeStateMint.script(
    utxoToOutRef(origin),
    spender.hash.hash,
  );
  const stateNFT = minter.asset(WH_STATE_NFT, 1n);
  const ownerNFT = minter.asset(WH_OWNER_NFT, 1n);
  const state = spender.receive(ctx, stateNFT, {
    set: [Buffer.from(initialGuardian, "hex")],
    set_index: 0n,
  });

  return {
    policy: PolicyId.fromBytes(minter.hash.hash),
    tx: ctx.client
      .newTx()
      .collectFrom({ inputs: [origin] })
      .attachScript(minter)
      .mintAssets(
        wormholeStateMint.mint(Assets.merge(stateNFT, ownerNFT), "Never"),
      )
      .payToAddress(state)
      .payToAddress(await ctx.payToMe(ownerNFT)),
  };
}

export async function applyGuardianSetUpgrade(
  ctx: ClientContext,
  policy: string,
  upgrade: PreparedGuardianSetUpgrade,
) {
  const state = await ctx.getNftUtxo(policy, WH_STATE_NFT);

  const { input } = wormholeStateSpend.spend([state], upgrade.vaa);
  const spender = wormholeStateSpend.script();

  return ctx.client
    .newTx()
    .collectFrom(input)
    .payToAddress(
      spender.receive(ctx, state.assets, {
        set: upgrade.set.map((g) => Buffer.from(g.replace(/^0x/, ""), "hex")),
        set_index: BigInt(upgrade.index),
      }),
    );
}

const PYTH_STATE_NFT = AssetName.fromBytes(Buffer.from("Pyth State", "utf-8"));
const PYTH_OWNER_NFT = AssetName.fromBytes(Buffer.from("Pyth Ops", "utf-8"));

const pythStateMint = MintingValidator.new(Pyth_state_init_mint);
const pythStateSpend = SpendingValidator.new(Pyth_state_update_spend);

export async function initPythState(
  ctx: ClientContext,
  origin: UTxO.UTxO,
  initial: {
    wormhole: Uint8Array;
    emitter_chain: bigint;
    emitter_address: Uint8Array;
  },
): Promise<{ policy: PolicyId.PolicyId; tx: SigningTransactionBuilder }> {
  const spender = pythStateSpend.script();
  const minter = pythStateMint.script(utxoToOutRef(origin), spender.hash.hash);
  const publisher = pythPricePublish.script(minter.hash.hash);
  const withdrawer = pythPriceWithdraw.script(minter.hash.hash);

  const stateNFT = minter.asset(PYTH_STATE_NFT, 1n);
  const ownerNFT = minter.asset(PYTH_OWNER_NFT, 1n);
  const state = spender.receive(ctx, stateNFT, {
    deprecated_withdraw_scripts: new Map(),
    governance: { ...initial, seen_sequence: 0n },
    trusted_signers: new Map(),
    withdraw_script: withdrawer.hash.hash,
  });

  return {
    policy: PolicyId.fromBytes(minter.hash.hash),
    tx: ctx.client
      .newTx()
      .collectFrom({ inputs: [origin] })
      .attachScript(minter)
      .attachScript(publisher)
      .mintAssets(pythStateMint.mint(Assets.merge(stateNFT, ownerNFT), "Never"))
      .payToAddress({ ...state, script: withdrawer.script })
      .payToAddress(await ctx.payToMe(ownerNFT))
      .registerStake(publisher.publish("Never")),
  };
}

export async function applyGovernanceAction(
  ctx: ClientContext,
  whPolicy: string,
  policy: string,
  action: PreparedGovernanceAction,
  env?: "preprod" | "preview",
) {
  const guardians = await ctx.getNftUtxo(whPolicy, WH_STATE_NFT);
  const state = await ctx.getNftUtxo(policy, PYTH_STATE_NFT);

  const {
    input,
    datums: [oldState],
  } = pythStateSpend.spend([state], {
    _tag: "GovernanceAction",
    governanceAction: action.vaa,
  });

  if (guardians.datumOption?._tag !== "InlineDatum") {
    throw new Error("invalid Guardians datum");
  }

  const spender = pythStateSpend.script();
  const withdrawer = pythPriceWithdraw.script(Buffer.from(policy, "hex"));
  const { data } = await executeGovernanceAction(
    {
      data: oldState,
      home: spender.hash.hash,
      reference_script: oldState.withdraw_script,
    },
    action.vaa,
    guardians.datumOption.data,
    env,
  );
  const newState = spender.receive(ctx, state.assets, data);

  return ctx.client
    .newTx()
    .attachScript(spender)
    .readFrom({ referenceInputs: [guardians] })
    .collectFrom(input)
    .payToAddress({ ...newState, script: withdrawer.script });
}

const StatePyth =
  // biome-ignore assist/source/useSortedKeys: order-sensitive
  TSchema.Struct({
    home: ByteArray,
    data: PythPyth,
    reference_script: TSchema.NullOr(ByteArray),
  });

async function executeGovernanceAction(
  state: (typeof StatePyth)["Type"],
  action: PreparedVAA,
  guardians: Data.Data,
  env?: "preprod" | "preview",
): Promise<(typeof StatePyth)["Type"]> {
  const newState = await aikenEval(
    path.resolve(import.meta.dirname, "../../../"),
    "pyth_state",
    "execute_governance_action",
    [
      Schema.encodeSync(StatePyth)(state),
      Schema.encodeSync(WormholeVaaPreparedVAA)(action),
      guardians,
    ],
    env ? { env } : undefined,
  );
  if (!(newState instanceof Data.Constr)) {
    throw new Error("expected State Constr");
  }
  return Schema.decodeSync(StatePyth)(newState);
}

const pythPricePublish = PublishingValidator.new(Pyth_price_pyth_price_publish);
const pythPriceWithdraw = WithdrawingValidator.new(
  Pyth_price_pyth_price_withdraw,
);

export function withdrawScriptHash(policy: string) {
  return pythPriceWithdraw.script(Buffer.from(policy, "hex")).hash;
}

export async function verifyPrices(
  ctx: ClientContext,
  policy: string,
  updates: Uint8Array[],
) {
  const withdrawer = pythPriceWithdraw.script(Buffer.from(policy, "hex"));
  const state = await ctx.getNftUtxo(policy, PYTH_STATE_NFT);

  const now = BigInt(Date.now());
  return (
    ctx.client
      .newTx()
      // without validity set, Evolution seems to default to no bounds
      .setValidity({ from: now, to: now + 60_000n })
      .readFrom({ referenceInputs: [state] })
      .withdraw(withdrawer.withdraw(0n, updates))
  );
}

export async function purgeExpiredPythWithdrawScripts(
  ctx: ClientContext,
  whPolicy: string,
  policy: string,
) {
  const guardians = await ctx.getNftUtxo(whPolicy, WH_STATE_NFT);
  const state = await ctx.getNftUtxo(policy, PYTH_STATE_NFT);
  const owner = await ctx.getNftUtxo(policy, PYTH_OWNER_NFT);

  const {
    input,
    datums: [oldState],
  } = pythStateSpend.spend([state], {
    _tag: "PurgeExpiredWithdrawScripts",
  });

  const from = BigInt(Date.now());
  const validityRange = { from, to: from + 300_000n };

  const spender = pythStateSpend.script();
  const newScripts = await purgeExpiredScripts(
    oldState.deprecated_withdraw_scripts,
    {
      lower_bound: {
        bound_type: { _tag: "Finite", finite: validityRange.from },
        is_inclusive: true,
      },
      upper_bound: {
        bound_type: { _tag: "Finite", finite: validityRange.to },
        is_inclusive: true,
      },
    },
  );
  const newState = spender.receive(ctx, state.assets, {
    ...oldState,
    deprecated_withdraw_scripts: newScripts,
  });

  return ctx.client
    .newTx()
    .setValidity(validityRange)
    .attachScript(spender)
    .readFrom({ referenceInputs: [guardians] })
    .collectFrom({ ...input, inputs: [...input.inputs, owner] })
    .payToAddress(newState)
    .payToAddress(
      await ctx.payToMe(
        Assets.fromAsset(PolicyId.fromHex(policy), PYTH_OWNER_NFT, 1n),
      ),
    );
}

type ValidityRange = Schema.Schema.Type<typeof CardanoTransactionValidityRange>;

async function purgeExpiredScripts(
  scripts: Map<ValidityRange, Uint8Array>,
  interval: ValidityRange,
): Promise<Map<ValidityRange, Uint8Array>> {
  const newScripts = await aikenEval(
    path.resolve(import.meta.dirname, "../../../"),
    "pyth_state",
    "purge_expired_scripts",
    [
      Schema.encodeSync(
        Pairs_cardanoTransactionValidityRange_aikenCryptoScriptHash_,
      )(scripts),
      Schema.encodeSync(CardanoTransactionValidityRange)(interval),
    ],
  );
  if (!(newScripts instanceof Map)) {
    throw new TypeError("expected Data Map");
  }
  return Schema.decodeSync(
    Pairs_cardanoTransactionValidityRange_aikenCryptoScriptHash_,
  )(newScripts);
}
