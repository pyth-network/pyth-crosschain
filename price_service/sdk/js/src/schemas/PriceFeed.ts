// To parse this data:
//
//   import { Convert, PriceFeed } from "./file";
//
//   const priceFeed = Convert.toPriceFeed(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

/**
 * Represents an aggregate price from Pyth publisher feeds.
 */
export interface PriceFeed {
  /**
   * Exponentially-weighted moving average Price
   */
  ema_price: Price;
  /**
   * Unique identifier for this price.
   */
  id: string;
  /**
   * Metadata of the price
   */
  metadata?: PriceFeedMetadata;
  /**
   * Price
   */
  price: Price;
  /**
   * VAA of the price
   */
  vaa?: string;
}

/**
 * Exponentially-weighted moving average Price
 *
 * Represents a Pyth price
 *
 * Price
 */
export interface Price {
  /**
   * Confidence interval around the price.
   */
  conf: string;
  /**
   * Price exponent.
   */
  expo: number;
  /**
   * Price.
   */
  price: string;
  /**
   * Publish Time of the price
   */
  publish_time: number;
}

/**
 * Metadata of the price
 *
 * Represents metadata of a price feed.
 */
export interface PriceFeedMetadata {
  /**
   * Attestation time of the price
   */
  attestation_time?: number;
  /**
   * Chain of the emitter
   */
  emitter_chain: number;
  /**
   * The time that the previous price was published
   */
  prev_publish_time?: number;
  /**
   * The time that the price service received the price
   */
  price_service_receive_time?: number;
  /**
   * Sequence number of the price
   */
  sequence_number?: number;
  /**
   * Pythnet slot number of the price
   */
  slot?: number;
}

// Converts JSON types to/from your types
// and asserts the results at runtime
export class Convert {
  public static toPriceFeed(json: any): PriceFeed {
    return cast(json, r("PriceFeed"));
  }

  public static priceFeedToJson(value: PriceFeed): any {
    return uncast(value, r("PriceFeed"));
  }

  public static toPrice(json: any): Price {
    return cast(json, r("Price"));
  }

  public static priceToJson(value: Price): any {
    return uncast(value, r("Price"));
  }

  public static toPriceFeedMetadata(json: any): PriceFeedMetadata {
    return cast(json, r("PriceFeedMetadata"));
  }

  public static priceFeedMetadataToJson(value: PriceFeedMetadata): any {
    return uncast(value, r("PriceFeedMetadata"));
  }
}

function invalidValue(typ: any, val: any, key: any = ""): never {
  if (key) {
    throw Error(
      `Invalid value for key "${key}". Expected type ${JSON.stringify(
        typ,
      )} but got ${JSON.stringify(val)}`,
    );
  }
  throw Error(
    `Invalid value ${JSON.stringify(val)} for type ${JSON.stringify(typ)}`,
  );
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

function transform(val: any, typ: any, getProps: any, key: any = ""): any {
  function transformPrimitive(typ: string, val: any): any {
    if (typeof typ === typeof val) return val;
    return invalidValue(typ, val, key);
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
    return invalidValue(typs, val);
  }

  function transformEnum(cases: string[], val: any): any {
    if (cases.indexOf(val) !== -1) return val;
    return invalidValue(cases, val);
  }

  function transformArray(typ: any, val: any): any {
    // val must be an array with no invalid elements
    if (!Array.isArray(val)) return invalidValue("array", val);
    return val.map((el) => transform(el, typ, getProps));
  }

  function transformDate(val: any): any {
    if (val === null) {
      return null;
    }
    const d = new Date(val);
    if (isNaN(d.valueOf())) {
      return invalidValue("Date", val);
    }
    return d;
  }

  function transformObject(
    props: { [k: string]: any },
    additional: any,
    val: any,
  ): any {
    if (val === null || typeof val !== "object" || Array.isArray(val)) {
      return invalidValue("object", val);
    }
    const result: any = {};
    Object.getOwnPropertyNames(props).forEach((key) => {
      const prop = props[key];
      const v = Object.prototype.hasOwnProperty.call(val, key)
        ? val[key]
        : undefined;
      result[prop.key] = transform(v, prop.typ, getProps, prop.key);
    });
    Object.getOwnPropertyNames(val).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(props, key)) {
        result[key] = transform(val[key], additional, getProps, key);
      }
    });
    return result;
  }

  if (typ === "any") return val;
  if (typ === null) {
    if (val === null) return val;
    return invalidValue(typ, val);
  }
  if (typ === false) return invalidValue(typ, val);
  while (typeof typ === "object" && typ.ref !== undefined) {
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
          : invalidValue(typ, val);
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
  PriceFeed: o(
    [
      { json: "ema_price", js: "ema_price", typ: r("Price") },
      { json: "id", js: "id", typ: "" },
      {
        json: "metadata",
        js: "metadata",
        typ: u(undefined, r("PriceFeedMetadata")),
      },
      { json: "price", js: "price", typ: r("Price") },
      { json: "vaa", js: "vaa", typ: u(undefined, "") },
    ],
    "any",
  ),
  Price: o(
    [
      { json: "conf", js: "conf", typ: "" },
      { json: "expo", js: "expo", typ: 0 },
      { json: "price", js: "price", typ: "" },
      { json: "publish_time", js: "publish_time", typ: 0 },
    ],
    "any",
  ),
  PriceFeedMetadata: o(
    [
      {
        json: "attestation_time",
        js: "attestation_time",
        typ: u(undefined, 0),
      },
      { json: "emitter_chain", js: "emitter_chain", typ: 0 },
      {
        json: "prev_publish_time",
        js: "prev_publish_time",
        typ: u(undefined, 0),
      },
      {
        json: "price_service_receive_time",
        js: "price_service_receive_time",
        typ: u(undefined, 0),
      },
      { json: "sequence_number", js: "sequence_number", typ: u(undefined, 0) },
      { json: "slot", js: "slot", typ: u(undefined, 0) },
    ],
    "any",
  ),
};
