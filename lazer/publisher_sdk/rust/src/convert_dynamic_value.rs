#[cfg(test)]
mod tests;

use std::collections::BTreeMap;

use crate::protobuf::dynamic_value::{dynamic_value, DynamicValue as ProtobufDynamicValue};
use ::protobuf::MessageField;
use anyhow::{ensure, Context};
use pyth_lazer_protocol::{
    time::{DurationUs, TimestampUs},
    DynamicValue,
};

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
