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
import type { AssetName, Cardano, Data, UTxO } from "@evolution-sdk/evolution";
import {
  Assets,
  CBOR,
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
  RegisterStakeParams,
  WithdrawParams,
} from "@evolution-sdk/evolution/sdk/builders/operations/Operations";
import type { IndexedInput } from "@evolution-sdk/evolution/sdk/builders/RedeemerBuilder";
import type { ClientContext } from "./client";

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

export const plutusV3FromAiken = (compiledCode: string) => {
  const decoded = UPLC.decodeDoubleCborHexToFlat(compiledCode);
  const bytes = CBOR.toCBORBytes(decoded);
  return new PlutusV3.PlutusV3({ bytes });
};

export const utxoToOutRef = (
  utxo: UTxO.UTxO,
): OutputReference.OutputReference => ({
  output_index: utxo.index,
  transaction_id: utxo.transactionId.hash,
});

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
    ctx: ClientContext,
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
      receive: (ctx, assets, datumValue) => {
        const payment = {
          address: ctx.newAddress(hash),
          assets,
          datum: new InlineDatum.InlineDatum({
            data: applyPlutusOrWithSchema(this.blueprint.datum, datumValue),
          }),
          script,
        };
        payment.assets = ctx.assetsWithFee(payment);
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

export type PublishingValidatorBlueprint<
  Params extends readonly any[],
  Redeemer,
> = ValidatorBlueprint<Params, Redeemer> & {
  readonly title: `${string}.publish`;
};

export type PublishingScript<Redeemer> = Script & {
  publish(redeemer: Redeemer): RegisterStakeParams;
};

export class PublishingValidator<
  Params extends readonly any[],
  Redeemer,
> extends Validator<Params, Redeemer> {
  private constructor(
    protected override readonly blueprint: PublishingValidatorBlueprint<
      Params,
      Redeemer
    >,
  ) {
    super(blueprint);
  }

  static new<const B extends PublishingValidatorBlueprint<any, any>>(
    blueprint: B,
  ): PublishingValidator<ValidatorParameters<B>, ValidatorRedeemer<B>> {
    return new PublishingValidator(
      blueprint as unknown as PublishingValidatorBlueprint<
        ValidatorParameters<B>,
        ValidatorRedeemer<B>
      >,
    );
  }

  script(...params: Params): PublishingScript<Redeemer> {
    const { script, hash } = this.applyScript(params);
    return {
      hash,
      publish: (redeemer) => {
        return {
          redeemer: applyRedeemerSchema(this.blueprint.redeemer, redeemer),
          stakeCredential: hash,
        };
      },
      script,
    };
  }
}

export type WithdrawingValidatorBlueprint<
  Params extends readonly any[],
  Redeemer,
> = ValidatorBlueprint<Params, Redeemer> & {
  readonly title: `${string}.withdraw`;
};

export type WithdrawingScript<Redeemer> = Script & {
  withdraw(amount: bigint, redeemer: Redeemer): WithdrawParams;
};

export class WithdrawingValidator<
  Params extends readonly any[],
  Redeemer,
> extends Validator<Params, Redeemer> {
  private constructor(
    protected override readonly blueprint: WithdrawingValidatorBlueprint<
      Params,
      Redeemer
    >,
  ) {
    super(blueprint);
  }

  static new<const B extends WithdrawingValidatorBlueprint<any, any>>(
    blueprint: B,
  ): WithdrawingValidator<ValidatorParameters<B>, ValidatorRedeemer<B>> {
    return new WithdrawingValidator(
      blueprint as unknown as WithdrawingValidatorBlueprint<
        ValidatorParameters<B>,
        ValidatorRedeemer<B>
      >,
    );
  }

  script(...params: Params): WithdrawingScript<Redeemer> {
    const { script, hash } = this.applyScript(params);
    return {
      hash,
      script,
      withdraw: (amount, redeemer) => {
        return {
          amount,
          redeemer: applyRedeemerSchema(this.blueprint.redeemer, redeemer),
          stakeCredential: hash,
        };
      },
    };
  }
}
