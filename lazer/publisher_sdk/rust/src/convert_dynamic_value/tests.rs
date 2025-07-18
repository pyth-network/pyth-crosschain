use std::collections::BTreeMap;

use protobuf::{
    well_known_types::{duration::Duration, timestamp::Timestamp},
    MessageField,
};
use pyth_lazer_protocol::DynamicValue;

use crate::protobuf::dynamic_value::{
    dynamic_value::{List, Map, MapItem, Value},
    DynamicValue as ProtobufDynamicValue,
};

#[test]
fn dynamic_value_serializes() {
    let mut map = BTreeMap::new();
    map.insert(
        "int1".to_owned(),
        ProtobufDynamicValue {
            value: Some(Value::IntValue(42)),
            special_fields: Default::default(),
        },
    );

    map.insert(
        "bool2".to_owned(),
        ProtobufDynamicValue {
            value: Some(Value::BoolValue(true)),
            special_fields: Default::default(),
        },
    );

    map.insert(
        "str3".to_owned(),
        ProtobufDynamicValue {
            value: Some(Value::StringValue("abc".into())),
            special_fields: Default::default(),
        },
    );

    map.insert(
        "double4".to_owned(),
        ProtobufDynamicValue {
            value: Some(Value::DoubleValue(42.0)),
            special_fields: Default::default(),
        },
    );

    map.insert(
        "uint5".to_owned(),
        ProtobufDynamicValue {
            value: Some(Value::UintValue(42)),
            special_fields: Default::default(),
        },
    );

    map.insert(
        "bytes6".to_owned(),
        ProtobufDynamicValue {
            value: Some(Value::BytesValue(b"\xAB\xCD\xEF".into())),
            special_fields: Default::default(),
        },
    );

    map.insert(
        "duration7".to_owned(),
        ProtobufDynamicValue {
            value: Some(Value::DurationValue(Duration {
                seconds: 12,
                nanos: 345678000,
                special_fields: Default::default(),
            })),
            special_fields: Default::default(),
        },
    );

    map.insert(
        "timestamp8".to_owned(),
        ProtobufDynamicValue {
            value: Some(Value::TimestampValue(Timestamp {
                seconds: 12,
                nanos: 345678000,
                special_fields: Default::default(),
            })),
            special_fields: Default::default(),
        },
    );

    map.insert(
        "list9".to_owned(),
        ProtobufDynamicValue {
            value: Some(Value::List(List {
                items: vec![
                    ProtobufDynamicValue {
                        value: Some(Value::StringValue("item1".into())),
                        special_fields: Default::default(),
                    },
                    ProtobufDynamicValue {
                        value: Some(Value::StringValue("item2".into())),
                        special_fields: Default::default(),
                    },
                ],
                special_fields: Default::default(),
            })),
            special_fields: Default::default(),
        },
    );
    let map = Map {
        items: map
            .into_iter()
            .map(|(k, v)| MapItem {
                key: Some(k),
                value: MessageField::some(v),
                special_fields: Default::default(),
            })
            .collect(),
        special_fields: Default::default(),
    };

    let converted: BTreeMap<String, DynamicValue> = map.clone().try_into().unwrap();

    let json = serde_json::to_string_pretty(&converted).unwrap();
    println!("{json}");
    assert_eq!(
        json,
        r#"{
  "bool2": true,
  "bytes6": "abcdef",
  "double4": 42.0,
  "duration7": "12s 345ms 678us",
  "int1": 42,
  "list9": [
    "item1",
    "item2"
  ],
  "str3": "abc",
  "timestamp8": 12345678,
  "uint5": 42
}"#
    );

    // Check roundtrip
    let reversed: Map = converted.into();
    assert_eq!(map, reversed);
}
