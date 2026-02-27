import path from "node:path";
import type { UTxO } from "@evolution-sdk/evolution";
import { AssetName, Assets, PolicyId, Schema } from "@evolution-sdk/evolution";
import type { SigningTransactionBuilder } from "@evolution-sdk/evolution/sdk/builders/TransactionBuilder";
import { aikenEval } from "./eval.js";
import {
  CardanoTransactionValidityRange,
  Pairs_cardanoTransactionValidityRange_aikenCryptoScriptHash_,
  Pyth_state_init_mint,
  Pyth_state_update_spend,
  Wormhole_state_init_mint,
  Wormhole_state_update_spend,
} from "./offchain.js";
import type { TransactionContext } from "./utils.js";
import {
  MintingValidator,
  SpendingValidator,
  toMe,
  utxoToOutRef,
} from "./utils.js";
import type { PreparedGuardianSetUpgrade } from "./wormhole.js";

const WH_STATE_NFT = AssetName.fromBytes(Buffer.from("Pyth Wormhole", "utf-8"));
const WH_OWNER_NFT = AssetName.fromBytes(
  Buffer.from("Pyth Wormhole Ops", "utf-8"),
);

const wormholeStateMint = MintingValidator.new(Wormhole_state_init_mint);
const wormholeStateSpend = SpendingValidator.new(Wormhole_state_update_spend);

export async function initWormholeState(
  ctx: TransactionContext,
  origin: UTxO.UTxO,
): Promise<{ policy: PolicyId.PolicyId; tx: SigningTransactionBuilder }> {
  const spender = wormholeStateSpend.script();
  const minter = wormholeStateMint.script(
    utxoToOutRef(origin),
    spender.hash.hash,
  );
  const stateNFT = minter.asset(WH_STATE_NFT, 1n);
  const ownerNFT = minter.asset(WH_OWNER_NFT, 1n);
  const state = spender.receive(ctx.parameters, stateNFT, {
    seen_sequence: 0n,
    set: [
      Buffer.from(
        ctx.parameters.networkId === "mainnet"
          ? // see `env/default.ak`
            "58cc3ae5c097b213ce3c81979e1b9f9570746aa5"
          : "13947bd48b18e53fdaeee77f3473391ac727c638",
        "hex",
      ),
    ],
    set_index: 0n,
  });

  return {
    policy: PolicyId.fromBytes(minter.hash.hash),
    tx: ctx.client
      .newTx()
      .attachScript(minter)
      .mintAssets(
        wormholeStateMint.mint(Assets.merge(stateNFT, ownerNFT), "Never"),
      )
      .payToAddress(state)
      .payToAddress(await toMe(ctx, ownerNFT)),
  };
}

export async function applyGuardianSetUpgrade(
  ctx: TransactionContext,
  policy: string,
  upgrade: PreparedGuardianSetUpgrade,
) {
  const state = await ctx.client.getUtxoByUnit(
    policy + AssetName.toHex(WH_STATE_NFT),
  );

  const {
    input,
    datums: [oldState],
  } = wormholeStateSpend.spend([state], upgrade.vaa);
  const spender = wormholeStateSpend.script();

  return ctx.client
    .newTx()
    .collectFrom(input)
    .payToAddress(
      spender.receive(ctx.parameters, state.assets, {
        seen_sequence: oldState.seen_sequence + 1n,
        set: upgrade.guardians.map((g) =>
          Buffer.from(g.replace(/^0x/, ""), "hex"),
        ),
        set_index: BigInt(upgrade.index),
      }),
    );
}

const PYTH_STATE_NFT = AssetName.fromBytes(Buffer.from("Pyth State", "utf-8"));
const PYTH_OWNER_NFT = AssetName.fromBytes(Buffer.from("Pyth Ops", "utf-8"));

const pythStateMint = MintingValidator.new(Pyth_state_init_mint);
const pythStateSpend = SpendingValidator.new(Pyth_state_update_spend);

export async function initPythState(
  ctx: TransactionContext,
  origin: UTxO.UTxO,
  initial: {
    wormhole: Uint8Array;
    emitter_chain: bigint;
    emitter_address: Uint8Array;
  },
): Promise<{ policy: PolicyId.PolicyId; tx: SigningTransactionBuilder }> {
  const spender = pythStateSpend.script();
  const minter = pythStateMint.script(utxoToOutRef(origin), spender.hash.hash);
  const stateNFT = minter.asset(PYTH_STATE_NFT, 1n);
  const ownerNFT = minter.asset(PYTH_OWNER_NFT, 1n);
  const state = spender.receive(ctx.parameters, stateNFT, {
    deprecated_withdraw_scripts: new Map(),
    governance: { ...initial, seen_sequence: 0n },
    trusted_signers: new Map(),
    withdraw_script: new Uint8Array(),
  });

  return {
    policy: PolicyId.fromBytes(minter.hash.hash),
    tx: ctx.client
      .newTx()
      .attachScript(minter)
      .mintAssets(pythStateMint.mint(Assets.merge(stateNFT, ownerNFT), "Never"))
      .payToAddress(state)
      .payToAddress(await toMe(ctx, ownerNFT)),
  };
}

export async function purgeExpiredPythWithdrawScripts(
  ctx: TransactionContext,
  whPolicy: string,
  policy: string,
) {
  const guardians = await ctx.client.getUtxoByUnit(
    whPolicy + AssetName.toHex(WH_STATE_NFT),
  );
  const state = await ctx.client.getUtxoByUnit(
    policy + AssetName.toHex(PYTH_STATE_NFT),
  );
  const owner = await ctx.client.getUtxoByUnit(
    policy + AssetName.toHex(PYTH_OWNER_NFT),
  );

  const statePolicyID = Assets.flatten(state.assets)[0]?.[0];
  if (!statePolicyID) {
    throw new Error("Missing state policy ID");
  }
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
  const newState = spender.receive(ctx.parameters, state.assets, {
    ...oldState,
    deprecated_withdraw_scripts: newScripts,
  });

  return ctx.client
    .newTx()
    .setValidity(validityRange)
    .readFrom({ referenceInputs: [guardians] })
    .collectFrom({ ...input, inputs: [...input.inputs, owner] })
    .payToAddress(newState)
    .payToAddress(
      await toMe(
        ctx,
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
