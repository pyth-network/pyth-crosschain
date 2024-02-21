// To parse this data:
//
//   import { Convert, PriceUpdate } from "./file";
//
//   const priceUpdate = Convert.toPriceUpdate(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

/**
 * Represents a price update from Pyth publisher feeds.
 */
export interface PriceUpdate {
  binary: BinaryPriceUpdate;
  parsed?: ParsedPriceUpdate[];
  [property: string]: any;
}

export interface BinaryPriceUpdate {
  data: string[];
  encoding: EncodingType;
  [property: string]: any;
}

export enum EncodingType {
  Base64 = "base64",
  Hex = "hex",
}

export interface ParsedPriceUpdate {
  ema_price: RPCPrice;
  id: string;
  metadata: RPCPriceFeedMetadataV2;
  price: RPCPrice;
  [property: string]: any;
}

/**
 * A price with a degree of uncertainty at a certain time, represented as a price +- a
 * confidence
 * interval.
 *
 * The confidence interval roughly corresponds to the standard error of a normal
 * distribution.
 * Both the price and confidence are stored in a fixed-point numeric representation, `x *
 * 10^expo`, where `expo` is the exponent. For example:
 */
export interface RPCPrice {
  /**
   * The confidence interval associated with the price, stored as a string to avoid precision
   * loss
   */
  conf: string;
  /**
   * The exponent associated with both the price and confidence interval. Multiply those
   * values
   * by `10^expo` to get the real value.
   */
  expo: number;
  /**
   * The price itself, stored as a string to avoid precision loss
   */
  price: string;
  /**
   * When the price was published. The `publish_time` is a unix timestamp, i.e., the number of
   * seconds since the Unix epoch (00:00:00 UTC on 1 Jan 1970).
   */
  publish_time: number;
  [property: string]: any;
}

export interface RPCPriceFeedMetadataV2 {
  prev_publish_time?: number;
  proof_available_time?: number;
  slot?: number;
  [property: string]: any;
}

// Converts JSON types to/from your types
// and asserts the results at runtime
export class Convert {
  public static toPriceUpdate(json: any): PriceUpdate {
    return cast(json, r("PriceUpdate"));
  }

  public static priceUpdateToJson(value: PriceUpdate): any {
    return uncast(value, r("PriceUpdate"));
  }

  public static toBinaryPriceUpdate(json: any): BinaryPriceUpdate {
    return cast(json, r("BinaryPriceUpdate"));
  }

  public static binaryPriceUpdateToJson(value: BinaryPriceUpdate): any {
    return uncast(value, r("BinaryPriceUpdate"));
  }

  public static toParsedPriceUpdate(json: any): ParsedPriceUpdate {
    return cast(json, r("ParsedPriceUpdate"));
  }

  public static parsedPriceUpdateToJson(value: ParsedPriceUpdate): any {
    return uncast(value, r("ParsedPriceUpdate"));
  }

  public static toRPCPrice(json: any): RPCPrice {
    return cast(json, r("RPCPrice"));
  }

  public static rPCPriceToJson(value: RPCPrice): any {
    return uncast(value, r("RPCPrice"));
  }

  public static toRPCPriceFeedMetadataV2(json: any): RPCPriceFeedMetadataV2 {
    return cast(json, r("RPCPriceFeedMetadataV2"));
  }

  public static rPCPriceFeedMetadataV2ToJson(
    value: RPCPriceFeedMetadataV2
  ): any {
    return uncast(value, r("RPCPriceFeedMetadataV2"));
  }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ""): never {
  const prettyTyp = prettyTypeName(typ);
  const parentText = parent ? ` on ${parent}` : "";
  const keyText = key ? ` for key "${key}"` : "";
  throw Error(
    `Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(
      val
    )}`
  );
}

function prettyTypeName(typ: any): string {
  if (Array.isArray(typ)) {
    if (typ.length === 2 && typ[0] === undefined) {
      return `an optional ${prettyTypeName(typ[1])}`;
    } else {
      return `one of [${typ
        .map((a) => {
          return prettyTypeName(a);
        })
        .join(", ")}]`;
    }
  } else if (typeof typ === "object" && typ.literal !== undefined) {
    return typ.literal;
  } else {
    return typeof typ;
  }
}

function jsonToJSProps(typ: any): any {
  if (typ.jsonToJS === undefined) {
    const map: any = {};
    typ.props.forEach((p: any) => (map[p.json] = { key: p.js, typ: p.typ }));
    typ.jsonToJS = map;
  }
  return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
  if (typ.jsToJSON === undefined) {
    const map: any = {};
    typ.props.forEach((p: any) => (map[p.js] = { key: p.json, typ: p.typ }));
    typ.jsToJSON = map;
  }
  return typ.jsToJSON;
}

function transform(
  val: any,
  typ: any,
  getProps: any,
  key: any = "",
  parent: any = ""
): any {
  function transformPrimitive(typ: string, val: any): any {
    if (typeof typ === typeof val) return val;
    return invalidValue(typ, val, key, parent);
  }

  function transformUnion(typs: any[], val: any): any {
    // val must validate against one typ in typs
    const l = typs.length;
    for (let i = 0; i < l; i++) {
      const typ = typs[i];
      try {
        return transform(val, typ, getProps);
      } catch (_) {}
    }
    return invalidValue(typs, val, key, parent);
  }

  function transformEnum(cases: string[], val: any): any {
    if (cases.indexOf(val) !== -1) return val;
    return invalidValue(
      cases.map((a) => {
        return l(a);
      }),
      val,
      key,
      parent
    );
  }

  function transformArray(typ: any, val: any): any {
    // val must be an array with no invalid elements
    if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
    return val.map((el) => transform(el, typ, getProps));
  }

  function transformDate(val: any): any {
    if (val === null) {
      return null;
    }
    const d = new Date(val);
    if (isNaN(d.valueOf())) {
      return invalidValue(l("Date"), val, key, parent);
    }
    return d;
  }

  function transformObject(
    props: { [k: string]: any },
    additional: any,
    val: any
  ): any {
    if (val === null || typeof val !== "object" || Array.isArray(val)) {
      return invalidValue(l(ref || "object"), val, key, parent);
    }
    const result: any = {};
    Object.getOwnPropertyNames(props).forEach((key) => {
      const prop = props[key];
      const v = Object.prototype.hasOwnProperty.call(val, key)
        ? val[key]
        : undefined;
      result[prop.key] = transform(v, prop.typ, getProps, key, ref);
    });
    Object.getOwnPropertyNames(val).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(props, key)) {
        result[key] = transform(val[key], additional, getProps, key, ref);
      }
    });
    return result;
  }

  if (typ === "any") return val;
  if (typ === null) {
    if (val === null) return val;
    return invalidValue(typ, val, key, parent);
  }
  if (typ === false) return invalidValue(typ, val, key, parent);
  let ref: any = undefined;
  while (typeof typ === "object" && typ.ref !== undefined) {
    ref = typ.ref;
    typ = typeMap[typ.ref];
  }
  if (Array.isArray(typ)) return transformEnum(typ, val);
  if (typeof typ === "object") {
    return typ.hasOwnProperty("unionMembers")
      ? transformUnion(typ.unionMembers, val)
      : typ.hasOwnProperty("arrayItems")
      ? transformArray(typ.arrayItems, val)
      : typ.hasOwnProperty("props")
      ? transformObject(getProps(typ), typ.additional, val)
      : invalidValue(typ, val, key, parent);
  }
  // Numbers can be parsed by Date but shouldn't be.
  if (typ === Date && typeof val !== "number") return transformDate(val);
  return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
  return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
  return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
  return { literal: typ };
}

function a(typ: any) {
  return { arrayItems: typ };
}

function u(...typs: any[]) {
  return { unionMembers: typs };
}

function o(props: any[], additional: any) {
  return { props, additional };
}

function m(additional: any) {
  return { props: [], additional };
}

function r(name: string) {
  return { ref: name };
}

const typeMap: any = {
  PriceUpdate: o(
    [
      { json: "binary", js: "binary", typ: r("BinaryPriceUpdate") },
      {
        json: "parsed",
        js: "parsed",
        typ: u(undefined, a(r("ParsedPriceUpdate"))),
      },
    ],
    "any"
  ),
  BinaryPriceUpdate: o(
    [
      { json: "data", js: "data", typ: a("") },
      { json: "encoding", js: "encoding", typ: r("EncodingType") },
    ],
    "any"
  ),
  ParsedPriceUpdate: o(
    [
      { json: "ema_price", js: "ema_price", typ: r("RPCPrice") },
      { json: "id", js: "id", typ: "" },
      { json: "metadata", js: "metadata", typ: r("RPCPriceFeedMetadataV2") },
      { json: "price", js: "price", typ: r("RPCPrice") },
    ],
    "any"
  ),
  RPCPrice: o(
    [
      { json: "conf", js: "conf", typ: "" },
      { json: "expo", js: "expo", typ: 0 },
      { json: "price", js: "price", typ: "" },
      { json: "publish_time", js: "publish_time", typ: 0 },
    ],
    "any"
  ),
  RPCPriceFeedMetadataV2: o(
    [
      {
        json: "prev_publish_time",
        js: "prev_publish_time",
        typ: u(undefined, 0),
      },
      {
        json: "proof_available_time",
        js: "proof_available_time",
        typ: u(undefined, 0),
      },
      { json: "slot", js: "slot", typ: u(undefined, 0) },
    ],
    "any"
  ),
  EncodingType: ["base64", "hex"],
};
