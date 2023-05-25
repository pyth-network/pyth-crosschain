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
//! let mut cur = Cursor::new(&mut buf);
//! pythnet_sdk::ser::to_writer(&mut cur, &ExampleStruct { ... }).unwrap();
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
//! The macro will expand into (a more complicated but equivelent) version of:
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
//! very close to equivelent performance to a hand written implementation.
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
//! - `{u,i}16/32/64` are serialized as bytes specified by the parser endianess type param.
//! - `{u,i}128` is not supported.
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
    byteorder::{
        ByteOrder,
        WriteBytesExt,
    },
    serde::{
        ser::{
            SerializeMap,
            SerializeSeq,
            SerializeStruct,
            SerializeStructVariant,
            SerializeTuple,
            SerializeTupleStruct,
            SerializeTupleVariant,
        },
        Serialize,
    },
    std::{
        fmt::Display,
        io::Write,
    },
    thiserror::Error,
};

pub fn to_vec<T, B>(value: &T) -> Result<Vec<u8>, SerializeError>
where
    T: Serialize,
    B: ByteOrder,
{
    let mut buf = Vec::new();
    value.serialize(&mut Serializer::<_, B>::new(&mut buf))?;
    Ok(buf)
}

#[derive(Debug, Error)]
pub enum SerializeError {
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

#[derive(Clone, Debug, Hash, PartialEq, PartialOrd, Error, serde::Deserialize)]
pub struct PrefixedVec<L, T> {
    data:      PrefixlessVec<T>,
    __phantom: std::marker::PhantomData<L>,
}

impl<T, L> From<Vec<T>> for PrefixedVec<L, T> {
    fn from(data: Vec<T>) -> Self {
        Self {
            data:      PrefixlessVec { data },
            __phantom: std::marker::PhantomData,
        }
    }
}

#[derive(Clone, Debug, Hash, PartialEq, PartialOrd, Error, serde::Deserialize)]
struct PrefixlessVec<T> {
    data: Vec<T>,
}

impl<L, T> Serialize for PrefixedVec<L, T>
where
    T: Serialize,
    L: Serialize,
    L: TryFrom<usize>,
    <L as TryFrom<usize>>::Error: std::fmt::Debug,
{
    #[inline]
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let len: L = L::try_from(self.data.data.len()).unwrap();
        let mut st = serializer.serialize_struct("SizedVec", 1)?;
        st.serialize_field("len", &len)?;
        st.serialize_field("data", &self.data)?;
        st.end()
    }
}

impl<T> Serialize for PrefixlessVec<T>
where
    T: Serialize,
{
    #[inline]
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut seq = serializer.serialize_seq(None)?;
        for item in &self.data {
            seq.serialize_element(item)?;
        }
        seq.end()
    }
}

/// A type for Pyth's common serialization format. Note that a ByteOrder type param is required as
/// we serialize in both big and little endian depending on different use-cases.
#[derive(Clone)]
pub struct Serializer<W: Write, B: ByteOrder> {
    writer:  W,
    _endian: std::marker::PhantomData<B>,
}

impl serde::ser::Error for SerializeError {
    fn custom<T: Display>(msg: T) -> Self {
        SerializeError::Message(msg.to_string().into_boxed_str())
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
    type Error = SerializeError;

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
            .map_err(SerializeError::from)
    }

    #[inline]
    fn serialize_i8(self, v: i8) -> Result<Self::Ok, Self::Error> {
        self.writer
            .write_all(&[v as u8])
            .map_err(SerializeError::from)
    }

    #[inline]
    fn serialize_i16(self, v: i16) -> Result<Self::Ok, Self::Error> {
        self.writer.write_i16::<B>(v).map_err(SerializeError::from)
    }

    #[inline]
    fn serialize_i32(self, v: i32) -> Result<Self::Ok, Self::Error> {
        self.writer.write_i32::<B>(v).map_err(SerializeError::from)
    }

    #[inline]
    fn serialize_i64(self, v: i64) -> Result<Self::Ok, Self::Error> {
        self.writer.write_i64::<B>(v).map_err(SerializeError::from)
    }

    #[inline]
    fn serialize_u8(self, v: u8) -> Result<Self::Ok, Self::Error> {
        self.writer.write_all(&[v]).map_err(SerializeError::from)
    }

    #[inline]
    fn serialize_u16(self, v: u16) -> Result<Self::Ok, Self::Error> {
        self.writer.write_u16::<B>(v).map_err(SerializeError::from)
    }

    #[inline]
    fn serialize_u32(self, v: u32) -> Result<Self::Ok, Self::Error> {
        self.writer.write_u32::<B>(v).map_err(SerializeError::from)
    }

    #[inline]
    fn serialize_u64(self, v: u64) -> Result<Self::Ok, Self::Error> {
        self.writer.write_u64::<B>(v).map_err(SerializeError::from)
    }

    #[inline]
    fn serialize_f32(self, _: f32) -> Result<Self::Ok, Self::Error> {
        Err(SerializeError::Unsupported)
    }

    #[inline]
    fn serialize_f64(self, _: f64) -> Result<Self::Ok, Self::Error> {
        Err(SerializeError::Unsupported)
    }

    #[inline]
    fn serialize_char(self, _: char) -> Result<Self::Ok, Self::Error> {
        Err(SerializeError::Unsupported)
    }

    #[inline]
    fn serialize_str(self, v: &str) -> Result<Self::Ok, Self::Error> {
        let len = u8::try_from(v.len()).map_err(|_| SerializeError::SequenceTooLarge(v.len()))?;
        self.writer.write_all(&[len])?;
        self.writer
            .write_all(v.as_bytes())
            .map_err(SerializeError::from)
    }

    #[inline]
    fn serialize_bytes(self, v: &[u8]) -> Result<Self::Ok, Self::Error> {
        let len = u8::try_from(v.len()).map_err(|_| SerializeError::SequenceTooLarge(v.len()))?;
        self.writer.write_all(&[len])?;
        self.writer.write_all(v).map_err(SerializeError::from)
    }

    #[inline]
    fn serialize_none(self) -> Result<Self::Ok, Self::Error> {
        Err(SerializeError::Unsupported)
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
            .map_err(|_| SerializeError::InvalidEnumVariant(name, variant_index, variant))?;

        self.writer
            .write_all(&[variant])
            .map_err(SerializeError::from)
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
            .map_err(|_| SerializeError::InvalidEnumVariant(name, variant_index, variant))?;

        self.writer.write_all(&[variant])?;
        value.serialize(self)
    }

    #[inline]
    fn serialize_seq(self, len: Option<usize>) -> Result<Self::SerializeSeq, Self::Error> {
        if let Some(len) = len {
            let len = u8::try_from(len).map_err(|_| SerializeError::SequenceTooLarge(len))?;
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
            .map_err(|_| SerializeError::InvalidEnumVariant(name, variant_index, variant))?;

        self.writer.write_all(&[variant])?;
        Ok(self)
    }

    #[inline]
    fn serialize_map(self, len: Option<usize>) -> Result<Self::SerializeMap, Self::Error> {
        let len = len
            .ok_or(SerializeError::SequenceLengthUnknown)
            .and_then(|len| u8::try_from(len).map_err(|_| SerializeError::SequenceTooLarge(len)))?;

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
            .map_err(|_| SerializeError::InvalidEnumVariant(name, variant_index, variant))?;

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
    type Error = SerializeError;

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
    type Error = SerializeError;

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
    type Error = SerializeError;

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
    type Error = SerializeError;

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
    type Error = SerializeError;

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
    type Error = SerializeError;

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
    type Error = SerializeError;

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

// By default, serde does not know how to parse fixed length arrays of sizes
// that aren't common (I.E: 32) Here we provide a module that can be used to
// serialize arrays that relies on const generics.
//
// Usage:
//
// ```rust,ignore`
// #[derive(Serialize)]
// struct Example {
//     #[serde(with = "array")]
//     array: [u8; 55],
// }
// ```
pub mod array {
    use std::mem::MaybeUninit;

    /// Serialize an array of size N using a const generic parameter to drive serialize_seq.
    pub fn serialize<S, T, const N: usize>(array: &[T; N], serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
        T: serde::Serialize,
    {
        use serde::ser::SerializeTuple;
        let mut seq = serializer.serialize_tuple(N)?;
        array.iter().try_for_each(|e| seq.serialize_element(e))?;
        seq.end()
    }

    /// A Marer type that carries type-level information about the length of the
    /// array we want to deserialize.
    struct ArrayVisitor<T, const N: usize> {
        _marker: std::marker::PhantomData<T>,
    }

    /// Implement a Visitor over our ArrayVisitor that knows how many times to
    /// call next_element using the generic.
    impl<'de, T, const N: usize> serde::de::Visitor<'de> for ArrayVisitor<T, N>
    where
        T: serde::de::Deserialize<'de>,
    {
        type Value = [T; N];

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            write!(formatter, "an array of length {}", N)
        }

        fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
        where
            A: serde::de::SeqAccess<'de>,
        {
            // We use MaybeUninit to allocate the right amount of memory
            // because we do not know if `T` has a constructor or a default.
            // Without this we would have to allocate a Vec.
            let mut array = MaybeUninit::<[T; N]>::uninit();
            let ptr = array.as_mut_ptr() as *mut T;
            let mut pos = 0;
            while pos < N {
                let next = seq
                    .next_element()?
                    .ok_or_else(|| serde::de::Error::invalid_length(pos, &self))?;

                unsafe {
                    std::ptr::write(ptr.add(pos), next);
                }

                pos += 1;
            }

            // We only succeed if we fully filled the array. This prevents
            // accidentally returning garbage.
            if pos == N {
                return Ok(unsafe { array.assume_init() });
            }

            Err(serde::de::Error::invalid_length(pos, &self))
        }
    }

    /// Deserialize an array with an ArrayVisitor aware of `N` during deserialize.
    pub fn deserialize<'de, D, T, const N: usize>(deserializer: D) -> Result<[T; N], D::Error>
    where
        D: serde::Deserializer<'de>,
        T: serde::de::Deserialize<'de>,
    {
        deserializer.deserialize_tuple(
            N,
            ArrayVisitor {
                _marker: std::marker::PhantomData,
            },
        )
    }
}

#[cfg(test)]
mod tests {
    use super::{
        super::de::Deserializer,
        array,
        Serializer,
    };

    // Test the arbitrary fixed sized array serialization implementation.
    #[test]
    fn test_array_serde() {
        // Serialize an array into a buffer.
        let mut buffer = Vec::new();
        let mut cursor = std::io::Cursor::new(&mut buffer);
        let mut serializer: Serializer<_, byteorder::LE> = Serializer::new(&mut cursor);
        array::serialize(&[1u8; 37], &mut serializer).unwrap();

        // The result should not have been prefixed with a length byte.
        assert_eq!(buffer.len(), 37);

        // We should also be able to deserialize it back.
        let mut deserializer = Deserializer::<byteorder::LE>::new(&buffer);
        let deserialized: [u8; 37] = array::deserialize(&mut deserializer).unwrap();

        // The deserialized array should be the same as the original.
        assert_eq!(deserialized, [1u8; 37]);
    }

    // The array serializer should not interfere with other serializers. Here we
    // check serde_json to make sure an array is written as expected.
    #[test]
    fn test_array_serde_json() {
        // Serialize an array into a buffer.
        let mut buffer = Vec::new();
        let mut cursor = std::io::Cursor::new(&mut buffer);
        let mut serialized = serde_json::Serializer::new(&mut cursor);
        array::serialize(&[1u8; 7], &mut serialized).unwrap();
        let result = String::from_utf8(buffer).unwrap();
        assert_eq!(result, "[1,1,1,1,1,1,1]");

        // Deserializing should also work.
        let mut deserializer = serde_json::Deserializer::from_str(&result);
        let deserialized: [u8; 7] = array::deserialize(&mut deserializer).unwrap();
        assert_eq!(deserialized, [1u8; 7]);
    }

    // Golden Structure Test
    //
    // This test serializes a struct containing all the expected types we should
    // be able to handle and checks the output is as expected. The reason I
    // opted to serialize all in one struct instead of with separate tests is to
    // ensure that the positioning of elements when in relation to others is
    // also as expected. Especially when it comes to things such as nesting and
    // length prefixing.
    #[test]
    fn test_pyth_serde() {
        use serde::Serialize;

        // Setup Serializer.
        let mut buffer = Vec::new();
        let mut cursor = std::io::Cursor::new(&mut buffer);
        let mut serializer: Serializer<_, byteorder::LE> = Serializer::new(&mut cursor);

        // Golden Test Value. As binary data can be fickle to understand in
        // tests this should be kept commented with detail.
        #[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq)]
        struct GoldenStruct<'a> {
            // Test `unit` is not serialized to anything.
            unit: (),

            // Test `bool` is serialized to a single byte.
            t_bool: bool,

            // Test integer serializations.
            t_u8:  u8,
            t_u16: u16,
            t_u32: u32,
            t_u64: u64,

            // Test `str` is serialized to a variable length array.
            t_string: String,
            t_str:    &'a str,

            // Test `Vec` is serialized to a variable length array.
            t_vec:              Vec<u8>,
            t_vec_empty:        Vec<u8>,
            t_vec_nested:       Vec<Vec<u8>>,
            t_vec_nested_empty: Vec<Vec<u8>>,
            t_slice:            &'a [u8],
            t_slice_empty:      &'a [u8],

            // Test tuples serialize as expected.
            t_tuple:        (u8, u16, u32, u64, String, Vec<u8>, &'a [u8]),
            t_tuple_nested: ((u8, u16), (u32, u64)),

            // Test enum serializations.
            t_enum_unit:    GoldenEnum,
            t_enum_newtype: GoldenEnum,
            t_enum_tuple:   GoldenEnum,
            t_enum_struct:  GoldenEnum,
        }

        #[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq)]
        enum GoldenEnum {
            UnitVariant,
            NewtypeVariant(u8),
            TupleVariant(u8, u16),
            StructVariant { a: u8, b: u16 },
        }

        // Serialize the golden test value.
        let golden_struct = GoldenStruct {
            unit:               (),
            t_bool:             true,
            t_u8:               1,
            t_u16:              2,
            t_u32:              3,
            t_u64:              4,
            t_string:           "9".to_string(),
            t_str:              "10",
            t_vec:              vec![11, 12, 13],
            t_vec_empty:        vec![],
            t_vec_nested:       vec![vec![14, 15, 16], vec![17, 18, 19]],
            t_vec_nested_empty: vec![vec![], vec![]],
            t_slice:            &[20, 21, 22],
            t_slice_empty:      &[],
            t_tuple:            (
                29,
                30,
                31,
                32,
                "10".to_string(),
                vec![35, 36, 37],
                &[38, 39, 40],
            ),
            t_tuple_nested:     ((41, 42), (43, 44)),
            t_enum_unit:        GoldenEnum::UnitVariant,
            t_enum_newtype:     GoldenEnum::NewtypeVariant(45),
            t_enum_tuple:       GoldenEnum::TupleVariant(46, 47),
            t_enum_struct:      GoldenEnum::StructVariant { a: 48, b: 49 },
        };

        golden_struct.serialize(&mut serializer).unwrap();

        // The serialized output should be as expected.
        assert_eq!(
            &buffer,
            &[
                1, // t_bool
                1, // t_u8
                2, 0, // t_u16
                3, 0, 0, 0, // t_u32
                4, 0, 0, 0, 0, 0, 0, 0, // t_u64
                1, 57, // t_string
                2, 49, 48, // t_str
                3, 11, 12, 13, // t_vec
                0,  // t_vec_empty
                2, 3, 14, 15, 16, 3, 17, 18, 19, // t_vec_nested
                2, 0, 0, // t_vec_nested_empty
                3, 20, 21, 22, // t_slice
                0,  // t_slice_empty
                29, // t_tuple
                30, 0, // u8
                31, 0, 0, 0, // u16
                32, 0, 0, 0, 0, 0, 0, 0, // u32
                2, 49, 48, // "10"
                3, 35, 36, 37, // [35, 36, 37]
                3, 38, 39, 40, // [38, 39, 40]
                41, 42, 0, 43, 0, 0, 0, 44, 0, 0, 0, 0, 0, 0, 0, // t_tuple_nested
                0, // t_enum_unit
                1, 45, // t_enum_newtype
                2, 46, 47, 0, // t_enum_tuple
                3, 48, 49, 0, // t_enum_struct
            ]
        );
    }
}
