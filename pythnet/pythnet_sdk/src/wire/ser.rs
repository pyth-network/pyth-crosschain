//! A module defining serde serialize for a simple Rust struct-like message format. The format will
//! read Rust types exactly the size they are, and reads sequences by reading a u8 length followed
//! by a count of the elements of the vector.
//!
//! TL;DR: How to Use
//! ================================================================================
//!
//! ```rust,ignore
//! #[derive(Serialize)]
//! struct ExampleStruct {
//!     a: (),
//!     b: bool,
//!     c: u8,
//!     ...,
//! }
//!
//! let mut buf = Vec::new();
//! pythnet_sdk::ser::to_writer(&mut buf, &ExampleStruct { ... }).unwrap();
//! let result = pythnet_sdk::ser::to_vec(&ExampleStruct { ... }).unwrap();
//! ```
//!
//! A quick primer on `serde::Serialize`:
//! ================================================================================
//!
//! Given some type `T`, the `serde::Serialize` derives an implementation with a `serialize` method
//! that calls all the relevant `serialize_` calls defined in this file, so for example, given the
//! following types:
//!
//! ```rust,ignore
//! #[derive(Serialize)]
//! enum ExampleEnum {
//!    A,
//!    B(u8),
//!    C(u8, u8),
//!    D { a: u8, b: u8 },
//! }
//!
//! #[derive(Serialize)]
//! struct ExampleStruct {
//!    a: (),
//!    b: bool,
//!    c: u8,
//!    d: &str,
//!    e: ExampleEnum
//! }
//! ```
//!
//! The macro will expand into (a more complicated but equivalent) version of:
//!
//! ```rust,ignore
//! impl serde::Serialize for ExampleEnum {
//!     fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
//!         match self {
//!             ExampleEnum::A => serializer.serialize_unit_variant("ExampleEnum", 0, "A"),
//!             ExampleEnum::B(v) => serializer.serialize_newtype_variant("ExampleEnum", 1, "B", v),
//!             ExampleEnum::C(v0, v1) => serializer.serialize_tuple_variant("ExampleEnum", 2, "C", (v0, v1)),
//!             ExampleEnum::D { a, b } => serializer.serialize_struct_variant("ExampleEnum", 3, "D", 2, "a", a, "b", b),
//!         }
//!     }
//! }
//!
//! impl serde::Serialize for ExampleStruct {
//!     fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
//!         let mut state = serializer.serialize_struct("ExampleStruct", 5)?;
//!         state.serialize_field("a", &self.a)?;
//!         state.serialize_field("b", &self.b)?;
//!         state.serialize_field("c", &self.c)?;
//!         state.serialize_field("d", &self.d)?;
//!         state.serialize_field("e", &self.e)?;
//!         state.end()
//!     }
//! }
//! ```
//!
//! Note that any parser can be passed in, which gives the serializer the ability to serialize to
//! any format we desire as long as there is a `Serializer` implementation for it. With aggressive
//! inlining, the compiler will be able to optimize away the intermediate state objects and calls
//! to `serialize_field` and `serialize_*_variant` and the final result of our parser will have
//! very close to equivalent performance to a hand written implementation.
//!
//! The Pyth Serialization Format
//! ================================================================================
//!
//! Pyth has various data formats that are serialized in compact forms to make storing or passing
//! cross-chain cheaper. So far all these formats follow a similar pattern and so this serializer
//! is designed to be able to provide a canonical implementation for all of them.
//!
//!
//! Format Spec:
//! --------------------------------------------------------------------------------
//!
//! Integers:
//!
//! - `{u,i}8` are serialized as a single byte
//! - `{u,i}16/32/64/128` are serialized as bytes specified by the parser endianness type param.
//! - Custom {U,I}128/256 wrappers may be implemented later (similar to Borsh) for better support
//!   in JS, debugging, logging, etc.
//!
//! Floats:
//!
//! - `f32/64/128` are not supported due to different chains having different float formats.
//!
//! Strings:
//!
//! - `&str` is serialized as a u8 length followed by the bytes of the string.
//! - `String` is serialized as a u8 length followed by the bytes of the string.
//!
//! Sequences:
//!
//! - `Vec<T>` is serialized as a u8 length followed by the serialized elements of the vector.
//! - `&[T]` is serialized as a u8 length followed by the serialized elements of the slice.
//!
//! Enums:
//!
//! - `enum` is serialized as a u8 variant index followed by the serialized variant data.
//! - `Option<T>` is serialized as a u8 variant index followed by the serialized variant data.
//!
//! Structs:
//!
//! - `struct` is serialized as the serialized fields of the struct in order.
//!
//! Tuples:
//!
//! - `tuple` is serialized as the serialized elements of the tuple in order.
//!
//! Unit:
//!
//! - `()` is serialized as nothing.
//!
//!
//! Example Usage
//! --------------------------------------------------------------------------------
//!
//! ```rust,ignore
//! fn example(data: &[u8]) {
//!     let mut buf = Vec::new();
//!     let mut cur = Cursor::new(&mut buf);
//!     let mut des = Deserializer::new(&mut cur);
//!     let mut result = des.deserialize::<ExampleStruct>(data).unwrap();
//!     ...
//! }
//! ```

use {
    byteorder::{ByteOrder, WriteBytesExt},
    serde::{
        ser::{
            SerializeMap, SerializeSeq, SerializeStruct, SerializeStructVariant, SerializeTuple,
            SerializeTupleStruct, SerializeTupleVariant,
        },
        Serialize,
    },
    std::{fmt::Display, io::Write},
    thiserror::Error,
};

pub fn to_writer<T, W, B>(writer: W, value: &T) -> Result<(), SerializerError>
where
    T: Serialize,
    W: Write,
    B: ByteOrder,
{
    value.serialize(&mut Serializer::<_, B>::new(writer))?;
    Ok(())
}

pub fn to_vec<T, B>(value: &T) -> Result<Vec<u8>, SerializerError>
where
    T: Serialize,
    B: ByteOrder,
{
    let mut buf = Vec::new();
    to_writer::<T, _, B>(&mut buf, value)?;
    Ok(buf)
}

#[derive(Debug, Error)]
pub enum SerializerError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("this type is not supported")]
    Unsupported,

    #[error("sequence too large ({0} elements), max supported is 255")]
    SequenceTooLarge(usize),

    #[error("sequence length must be known before serializing")]
    SequenceLengthUnknown,

    #[error("enum variant {0}::{1} cannot be parsed as `u8`: {2}")]
    InvalidEnumVariant(&'static str, u32, &'static str),

    #[error("message: {0}")]
    Message(Box<str>),
}

/// A type for Pyth's common serialization format. Note that a ByteOrder type param is required as
/// we serialize in both big and little endian depending on different use-cases.
#[derive(Clone)]
pub struct Serializer<W: Write, B: ByteOrder> {
    writer: W,
    _endian: std::marker::PhantomData<B>,
}

impl serde::ser::Error for SerializerError {
    fn custom<T: Display>(msg: T) -> Self {
        SerializerError::Message(msg.to_string().into_boxed_str())
    }
}

impl<W: Write, B: ByteOrder> Serializer<W, B> {
    pub fn new(writer: W) -> Self {
        Self {
            writer,
            _endian: std::marker::PhantomData,
        }
    }
}

impl<'a, W: Write, B: ByteOrder> serde::Serializer for &'a mut Serializer<W, B> {
    type Ok = ();
    type Error = SerializerError;

    // Serde uses different types for different parse targets to allow for different
    // implementations. We only support one target, so we can set all these to `Self`
    // and implement those traits on the same type.
    type SerializeSeq = Self;
    type SerializeTuple = Self;
    type SerializeTupleStruct = Self;
    type SerializeTupleVariant = Self;
    type SerializeMap = Self;
    type SerializeStruct = Self;
    type SerializeStructVariant = Self;

    #[inline]
    fn serialize_bool(self, v: bool) -> Result<Self::Ok, Self::Error> {
        self.writer
            .write_all(&[v as u8])
            .map_err(SerializerError::from)
    }

    #[inline]
    fn serialize_i8(self, v: i8) -> Result<Self::Ok, Self::Error> {
        self.writer
            .write_all(&[v as u8])
            .map_err(SerializerError::from)
    }

    #[inline]
    fn serialize_i16(self, v: i16) -> Result<Self::Ok, Self::Error> {
        self.writer.write_i16::<B>(v).map_err(SerializerError::from)
    }

    #[inline]
    fn serialize_i32(self, v: i32) -> Result<Self::Ok, Self::Error> {
        self.writer.write_i32::<B>(v).map_err(SerializerError::from)
    }

    #[inline]
    fn serialize_i64(self, v: i64) -> Result<Self::Ok, Self::Error> {
        self.writer.write_i64::<B>(v).map_err(SerializerError::from)
    }

    #[inline]
    fn serialize_i128(self, v: i128) -> Result<Self::Ok, Self::Error> {
        self.writer
            .write_i128::<B>(v)
            .map_err(SerializerError::from)
    }

    #[inline]
    fn serialize_u8(self, v: u8) -> Result<Self::Ok, Self::Error> {
        self.writer.write_all(&[v]).map_err(SerializerError::from)
    }

    #[inline]
    fn serialize_u16(self, v: u16) -> Result<Self::Ok, Self::Error> {
        self.writer.write_u16::<B>(v).map_err(SerializerError::from)
    }

    #[inline]
    fn serialize_u32(self, v: u32) -> Result<Self::Ok, Self::Error> {
        self.writer.write_u32::<B>(v).map_err(SerializerError::from)
    }

    #[inline]
    fn serialize_u64(self, v: u64) -> Result<Self::Ok, Self::Error> {
        self.writer.write_u64::<B>(v).map_err(SerializerError::from)
    }

    #[inline]
    fn serialize_u128(self, v: u128) -> Result<Self::Ok, Self::Error> {
        self.writer
            .write_u128::<B>(v)
            .map_err(SerializerError::from)
    }

    #[inline]
    fn serialize_f32(self, _: f32) -> Result<Self::Ok, Self::Error> {
        Err(SerializerError::Unsupported)
    }

    #[inline]
    fn serialize_f64(self, _: f64) -> Result<Self::Ok, Self::Error> {
        Err(SerializerError::Unsupported)
    }

    #[inline]
    fn serialize_char(self, _: char) -> Result<Self::Ok, Self::Error> {
        Err(SerializerError::Unsupported)
    }

    #[inline]
    fn serialize_str(self, v: &str) -> Result<Self::Ok, Self::Error> {
        let len = u8::try_from(v.len()).map_err(|_| SerializerError::SequenceTooLarge(v.len()))?;
        self.writer.write_all(&[len])?;
        self.writer
            .write_all(v.as_bytes())
            .map_err(SerializerError::from)
    }

    #[inline]
    fn serialize_bytes(self, v: &[u8]) -> Result<Self::Ok, Self::Error> {
        let len = u8::try_from(v.len()).map_err(|_| SerializerError::SequenceTooLarge(v.len()))?;
        self.writer.write_all(&[len])?;
        self.writer.write_all(v).map_err(SerializerError::from)
    }

    #[inline]
    fn serialize_none(self) -> Result<Self::Ok, Self::Error> {
        Err(SerializerError::Unsupported)
    }

    #[inline]
    fn serialize_some<T: ?Sized + Serialize>(self, value: &T) -> Result<Self::Ok, Self::Error> {
        value.serialize(self)
    }

    #[inline]
    fn serialize_unit(self) -> Result<Self::Ok, Self::Error> {
        Ok(())
    }

    #[inline]
    fn serialize_unit_struct(self, _name: &'static str) -> Result<Self::Ok, Self::Error> {
        Ok(())
    }

    #[inline]
    fn serialize_unit_variant(
        self,
        name: &'static str,
        variant_index: u32,
        variant: &'static str,
    ) -> Result<Self::Ok, Self::Error> {
        let variant: u8 = variant_index
            .try_into()
            .map_err(|_| SerializerError::InvalidEnumVariant(name, variant_index, variant))?;

        self.writer
            .write_all(&[variant])
            .map_err(SerializerError::from)
    }

    #[inline]
    fn serialize_newtype_struct<T: ?Sized + Serialize>(
        self,
        _name: &'static str,
        value: &T,
    ) -> Result<Self::Ok, Self::Error> {
        value.serialize(self)
    }

    #[inline]
    fn serialize_newtype_variant<T: ?Sized + Serialize>(
        self,
        name: &'static str,
        variant_index: u32,
        variant: &'static str,
        value: &T,
    ) -> Result<Self::Ok, Self::Error> {
        let variant: u8 = variant_index
            .try_into()
            .map_err(|_| SerializerError::InvalidEnumVariant(name, variant_index, variant))?;

        self.writer.write_all(&[variant])?;
        value.serialize(self)
    }

    /// We use the fact that len can be None here to optionally not prefix a sequence when we
    /// serialize. This allows us to disable length prefixing optionally when writing serializers
    /// by hand. See `PrefixlessVec` for an example.
    #[inline]
    fn serialize_seq(self, len: Option<usize>) -> Result<Self::SerializeSeq, Self::Error> {
        if let Some(len) = len {
            let len = u8::try_from(len).map_err(|_| SerializerError::SequenceTooLarge(len))?;
            self.writer.write_all(&[len])?;
        }

        Ok(self)
    }

    #[inline]
    fn serialize_tuple(self, _len: usize) -> Result<Self::SerializeTuple, Self::Error> {
        Ok(self)
    }

    #[inline]
    fn serialize_tuple_struct(
        self,
        _name: &'static str,
        _len: usize,
    ) -> Result<Self::SerializeTupleStruct, Self::Error> {
        Ok(self)
    }

    #[inline]
    fn serialize_tuple_variant(
        self,
        name: &'static str,
        variant_index: u32,
        variant: &'static str,
        _len: usize,
    ) -> Result<Self::SerializeTupleVariant, Self::Error> {
        let variant: u8 = variant_index
            .try_into()
            .map_err(|_| SerializerError::InvalidEnumVariant(name, variant_index, variant))?;

        self.writer.write_all(&[variant])?;
        Ok(self)
    }

    #[inline]
    fn serialize_map(self, len: Option<usize>) -> Result<Self::SerializeMap, Self::Error> {
        let len = len
            .ok_or(SerializerError::SequenceLengthUnknown)
            .and_then(|len| {
                u8::try_from(len).map_err(|_| SerializerError::SequenceTooLarge(len))
            })?;

        self.writer.write_all(&[len])?;
        Ok(self)
    }

    #[inline]
    fn serialize_struct(
        self,
        _name: &'static str,
        _len: usize,
    ) -> Result<Self::SerializeStruct, Self::Error> {
        Ok(self)
    }

    #[inline]
    fn serialize_struct_variant(
        self,
        name: &'static str,
        variant_index: u32,
        variant: &'static str,
        _len: usize,
    ) -> Result<Self::SerializeStructVariant, Self::Error> {
        let variant: u8 = variant_index
            .try_into()
            .map_err(|_| SerializerError::InvalidEnumVariant(name, variant_index, variant))?;

        self.writer.write_all(&[variant])?;
        Ok(self)
    }

    fn is_human_readable(&self) -> bool {
        false
    }

    fn collect_str<T: ?Sized + Display>(self, value: &T) -> Result<Self::Ok, Self::Error> {
        self.serialize_str(&value.to_string())
    }
}

impl<'a, W: Write, B: ByteOrder> SerializeSeq for &'a mut Serializer<W, B> {
    type Ok = ();
    type Error = SerializerError;

    #[inline]
    fn serialize_element<T: ?Sized + Serialize>(&mut self, value: &T) -> Result<(), Self::Error> {
        value.serialize(&mut **self)
    }

    fn end(self) -> Result<Self::Ok, Self::Error> {
        Ok(())
    }
}

impl<'a, W: Write, B: ByteOrder> SerializeTuple for &'a mut Serializer<W, B> {
    type Ok = ();
    type Error = SerializerError;

    #[inline]
    fn serialize_element<T: ?Sized + Serialize>(&mut self, value: &T) -> Result<(), Self::Error> {
        value.serialize(&mut **self)
    }

    fn end(self) -> Result<Self::Ok, Self::Error> {
        Ok(())
    }
}

impl<'a, W: Write, B: ByteOrder> SerializeTupleStruct for &'a mut Serializer<W, B> {
    type Ok = ();
    type Error = SerializerError;

    #[inline]
    fn serialize_field<T: ?Sized + Serialize>(&mut self, value: &T) -> Result<(), Self::Error> {
        value.serialize(&mut **self)
    }

    fn end(self) -> Result<Self::Ok, Self::Error> {
        Ok(())
    }
}

impl<'a, W: Write, B: ByteOrder> SerializeTupleVariant for &'a mut Serializer<W, B> {
    type Ok = ();
    type Error = SerializerError;

    #[inline]
    fn serialize_field<T: ?Sized + Serialize>(&mut self, value: &T) -> Result<(), Self::Error> {
        value.serialize(&mut **self)
    }

    fn end(self) -> Result<Self::Ok, Self::Error> {
        Ok(())
    }
}

impl<'a, W: Write, B: ByteOrder> SerializeMap for &'a mut Serializer<W, B> {
    type Ok = ();
    type Error = SerializerError;

    #[inline]
    fn serialize_key<T: ?Sized + Serialize>(&mut self, key: &T) -> Result<(), Self::Error> {
        key.serialize(&mut **self)
    }

    #[inline]
    fn serialize_value<T: ?Sized + Serialize>(&mut self, value: &T) -> Result<(), Self::Error> {
        value.serialize(&mut **self)
    }

    fn end(self) -> Result<Self::Ok, Self::Error> {
        Ok(())
    }
}

impl<'a, W: Write, B: ByteOrder> SerializeStruct for &'a mut Serializer<W, B> {
    type Ok = ();
    type Error = SerializerError;

    #[inline]
    fn serialize_field<T: ?Sized + Serialize>(
        &mut self,
        _key: &'static str,
        value: &T,
    ) -> Result<(), Self::Error> {
        value.serialize(&mut **self)
    }

    fn end(self) -> Result<Self::Ok, Self::Error> {
        Ok(())
    }
}

impl<'a, W: Write, B: ByteOrder> SerializeStructVariant for &'a mut Serializer<W, B> {
    type Ok = ();
    type Error = SerializerError;

    #[inline]
    fn serialize_field<T: ?Sized + Serialize>(
        &mut self,
        _key: &'static str,
        value: &T,
    ) -> Result<(), Self::Error> {
        value.serialize(&mut **self)
    }

    fn end(self) -> Result<Self::Ok, Self::Error> {
        Ok(())
    }
}
