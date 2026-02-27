/** biome-ignore-all lint/suspicious/noExplicitAny: `I` in `Schema<A, I>` is
 * invariant, so putting `Data` there results in errors when trying to match
 * individual types in `Data` union againts each other. Our goal is mainly to
 * type user-facing validator methods, which don't care about encoded type, so
 * using `any` there only affects code in this file.
 *
 * In other places with `any`, we are simply accepting any type as `A`.
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  AssetName,
  Cardano,
  Data,
  DatumOption,
  SigningClient,
  TransactionHash,
  UTxO,
} from "@evolution-sdk/evolution";
import {
  Address,
  Assets,
  CBOR,
  Effect,
  Either,
  InlineDatum,
  PolicyId,
  Schema,
  ScriptHash,
  UPLC,
} from "@evolution-sdk/evolution";
import { PlutusV3 } from "@evolution-sdk/evolution/Cardano";
import type { OutputReference } from "@evolution-sdk/evolution/plutus";
import type {
  CollectFromParams,
  MintTokensParams,
  PayToAddressParams,
} from "@evolution-sdk/evolution/sdk/builders/operations/Operations";
import type { IndexedInput } from "@evolution-sdk/evolution/sdk/builders/RedeemerBuilder";
import type {
  SigningTransactionBuilder,
  ProtocolParameters as TransactionProtocolParameters,
} from "@evolution-sdk/evolution/sdk/builders/TransactionBuilder";
import { calculateMinimumUtxoLovelace } from "@evolution-sdk/evolution/sdk/builders/TxBuilderImpl";
import type { NetworkId } from "@evolution-sdk/evolution/sdk/client/Client";
import type { ProtocolParameters } from "@evolution-sdk/evolution/sdk/provider/Provider";

export const execFileAsync = promisify(execFile);

export async function withTempFile<T>(
  src: string | Uint8Array,
  f: (path: string) => Promise<T>,
): Promise<T> {
  const dir = await fs.mkdtemp("temp_file");
  try {
    const file = path.resolve(dir, "file.txt");
    await fs.writeFile(file, src);
    const res = await f(file);
    return res;
  } finally {
    await fs.rm(dir, { recursive: true });
  }
}

// Margins added to fees to make transactions pass in practice.
const FEE_MARGIN_A = 1;
const FEE_MARGIN_B = 1_000_000n;

export const prepareProtocolParams = (
  params: ProtocolParameters,
): TransactionProtocolParameters => {
  return {
    coinsPerUtxoByte: params.coinsPerUtxoByte,
    maxTxSize: params.maxTxSize,
    minFeeCoefficient: BigInt(params.minFeeA * FEE_MARGIN_A),
    minFeeConstant: BigInt(params.minFeeB) + FEE_MARGIN_B,
    priceMem: params.priceMem,
    priceStep: params.priceStep,
  };
};

export const plutusV3FromAiken = (compiledCode: string) => {
  const decoded = UPLC.decodeDoubleCborHexToFlat(compiledCode);
  const bytes = CBOR.toCBORBytes(decoded);
  return new PlutusV3.PlutusV3({ bytes });
};

export type TransactionContext = {
  client: SigningClient;
  parameters: TransactionParameters;
};

export const newTxCtx = async (
  client: SigningClient,
  networkId: TransactionParameters["networkId"],
): Promise<TransactionContext> => ({
  client,
  parameters: { ...(await client.getProtocolParameters()), networkId },
});

export async function getOriginUtxo(client: SigningClient) {
  const [origin] = await client.getWalletUtxos();
  if (!origin) {
    throw new Error("No UTxO to use as origin");
  }
  return origin;
}

type TransactionParameters = ProtocolParameters & {
  networkId: NetworkId | "custom";
};

const calculateFee = (
  {
    script,
    ...args
  }: {
    address: Address.Address;
    assets: Assets.Assets;
    datum?: DatumOption.DatumOption;
    script?: Cardano.Script.Script;
  },
  { coinsPerUtxoByte }: { coinsPerUtxoByte: bigint },
): bigint =>
  Effect.runSync(
    calculateMinimumUtxoLovelace({
      ...args,
      coinsPerUtxoByte,
      ...(script ? { scriptRef: script } : {}),
    }),
    // TODO: this is trial and error
    // - we need more principled way to calculate fees
  ) + FEE_MARGIN_B;

export const utxoToOutRef = (
  utxo: UTxO.UTxO,
): OutputReference.OutputReference => ({
  output_index: utxo.index,
  transaction_id: utxo.transactionId.hash,
});

export async function toMe(
  ctx: TransactionContext,
  assets: Assets.Assets,
): Promise<PayToAddressParams> {
  const address = await ctx.client.address();
  const payment = { address, assets };
  payment.assets = Assets.addLovelace(
    payment.assets,
    calculateFee(payment, ctx.parameters),
  );
  return payment;
}

export async function runTx(
  ctx: TransactionContext,
  tx: SigningTransactionBuilder,
): Promise<TransactionHash.TransactionHash> {
  const digest = await Either.getOrThrowWith(
    await tx.buildEither({
      debug: true,
      protocolParameters: prepareProtocolParams(ctx.parameters),
    }),
    (e) => JSON.stringify(e, undefined, 2),
  ).signAndSubmit();
  await ctx.client.awaitTx(digest);
  return digest;
}

type RedeemerArg<T> = T | ((input: IndexedInput) => T);
type DataSchema<T> = Schema.Schema<T, any>;
type WithSchema<T> = ReturnType<typeof Data.withSchema<T, any>>;
type PlutusOrWithSchema<T> = T extends Data.Data
  ? Data.DataSchema
  : WithSchema<T>;
type DataSchemas<Params extends readonly any[]> = {
  readonly [I in keyof Params]: DataSchema<Params[I]>;
};
type SchemaTypes<Schemas extends readonly Schema.Schema<any, any>[]> = {
  readonly [I in keyof Schemas]: Schemas[I]["Type"];
};
type ReplaceItems<Items extends readonly any[], T> = {
  readonly [_ in keyof Items]: T;
};

function applyPlutusOrWithSchema<T>(
  schema: PlutusOrWithSchema<T>,
  data: T,
): Data.Data {
  if ("toData" in schema) {
    return schema.toData(data);
  } else {
    return data as Data.Data;
  }
}

function deapplyPlutusOrWithSchema<T>(
  schema: PlutusOrWithSchema<T>,
  data: Data.Data,
): T {
  if ("fromData" in schema) {
    return schema.fromData(data);
  } else {
    return data as T;
  }
}

function applyRedeemerSchema<T>(
  schema: PlutusOrWithSchema<T>,
  redeemer: RedeemerArg<T>,
): RedeemerArg<Data.Data> {
  if (redeemer instanceof Function) {
    return (input) => applyPlutusOrWithSchema(schema, redeemer(input));
  } else {
    return applyPlutusOrWithSchema(schema, redeemer);
  }
}

function applyParamsWithSchemasToScript<Params extends readonly any[]>(
  schemas: DataSchemas<Params>,
  compiledCode: string,
  args: Params,
): string {
  const datas = schemas.map((schema, i) => Schema.encodeSync(schema)(args[i]));
  return UPLC.applyParamsToScript(compiledCode, datas);
}

export type Script = {
  script: Cardano.Script.Script;
  hash: ScriptHash.ScriptHash;
};

type ValidatorBlueprint<Params extends readonly any[], Redeemer> = {
  readonly title: string;
  readonly hash: string;
  readonly compiledCode: string;
  readonly parameters?: DataSchemas<Params>;
  readonly redeemer: PlutusOrWithSchema<Redeemer>;
};

type ValidatorParameters<B extends ValidatorBlueprint<any[], any>> =
  B["parameters"] extends readonly any[] ? SchemaTypes<B["parameters"]> : [];
type ValidatorRedeemer<B extends ValidatorBlueprint<any[], any>> =
  B["redeemer"] extends { fromData: (..._: any[]) => infer A } ? A : Data.Data;
type ValidatorDatum<B extends SpendingValidatorBlueprint<any[], any, any>> =
  B["datum"] extends { fromData: (..._: any[]) => infer A } ? A : Data.Data;

abstract class Validator<Params extends readonly any[], Redeemer> {
  protected constructor(
    protected readonly blueprint: ValidatorBlueprint<Params, Redeemer>,
  ) {}

  protected applyScript(params: Params): Script {
    const compiledCode = this.blueprint.parameters
      ? applyParamsWithSchemasToScript(
          this.blueprint.parameters,
          this.blueprint.compiledCode,
          params,
        )
      : this.blueprint.compiledCode;
    const script = plutusV3FromAiken(compiledCode);
    return {
      hash: ScriptHash.fromScript(script),
      script,
    };
  }

  abstract script(...args: Params): Script;
}

type MintingScript = Script & {
  asset: (name: AssetName.AssetName, quantity: bigint) => Assets.Assets;
};

export type MintingValidatorBlueprint<
  Params extends readonly any[],
  Redeemer,
> = ValidatorBlueprint<Params, Redeemer> & {
  readonly title: `${string}.mint`;
};

export class MintingValidator<
  Params extends readonly any[],
  Redeemer,
> extends Validator<Params, Redeemer> {
  private constructor(
    protected override readonly blueprint: MintingValidatorBlueprint<
      Params,
      Redeemer
    >,
  ) {
    super(blueprint);
  }

  static new<const B extends MintingValidatorBlueprint<any, any>>(
    blueprint: B,
  ): MintingValidator<ValidatorParameters<B>, ValidatorRedeemer<B>> {
    return new MintingValidator(
      blueprint as MintingValidatorBlueprint<
        ValidatorParameters<B>,
        ValidatorRedeemer<B>
      >,
    );
  }

  script(...params: Params): MintingScript {
    const { script, hash } = this.applyScript(params);
    return {
      asset: (name, quantity) =>
        Assets.fromAsset(new PolicyId.PolicyId(hash), name, quantity),
      hash,
      script,
    };
  }

  mint(assets: Assets.Assets, redeemer: Redeemer): MintTokensParams {
    return {
      assets,
      redeemer: applyRedeemerSchema(this.blueprint.redeemer, redeemer),
    };
  }
}

export type SpendingValidatorBlueprint<
  Params extends readonly any[],
  Redeemer,
  Datum,
> = ValidatorBlueprint<Params, Redeemer> & {
  readonly title: `${string}.spend`;
  readonly datum: PlutusOrWithSchema<Datum>;
};

type SpendingScript<Datum> = Script & {
  receive: (
    parameters: TransactionParameters,
    assets: Assets.Assets,
    datum: Datum,
  ) => PayToAddressParams;
};

type SpendResults<Datums extends readonly any[]> = {
  input: CollectFromParams;
  datums: Datums;
};

export class SpendingValidator<
  Params extends readonly any[],
  Redeemer,
  Datum,
> extends Validator<Params, Redeemer> {
  private constructor(
    protected override readonly blueprint: SpendingValidatorBlueprint<
      Params,
      Redeemer,
      Datum
    >,
  ) {
    super(blueprint);
  }

  static new<const B extends SpendingValidatorBlueprint<any, any, any>>(
    blueprint: B,
  ): SpendingValidator<
    ValidatorParameters<B>,
    ValidatorRedeemer<B>,
    ValidatorDatum<B>
  > {
    return new SpendingValidator(
      blueprint as unknown as SpendingValidatorBlueprint<
        ValidatorParameters<B>,
        ValidatorRedeemer<B>,
        ValidatorDatum<B>
      >,
    );
  }

  script(...params: Params): SpendingScript<Datum> {
    const { script, hash } = this.applyScript(params);
    return {
      hash,
      receive: (parameters, assets, datumValue) => {
        const payment = {
          address: new Address.Address({
            networkId: parameters.networkId === "mainnet" ? 1 : 0,
            paymentCredential: hash,
          }),
          assets,
          datum: new InlineDatum.InlineDatum({
            data: applyPlutusOrWithSchema(this.blueprint.datum, datumValue),
          }),
          script,
        };
        payment.assets = Assets.addLovelace(
          payment.assets,
          calculateFee(payment, parameters),
        );
        return payment;
      },
      script,
    };
  }

  spend<const Inputs extends readonly UTxO.UTxO[]>(
    inputs: Inputs,
    redeemer: RedeemerArg<Redeemer>,
  ): SpendResults<ReplaceItems<Inputs, Datum>> {
    return {
      datums: inputs.map(({ datumOption }) => {
        if (!(datumOption instanceof InlineDatum.InlineDatum)) {
          throw new Error(
            "SpendingValidator.spend only supports inline inputs",
          );
        }
        return deapplyPlutusOrWithSchema(
          this.blueprint.datum,
          datumOption.data,
        );
      }) as ReplaceItems<Inputs, Datum>,
      input: {
        inputs,
        redeemer: applyRedeemerSchema(this.blueprint.redeemer, redeemer),
      },
    };
  }
}
