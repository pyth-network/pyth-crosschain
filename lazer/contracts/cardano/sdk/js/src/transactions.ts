import type { UTxO } from "@evolution-sdk/evolution";
import { AssetName, Assets, PolicyId } from "@evolution-sdk/evolution";
import {
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

const WH_STATE_NFT = AssetName.fromBytes(Buffer.from("Pyth Wormhole", "utf-8"));
const WH_OWNER_NFT = AssetName.fromBytes(
  Buffer.from("Pyth Wormhole Ops", "utf-8"),
);

const wormholeStateMint = MintingValidator.new(Wormhole_state_init_mint);
const wormholeStateSpend = SpendingValidator.new(Wormhole_state_update_spend);

export async function initWormholeState(
  ctx: TransactionContext,
  origin: UTxO.UTxO,
) {
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
          : "13947Bd48b18E53fdAeEe77F3473391aC727C638",
        "hex",
      ),
    ],
    set_index: 0n,
  });

  return {
    policy_id: PolicyId.fromBytes(minter.hash.hash),
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
) {
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
    policy_id: PolicyId.fromBytes(minter.hash.hash),
    tx: ctx.client
      .newTx()
      .attachScript(minter)
      .mintAssets(pythStateMint.mint(Assets.merge(stateNFT, ownerNFT), "Never"))
      .payToAddress(state)
      .payToAddress(await toMe(ctx, ownerNFT)),
  };
}
