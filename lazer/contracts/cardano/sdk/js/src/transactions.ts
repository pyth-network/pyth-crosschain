import path from "node:path";
import {
  AssetName,
  Assets,
  Data,
  PolicyId,
  Schema,
  ScriptHash,
  TSchema,
} from "@evolution-sdk/evolution";
import type { SigningTransactionBuilder } from "@evolution-sdk/evolution/sdk/builders/TransactionBuilder";
import { UpgradeCardanoSpendScript } from "@pythnetwork/xc-admin-common";
import { ClientContext } from "./client.js";
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
  initialGuardian: string,
): Promise<[SigningTransactionBuilder, PolicyId.PolicyId]> {
  const origin = await ctx.getFreshUtxo();
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

  return [
    ctx.client
      .newTx()
      .collectFrom({ inputs: [origin] })
      .attachScript(minter)
      .mintAssets(
        wormholeStateMint.mint(Assets.merge(stateNFT, ownerNFT), "Never"),
      )
      .payToAddress(state)
      .payToAddress(await ctx.payToMe(ownerNFT)),
    PolicyId.fromBytes(minter.hash.hash),
  ];
}

export async function applyGuardianSetUpgrade(
  ctx: ClientContext,
  policy: string,
  upgrade: PreparedGuardianSetUpgrade,
): Promise<[SigningTransactionBuilder]> {
  const spender = wormholeStateSpend.script();

  const state = await ctx.getNftUtxo(policy, WH_STATE_NFT);
  const { input } = wormholeStateSpend.spend([state], upgrade.vaa);

  return [
    ctx.client
      .newTx()
      .collectFrom(input)
      .payToAddress(
        spender.receive(ctx, state.assets, {
          set: upgrade.set.map((g) => Buffer.from(g.replace(/^0x/, ""), "hex")),
          set_index: BigInt(upgrade.index),
        }),
      ),
  ];
}

const PYTH_STATE_NFT = AssetName.fromBytes(Buffer.from("Pyth State", "utf-8"));
const PYTH_OWNER_NFT = AssetName.fromBytes(Buffer.from("Pyth Ops", "utf-8"));

const pythStateMint = MintingValidator.new(Pyth_state_init_mint);
const pythStateSpend = SpendingValidator.new(Pyth_state_update_spend);

export const spendScriptHash = () => pythStateSpend.script().hash;

export async function initPythState(
  ctx: ClientContext,
  initial: {
    wormhole: Uint8Array;
    emitter_chain: bigint;
    emitter_address: Uint8Array;
  },
): Promise<[SigningTransactionBuilder, PolicyId.PolicyId]> {
  const origin = await ctx.getFreshUtxo();
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

  return [
    ctx.client
      .newTx()
      .collectFrom({ inputs: [origin] })
      .attachScript(minter)
      .attachScript(publisher)
      .mintAssets(pythStateMint.mint(Assets.merge(stateNFT, ownerNFT), "Never"))
      .payToAddress({ ...state, script: withdrawer.script })
      .payToAddress(await ctx.payToMe(ownerNFT))
      .registerStake(publisher.publish("Never")),
    PolicyId.fromBytes(minter.hash.hash),
  ];
}

export async function applyGovernanceAction(
  ctx: ClientContext,
  policy: string,
  action: PreparedGovernanceAction,
  env?: "preprod" | "preview",
): Promise<[SigningTransactionBuilder]> {
  const state = await ctx.getNftUtxo(policy, PYTH_STATE_NFT);

  const {
    input,
    datums: [oldState],
  } = pythStateSpend.spend([state], {
    _tag: "GovernanceAction",
    governanceAction: action.vaa,
  });

  const guardians = await ctx.getNftUtxo(
    Buffer.from(oldState.governance.wormhole).toString("hex"),
    WH_STATE_NFT,
  );

  const spender = pythStateSpend.script();
  const withdrawer = pythPriceWithdraw.script(Buffer.from(policy, "hex"));
  const { data } = await executeGovernanceAction(
    {
      data: oldState,
      home: spender.hash.hash,
      reference_script: oldState.withdraw_script,
    },
    action.vaa,
    ClientContext.readUtxo(guardians),
    env,
  );
  const newState = spender.receive(ctx, state.assets, data);

  return [
    ctx.client
      .newTx()
      .attachScript(spender)
      .readFrom({ referenceInputs: [guardians] })
      .collectFrom(input)
      .payToAddress({
        ...newState,
        address:
          action.action instanceof UpgradeCardanoSpendScript
            ? ctx.newAddress(ScriptHash.fromHex(action.action.hash))
            : newState.address,
        script: withdrawer.script,
      }),
  ];
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

export async function verifyUpdates(
  ctx: ClientContext,
  policy: string,
  updates: Uint8Array[],
): Promise<[SigningTransactionBuilder]> {
  const withdrawer = pythPriceWithdraw.script(Buffer.from(policy, "hex"));
  const state = await ctx.getNftUtxo(policy, PYTH_STATE_NFT);

  const now = BigInt(Date.now());
  return [
    ctx.client
      .newTx()
      // without validity set, Evolution SDK seems to default to no bounds
      // TODO: why are we out of sync with server slots?
      .setValidity({ from: now - 100_000n, to: now + 300_000n })
      .readFrom({ referenceInputs: [state] })
      .withdraw(withdrawer.withdraw(0n, updates)),
  ];
}

export async function purgeExpiredPythWithdrawScripts(
  ctx: ClientContext,
  policy: string,
): Promise<[SigningTransactionBuilder]> {
  const state = await ctx.getNftUtxo(policy, PYTH_STATE_NFT);
  const owner = await ctx.getNftUtxo(policy, PYTH_OWNER_NFT);

  const {
    input,
    datums: [oldState],
  } = pythStateSpend.spend([state], {
    _tag: "PurgeExpiredWithdrawScripts",
  });

  const guardians = await ctx.getNftUtxo(
    Buffer.from(oldState.governance.wormhole).toString("hex"),
    WH_STATE_NFT,
  );

  const now = BigInt(Date.now());
  const validityRange = { from: now - 10_000n, to: now + 300_000n };

  const spender = pythStateSpend.script();
  const withdrawer = pythPriceWithdraw.script(Buffer.from(policy, "hex"));

  const newScripts = await purgeExpiredScripts(
    oldState.deprecated_withdraw_scripts,
    interval(validityRange),
  );
  const newState = spender.receive(ctx, state.assets, {
    ...oldState,
    deprecated_withdraw_scripts: newScripts,
  });

  return [
    ctx.client
      .newTx()
      .setValidity(validityRange)
      .attachScript(spender)
      .readFrom({ referenceInputs: [guardians] })
      .collectFrom({ inputs: [owner] })
      .collectFrom(input)
      .payToAddress({ ...newState, script: withdrawer.script })
      .payToAddress(
        await ctx.payToMe(
          Assets.fromAsset(PolicyId.fromHex(policy), PYTH_OWNER_NFT, 1n),
        ),
      ),
  ];
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

const interval = (range: { from?: bigint; to?: bigint }): ValidityRange => ({
  lower_bound:
    "from" in range
      ? {
          bound_type: { _tag: "Finite", finite: range.from },
          is_inclusive: true,
        }
      : {
          bound_type: { _tag: "NegativeInfinity" },
          is_inclusive: false,
        },
  upper_bound:
    "to" in range
      ? {
          bound_type: { _tag: "Finite", finite: range.to },
          is_inclusive: true,
        }
      : {
          bound_type: { _tag: "PositiveInfinity" },
          is_inclusive: false,
        },
});
