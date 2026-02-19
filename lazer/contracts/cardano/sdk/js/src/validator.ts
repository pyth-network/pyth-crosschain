/** biome-ignore-all lint/suspicious/noExplicitAny: `I` in `Schema<A, I>` is
 * invariant, so putting `Data` there results in errors when trying to match
 * individual types in `Data` union againts each other. Our goal is mainly to
 * type user-facing validator methods, which don't care about encoded type, so
 * using `any` there only affects code in this file.
 *
 * In other places with `any`, we are simply accepting any type as `A`.
 */
import type { Data, ScriptHash, UTxO } from "@evolution-sdk/evolution";
import {
  Address,
  Bytes,
  Cardano,
  InlineDatum,
  PolicyId,
  Schema,
  UPLC,
} from "@evolution-sdk/evolution";
import type {
  CollectFromParams,
  MintTokensParams,
  PayToAddressParams,
} from "@evolution-sdk/evolution/sdk/builders/operations/Operations";
import type { IndexedInput } from "@evolution-sdk/evolution/sdk/builders/RedeemerBuilder";

// TODO: env/param?
const NETWORK_ID: 0 | 1 = 0;

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
    const script = new Cardano.PlutusV3.PlutusV3({
      bytes: Bytes.fromHex(compiledCode),
    });
    return {
      hash: Cardano.ScriptHash.fromScript(script),
      script,
    };
  }

  abstract script(...args: Params): Script;
}

type MintingScript = Script & {
  asset: (
    name: Cardano.AssetName.AssetName,
    quantity: bigint,
  ) => Cardano.Assets.Assets;
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
        Cardano.Assets.fromAsset(new PolicyId.PolicyId(hash), name, quantity),
      hash,
      script,
    };
  }

  mint(assets: Cardano.Assets.Assets, redeemer: Redeemer): MintTokensParams {
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
  receive: (assets: Cardano.Assets.Assets, datum: Datum) => PayToAddressParams;
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
      receive: (assets, datum) => ({
        address: new Address.Address({
          networkId: NETWORK_ID,
          paymentCredential: hash,
        }),
        assets,
        datum: new InlineDatum.InlineDatum({
          data: applyPlutusOrWithSchema(this.blueprint.datum, datum),
        }),
        script,
      }),
      script,
    };
  }

  spend(
    inputs: readonly UTxO.UTxO[],
    redeemer: RedeemerArg<Redeemer>,
  ): CollectFromParams {
    return {
      inputs,
      redeemer: applyRedeemerSchema(this.blueprint.redeemer, redeemer),
    };
  }
}
