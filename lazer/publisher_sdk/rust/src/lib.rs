use std::{collections::BTreeMap, time::Duration};

use ::protobuf::MessageField;
use anyhow::{bail, ensure, Context};
use humantime::format_duration;
use protobuf::dynamic_value::{dynamic_value, DynamicValue};
use pyth_lazer_protocol::router::TimestampUs;

pub mod transaction_envelope {
    pub use crate::protobuf::transaction_envelope::*;
}

pub mod transaction {
    pub use crate::protobuf::pyth_lazer_transaction::*;
}

pub mod publisher_update {
    pub use crate::protobuf::publisher_update::*;
}

pub mod governance_instruction {
    pub use crate::protobuf::governance_instruction::*;
}

pub mod state {
    pub use crate::protobuf::state::*;
}

#[allow(rustdoc::broken_intra_doc_links)]
mod protobuf {
    include!(concat!(env!("OUT_DIR"), "/protobuf/mod.rs"));
}

impl DynamicValue {
    pub fn try_option_from_serde(value: serde_value::Value) -> anyhow::Result<Option<Self>> {
        match value {
            serde_value::Value::Option(value) => {
                if let Some(value) = value {
                    Ok(Some((*value).try_into()?))
                } else {
                    Ok(None)
                }
            }
            value => Ok(Some(value.try_into()?)),
        }
    }

    pub fn to_timestamp(&self) -> anyhow::Result<TimestampUs> {
        let value = self.value.as_ref().context("missing DynamicValue.value")?;
        match value {
            dynamic_value::Value::TimestampValue(ts) => Ok(ts.try_into()?),
            _ => bail!("expected timestamp, got {:?}", self),
        }
    }

    pub fn to_duration(&self) -> anyhow::Result<Duration> {
        let value = self.value.as_ref().context("missing DynamicValue.value")?;
        match value {
            dynamic_value::Value::DurationValue(duration) => Ok(duration.clone().into()),
            _ => bail!("expected duration, got {:?}", self),
        }
    }
}

impl TryFrom<serde_value::Value> for DynamicValue {
    type Error = anyhow::Error;

    fn try_from(value: serde_value::Value) -> Result<Self, Self::Error> {
        let converted = match value {
            serde_value::Value::Bool(value) => dynamic_value::Value::BoolValue(value),
            serde_value::Value::U8(value) => dynamic_value::Value::UintValue(value.into()),
            serde_value::Value::U16(value) => dynamic_value::Value::UintValue(value.into()),
            serde_value::Value::U32(value) => dynamic_value::Value::UintValue(value.into()),
            serde_value::Value::U64(value) => dynamic_value::Value::UintValue(value),
            serde_value::Value::I8(value) => dynamic_value::Value::IntValue(value.into()),
            serde_value::Value::I16(value) => dynamic_value::Value::IntValue(value.into()),
            serde_value::Value::I32(value) => dynamic_value::Value::IntValue(value.into()),
            serde_value::Value::I64(value) => dynamic_value::Value::IntValue(value),
            serde_value::Value::F32(value) => dynamic_value::Value::DoubleValue(value.into()),
            serde_value::Value::F64(value) => dynamic_value::Value::DoubleValue(value),
            serde_value::Value::Char(value) => dynamic_value::Value::StringValue(value.to_string()),
            serde_value::Value::String(value) => dynamic_value::Value::StringValue(value),
            serde_value::Value::Bytes(value) => dynamic_value::Value::BytesValue(value),
            serde_value::Value::Seq(values) => {
                let mut items = Vec::new();
                for value in values {
                    items.push(value.try_into()?);
                }
                dynamic_value::Value::List(dynamic_value::List {
                    items,
                    special_fields: Default::default(),
                })
            }
            serde_value::Value::Map(values) => {
                let mut items = Vec::new();
                for (key, value) in values {
                    let key = match key {
                        serde_value::Value::String(key) => key,
                        _ => bail!("unsupported key type: expected string, got {:?}", key),
                    };
                    items.push(dynamic_value::MapItem {
                        key: Some(key),
                        value: MessageField::some(value.try_into()?),
                        special_fields: Default::default(),
                    })
                }
                dynamic_value::Value::Map(dynamic_value::Map {
                    items,
                    special_fields: Default::default(),
                })
            }
            serde_value::Value::Unit
            | serde_value::Value::Option(_)
            | serde_value::Value::Newtype(_) => bail!("unsupported type: {:?}", value),
        };
        Ok(DynamicValue {
            value: Some(converted),
            special_fields: Default::default(),
        })
    }
}

impl TryFrom<DynamicValue> for serde_value::Value {
    type Error = anyhow::Error;

    fn try_from(value: DynamicValue) -> Result<Self, Self::Error> {
        let value = value.value.context("missing DynamicValue.value")?;
        match value {
            dynamic_value::Value::StringValue(value) => Ok(serde_value::Value::String(value)),
            dynamic_value::Value::DoubleValue(value) => Ok(serde_value::Value::F64(value)),
            dynamic_value::Value::UintValue(value) => Ok(serde_value::Value::U64(value)),
            dynamic_value::Value::IntValue(value) => Ok(serde_value::Value::I64(value)),
            dynamic_value::Value::BoolValue(value) => Ok(serde_value::Value::Bool(value)),
            dynamic_value::Value::BytesValue(value) => Ok(serde_value::Value::Bytes(value)),
            dynamic_value::Value::DurationValue(duration) => {
                let s: Duration = duration.into();
                Ok(serde_value::Value::String(format_duration(s).to_string()))
            }
            dynamic_value::Value::TimestampValue(ts) => {
                let ts = TimestampUs::try_from(&ts)?;
                Ok(serde_value::Value::U64(ts.0))
            }
            dynamic_value::Value::List(list) => {
                let mut output = Vec::new();
                for item in list.items {
                    output.push(item.try_into()?);
                }
                Ok(serde_value::Value::Seq(output))
            }
            dynamic_value::Value::Map(map) => {
                let mut output = BTreeMap::new();
                for item in map.items {
                    let key = item.key.context("missing DynamicValue.MapItem.key")?;
                    let value = item
                        .value
                        .into_option()
                        .context("missing DynamicValue.MapItem.value")?
                        .try_into()?;
                    let old = output.insert(serde_value::Value::String(key), value);
                    ensure!(old.is_none(), "duplicate DynamicValue.MapItem.key");
                }
                Ok(serde_value::Value::Map(output))
            }
        }
    }
}
