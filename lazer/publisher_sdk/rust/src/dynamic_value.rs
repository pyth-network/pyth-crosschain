#[cfg(test)]
mod tests;

use std::collections::BTreeMap;

use crate::protobuf::dynamic_value::{dynamic_value, DynamicValue as ProtobufDynamicValue};
use ::protobuf::MessageField;
use anyhow::{ensure, Context};
use derive_more::From;
use pyth_lazer_protocol::time::{DurationUs, TimestampUs};
use serde::{
    ser::{SerializeMap, SerializeSeq},
    Serialize,
};

#[derive(Debug, Clone, PartialEq, From)]
pub enum DynamicValue {
    String(String),
    F64(f64),
    U64(u64),
    I64(i64),
    Bool(bool),
    Timestamp(TimestampUs),
    Duration(DurationUs),
    Bytes(Vec<u8>),
    List(Vec<DynamicValue>),
    Map(BTreeMap<String, DynamicValue>),
}

impl From<DynamicValue> for ProtobufDynamicValue {
    fn from(value: DynamicValue) -> Self {
        let converted = match value {
            DynamicValue::Bool(value) => dynamic_value::Value::BoolValue(value),
            DynamicValue::U64(value) => dynamic_value::Value::UintValue(value),
            DynamicValue::I64(value) => dynamic_value::Value::IntValue(value),
            DynamicValue::F64(value) => dynamic_value::Value::DoubleValue(value),
            DynamicValue::String(value) => dynamic_value::Value::StringValue(value),
            DynamicValue::Bytes(value) => dynamic_value::Value::BytesValue(value),
            DynamicValue::Timestamp(value) => dynamic_value::Value::TimestampValue(value.into()),
            DynamicValue::Duration(value) => dynamic_value::Value::DurationValue(value.into()),
            DynamicValue::List(values) => dynamic_value::Value::List(values.into()),
            DynamicValue::Map(values) => dynamic_value::Value::Map(values.into()),
        };
        ProtobufDynamicValue {
            value: Some(converted),
            special_fields: Default::default(),
        }
    }
}

impl From<&DynamicValue> for ProtobufDynamicValue {
    fn from(value: &DynamicValue) -> Self {
        let converted = match value {
            DynamicValue::Bool(value) => dynamic_value::Value::BoolValue(*value),
            DynamicValue::U64(value) => dynamic_value::Value::UintValue(*value),
            DynamicValue::I64(value) => dynamic_value::Value::IntValue(*value),
            DynamicValue::F64(value) => dynamic_value::Value::DoubleValue(*value),
            DynamicValue::String(value) => dynamic_value::Value::StringValue(value.clone()),
            DynamicValue::Bytes(value) => dynamic_value::Value::BytesValue(value.clone()),
            DynamicValue::Timestamp(value) => dynamic_value::Value::TimestampValue((*value).into()),
            DynamicValue::Duration(value) => dynamic_value::Value::DurationValue((*value).into()),
            DynamicValue::List(values) => dynamic_value::Value::List(values.into()),
            DynamicValue::Map(values) => dynamic_value::Value::Map(values.into()),
        };
        ProtobufDynamicValue {
            value: Some(converted),
            special_fields: Default::default(),
        }
    }
}

impl From<BTreeMap<String, DynamicValue>> for dynamic_value::Map {
    fn from(values: BTreeMap<String, DynamicValue>) -> Self {
        let mut items = Vec::new();
        for (key, value) in values {
            items.push(dynamic_value::MapItem {
                key: Some(key),
                value: MessageField::some(value.into()),
                special_fields: Default::default(),
            })
        }
        dynamic_value::Map {
            items,
            special_fields: Default::default(),
        }
    }
}

impl From<&BTreeMap<String, DynamicValue>> for dynamic_value::Map {
    fn from(values: &BTreeMap<String, DynamicValue>) -> Self {
        let mut items = Vec::new();
        for (key, value) in values {
            items.push(dynamic_value::MapItem {
                key: Some(key.clone()),
                value: MessageField::some(value.into()),
                special_fields: Default::default(),
            })
        }
        dynamic_value::Map {
            items,
            special_fields: Default::default(),
        }
    }
}

impl From<Vec<DynamicValue>> for dynamic_value::List {
    fn from(values: Vec<DynamicValue>) -> Self {
        let mut items = Vec::new();
        for value in values {
            items.push(value.into());
        }
        dynamic_value::List {
            items,
            special_fields: Default::default(),
        }
    }
}

impl From<&[DynamicValue]> for dynamic_value::List {
    fn from(values: &[DynamicValue]) -> Self {
        let mut items = Vec::new();
        for value in values {
            items.push(value.into());
        }
        dynamic_value::List {
            items,
            special_fields: Default::default(),
        }
    }
}

impl From<&Vec<DynamicValue>> for dynamic_value::List {
    fn from(value: &Vec<DynamicValue>) -> Self {
        let value: &[DynamicValue] = value;
        value.into()
    }
}

impl TryFrom<ProtobufDynamicValue> for DynamicValue {
    type Error = anyhow::Error;

    fn try_from(value: ProtobufDynamicValue) -> Result<Self, Self::Error> {
        let value = value.value.context("missing DynamicValue.value")?;
        match value {
            dynamic_value::Value::StringValue(value) => Ok(DynamicValue::String(value)),
            dynamic_value::Value::DoubleValue(value) => Ok(DynamicValue::F64(value)),
            dynamic_value::Value::UintValue(value) => Ok(DynamicValue::U64(value)),
            dynamic_value::Value::IntValue(value) => Ok(DynamicValue::I64(value)),
            dynamic_value::Value::BoolValue(value) => Ok(DynamicValue::Bool(value)),
            dynamic_value::Value::BytesValue(value) => Ok(DynamicValue::Bytes(value)),
            dynamic_value::Value::DurationValue(value) => {
                let v: DurationUs = value.try_into()?;
                Ok(DynamicValue::Duration(v))
            }
            dynamic_value::Value::TimestampValue(ts) => {
                let ts = TimestampUs::try_from(&ts)?;
                Ok(DynamicValue::Timestamp(ts))
            }
            dynamic_value::Value::List(list) => Ok(DynamicValue::List(list.try_into()?)),
            dynamic_value::Value::Map(map) => Ok(DynamicValue::Map(map.try_into()?)),
        }
    }
}

impl TryFrom<dynamic_value::Map> for BTreeMap<String, DynamicValue> {
    type Error = anyhow::Error;

    fn try_from(value: dynamic_value::Map) -> Result<Self, Self::Error> {
        let mut output = BTreeMap::new();
        for item in value.items {
            let key = item.key.context("missing DynamicValue.MapItem.key")?;
            let value = item
                .value
                .into_option()
                .context("missing DynamicValue.MapItem.value")?
                .try_into()?;
            let old = output.insert(key, value);
            ensure!(old.is_none(), "duplicate DynamicValue.MapItem.key");
        }
        Ok(output)
    }
}

impl TryFrom<dynamic_value::List> for Vec<DynamicValue> {
    type Error = anyhow::Error;

    fn try_from(value: dynamic_value::List) -> Result<Self, Self::Error> {
        let mut output = Vec::new();
        for item in value.items {
            output.push(item.try_into()?);
        }
        Ok(output)
    }
}

impl Serialize for DynamicValue {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            DynamicValue::String(v) => serializer.serialize_str(v),
            DynamicValue::F64(v) => serializer.serialize_f64(*v),
            DynamicValue::U64(v) => serializer.serialize_u64(*v),
            DynamicValue::I64(v) => serializer.serialize_i64(*v),
            DynamicValue::Bool(v) => serializer.serialize_bool(*v),
            DynamicValue::Timestamp(v) => serializer.serialize_u64(v.as_micros()),
            DynamicValue::Duration(v) => {
                serializer.serialize_str(&humantime::format_duration((*v).into()).to_string())
            }
            DynamicValue::Bytes(v) => serializer.serialize_str(&hex::encode(v)),
            DynamicValue::List(v) => {
                let mut seq_serializer = serializer.serialize_seq(Some(v.len()))?;
                for element in v {
                    seq_serializer.serialize_element(element)?;
                }
                seq_serializer.end()
            }
            DynamicValue::Map(map) => {
                let mut map_serializer = serializer.serialize_map(Some(map.len()))?;
                for (k, v) in map {
                    map_serializer.serialize_entry(k, v)?;
                }
                map_serializer.end()
            }
        }
    }
}
