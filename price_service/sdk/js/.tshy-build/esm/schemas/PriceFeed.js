// To parse this data:
//
//   import { Convert, PriceFeed } from "./file";
//
//   const priceFeed = Convert.toPriceFeed(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.
// Converts JSON types to/from your types
// and asserts the results at runtime
export class Convert {
    static toPriceFeed(json) {
        return cast(json, r("PriceFeed"));
    }
    static priceFeedToJson(value) {
        return uncast(value, r("PriceFeed"));
    }
    static toPrice(json) {
        return cast(json, r("Price"));
    }
    static priceToJson(value) {
        return uncast(value, r("Price"));
    }
    static toPriceFeedMetadata(json) {
        return cast(json, r("PriceFeedMetadata"));
    }
    static priceFeedMetadataToJson(value) {
        return uncast(value, r("PriceFeedMetadata"));
    }
}
function invalidValue(typ, val, key = "") {
    if (key) {
        throw Error(`Invalid value for key "${key}". Expected type ${JSON.stringify(typ)} but got ${JSON.stringify(val)}`);
    }
    throw Error(`Invalid value ${JSON.stringify(val)} for type ${JSON.stringify(typ)}`);
}
function jsonToJSProps(typ) {
    if (typ.jsonToJS === undefined) {
        const map = {};
        typ.props.forEach((p) => (map[p.json] = { key: p.js, typ: p.typ }));
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}
function jsToJSONProps(typ) {
    if (typ.jsToJSON === undefined) {
        const map = {};
        typ.props.forEach((p) => (map[p.js] = { key: p.json, typ: p.typ }));
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}
function transform(val, typ, getProps, key = "") {
    function transformPrimitive(typ, val) {
        if (typeof typ === typeof val)
            return val;
        return invalidValue(typ, val, key);
    }
    function transformUnion(typs, val) {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            }
            catch (_) { }
        }
        return invalidValue(typs, val);
    }
    function transformEnum(cases, val) {
        if (cases.indexOf(val) !== -1)
            return val;
        return invalidValue(cases, val);
    }
    function transformArray(typ, val) {
        // val must be an array with no invalid elements
        if (!Array.isArray(val))
            return invalidValue("array", val);
        return val.map((el) => transform(el, typ, getProps));
    }
    function transformDate(val) {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue("Date", val);
        }
        return d;
    }
    function transformObject(props, additional, val) {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue("object", val);
        }
        const result = {};
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
    if (typ === "any")
        return val;
    if (typ === null) {
        if (val === null)
            return val;
        return invalidValue(typ, val);
    }
    if (typ === false)
        return invalidValue(typ, val);
    while (typeof typ === "object" && typ.ref !== undefined) {
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ))
        return transformEnum(typ, val);
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
    if (typ === Date && typeof val !== "number")
        return transformDate(val);
    return transformPrimitive(typ, val);
}
function cast(val, typ) {
    return transform(val, typ, jsonToJSProps);
}
function uncast(val, typ) {
    return transform(val, typ, jsToJSONProps);
}
function a(typ) {
    return { arrayItems: typ };
}
function u(...typs) {
    return { unionMembers: typs };
}
function o(props, additional) {
    return { props, additional };
}
function m(additional) {
    return { props: [], additional };
}
function r(name) {
    return { ref: name };
}
const typeMap = {
    PriceFeed: o([
        { json: "ema_price", js: "ema_price", typ: r("Price") },
        { json: "id", js: "id", typ: "" },
        {
            json: "metadata",
            js: "metadata",
            typ: u(undefined, r("PriceFeedMetadata")),
        },
        { json: "price", js: "price", typ: r("Price") },
        { json: "vaa", js: "vaa", typ: u(undefined, "") },
    ], "any"),
    Price: o([
        { json: "conf", js: "conf", typ: "" },
        { json: "expo", js: "expo", typ: 0 },
        { json: "price", js: "price", typ: "" },
        { json: "publish_time", js: "publish_time", typ: 0 },
    ], "any"),
    PriceFeedMetadata: o([
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
    ], "any"),
};
