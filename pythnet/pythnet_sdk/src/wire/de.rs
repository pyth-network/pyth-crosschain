//! A module defining serde dserialize for the format described in ser.rs
//!
//! TL;DR: How to Use
//! ================================================================================
//!
//! ```rust,ignore
//! #[derive(Deserialize)]
//! struct ExampleStruct {
//!     a: (),
//!     b: bool,
//!     c: u8,
//!     ...,
//! }
//!
//! let bytes = ...;
//! let s: ExampleStruct = pythnet_sdk::de::from_slice::<LittleEndian, _>(&bytes)?;
//! ```
//!
//! The deserialization mechanism is a bit more complex than the serialization mechanism as it
//! employs a visitor pattern. Rather than describe it here, the serde documentation on how to
//! implement a deserializer can be found here:
//!
//! https://serde.rs/impl-deserializer.html

use {
    crate::require,
    byteorder::{ByteOrder, ReadBytesExt},
    serde::{
        de::{EnumAccess, MapAccess, SeqAccess, VariantAccess},
        Deserialize,
    },
    std::{
        io::{Cursor, Seek, SeekFrom},
        mem::size_of,
    },
    thiserror::Error,
};

/// Deserialize a Pyth wire-format buffer into a type.
///
/// Note that this method will not consume left-over bytes ore report errors. This is due to the
/// fact that the Pyth wire formatted is intended to allow for appending of new fields without
/// breaking backwards compatibility. As such, it is possible that a newer version of the format
/// will contain fields that are not known to the deserializer. This is not an error, and the
/// deserializer will simply ignore these fields.
pub fn from_slice<'de, B, T>(bytes: &'de [u8]) -> Result<T, DeserializerError>
where
    T: Deserialize<'de>,
    B: ByteOrder,
{
    let mut deserializer = Deserializer::<B>::new(bytes);
    T::deserialize(&mut deserializer)
}

#[derive(Debug, Error)]
pub enum DeserializerError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("invalid utf8: {0}")]
    Utf8(#[from] std::str::Utf8Error),

    #[error("this type is not supported")]
    Unsupported,

    #[error("sequence too large ({0} elements), max supported is 255")]
    SequenceTooLarge(usize),

    #[error("message: {0}")]
    Message(Box<str>),

    #[error("invalid enum variant, higher than expected variant range")]
    InvalidEnumVariant,

    #[error("eof")]
    Eof,
}

pub struct Deserializer<'de, B>
where
    B: ByteOrder,
{
    cursor: Cursor<&'de [u8]>,
    endian: std::marker::PhantomData<B>,
}

impl serde::de::Error for DeserializerError {
    fn custom<T: std::fmt::Display>(msg: T) -> Self {
        DeserializerError::Message(msg.to_string().into_boxed_str())
    }
}

impl<'de, B> Deserializer<'de, B>
where
    B: ByteOrder,
{
    pub fn new(buffer: &'de [u8]) -> Self {
        Self {
            cursor: Cursor::new(buffer),
            endian: std::marker::PhantomData,
        }
    }
}

impl<'de, B> serde::de::Deserializer<'de> for &'_ mut Deserializer<'de, B>
where
    B: ByteOrder,
{
    type Error = DeserializerError;

    fn deserialize_any<V>(self, _visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        Err(DeserializerError::Unsupported)
    }

    fn deserialize_ignored_any<V>(self, _visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        Err(DeserializerError::Unsupported)
    }

    fn deserialize_bool<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self.cursor.read_u8().map_err(DeserializerError::from)?;
        visitor.visit_bool(value != 0)
    }

    fn deserialize_i8<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self.cursor.read_i8().map_err(DeserializerError::from)?;
        visitor.visit_i8(value)
    }

    fn deserialize_i16<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self
            .cursor
            .read_i16::<B>()
            .map_err(DeserializerError::from)?;

        visitor.visit_i16(value)
    }

    fn deserialize_i32<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self
            .cursor
            .read_i32::<B>()
            .map_err(DeserializerError::from)?;

        visitor.visit_i32(value)
    }

    fn deserialize_i64<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self
            .cursor
            .read_i64::<B>()
            .map_err(DeserializerError::from)?;

        visitor.visit_i64(value)
    }

    fn deserialize_i128<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self
            .cursor
            .read_i128::<B>()
            .map_err(DeserializerError::from)?;

        visitor.visit_i128(value)
    }

    fn deserialize_u8<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self.cursor.read_u8().map_err(DeserializerError::from)?;
        visitor.visit_u8(value)
    }

    fn deserialize_u16<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self
            .cursor
            .read_u16::<B>()
            .map_err(DeserializerError::from)?;

        visitor.visit_u16(value)
    }

    fn deserialize_u32<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self
            .cursor
            .read_u32::<B>()
            .map_err(DeserializerError::from)?;

        visitor.visit_u32(value)
    }

    fn deserialize_u64<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self
            .cursor
            .read_u64::<B>()
            .map_err(DeserializerError::from)?;

        visitor.visit_u64(value)
    }

    fn deserialize_u128<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self
            .cursor
            .read_u128::<B>()
            .map_err(DeserializerError::from)?;

        visitor.visit_u128(value)
    }

    fn deserialize_f32<V>(self, _visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        Err(DeserializerError::Unsupported)
    }

    fn deserialize_f64<V>(self, _visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        Err(DeserializerError::Unsupported)
    }

    fn deserialize_char<V>(self, _visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        Err(DeserializerError::Unsupported)
    }

    fn deserialize_str<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let len = self.cursor.read_u8().map_err(DeserializerError::from)? as u64;

        // We cannot use cursor read methods as they copy the data out of the internal buffer,
        // where we actually want a pointer into that buffer. So instead, we take the internal
        // representation (the underlying &[u8]) and slice it to get the data we want. We then
        // advance the cursor to simulate the read.
        //
        // Note that we do the advance first because otherwise we run into a immutable->mutable
        // borrow issue, but the reverse is fine.
        self.cursor
            .seek(SeekFrom::Current(len as i64))
            .map_err(DeserializerError::from)?;

        let buf = {
            let buf = self.cursor.get_ref();
            buf[(self.cursor.position() - len) as usize..]
                .get(..len as usize)
                .ok_or(DeserializerError::Eof)?
        };

        visitor.visit_borrowed_str(std::str::from_utf8(buf).map_err(DeserializerError::from)?)
    }

    fn deserialize_string<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        self.deserialize_str(visitor)
    }

    fn deserialize_bytes<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let len = self.cursor.read_u8().map_err(DeserializerError::from)? as u64;

        // See comment in deserialize_str for an explanation of this code.
        self.cursor
            .seek(SeekFrom::Current(len as i64))
            .map_err(DeserializerError::from)?;

        let buf = {
            let buf = self.cursor.get_ref();
            buf[(self.cursor.position() - len) as usize..]
                .get(..len as usize)
                .ok_or(DeserializerError::Eof)?
        };

        visitor.visit_borrowed_bytes(buf)
    }

    fn deserialize_byte_buf<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        self.deserialize_bytes(visitor)
    }

    fn deserialize_option<V>(self, _visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        Err(DeserializerError::Unsupported)
    }

    fn deserialize_unit<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        visitor.visit_unit()
    }

    fn deserialize_unit_struct<V>(
        self,
        _name: &'static str,
        visitor: V,
    ) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        visitor.visit_unit()
    }

    fn deserialize_newtype_struct<V>(
        self,
        _name: &'static str,
        visitor: V,
    ) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        visitor.visit_newtype_struct(self)
    }

    fn deserialize_seq<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let len = self.cursor.read_u8().map_err(DeserializerError::from)? as usize;
        visitor.visit_seq(SequenceIterator::new(self, len))
    }

    fn deserialize_tuple<V>(self, len: usize, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        visitor.visit_seq(SequenceIterator::new(self, len))
    }

    fn deserialize_tuple_struct<V>(
        self,
        _name: &'static str,
        len: usize,
        visitor: V,
    ) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        visitor.visit_seq(SequenceIterator::new(self, len))
    }

    fn deserialize_map<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let len = self.cursor.read_u8().map_err(DeserializerError::from)? as usize;
        visitor.visit_map(SequenceIterator::new(self, len))
    }

    fn deserialize_struct<V>(
        self,
        _name: &'static str,
        fields: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        visitor.visit_seq(SequenceIterator::new(self, fields.len()))
    }

    fn deserialize_enum<V>(
        self,
        _name: &'static str,
        variants: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        // We read the discriminator here so that we can make the expected enum variant available
        // to the `visit_enum` call.
        let variant = self.cursor.read_u8().map_err(DeserializerError::from)?;
        if variant >= variants.len() as u8 {
            return Err(DeserializerError::InvalidEnumVariant);
        }

        visitor.visit_enum(Enum { de: self, variant })
    }

    fn deserialize_identifier<V>(self, _visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        Err(DeserializerError::Unsupported)
    }
}

impl<'de, 'a, B: ByteOrder> VariantAccess<'de> for &'a mut Deserializer<'de, B> {
    type Error = DeserializerError;

    fn unit_variant(self) -> Result<(), Self::Error> {
        Ok(())
    }

    fn newtype_variant_seed<T>(self, seed: T) -> Result<T::Value, Self::Error>
    where
        T: serde::de::DeserializeSeed<'de>,
    {
        seed.deserialize(self)
    }

    fn tuple_variant<V>(self, len: usize, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        visitor.visit_seq(SequenceIterator::new(self, len))
    }

    fn struct_variant<V>(
        self,
        fields: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        visitor.visit_seq(SequenceIterator::new(self, fields.len()))
    }
}

struct SequenceIterator<'de, 'a, B: ByteOrder> {
    de: &'a mut Deserializer<'de, B>,
    len: usize,
}

impl<'de, 'a, B: ByteOrder> SequenceIterator<'de, 'a, B> {
    fn new(de: &'a mut Deserializer<'de, B>, len: usize) -> Self {
        Self { de, len }
    }
}

impl<'de, 'a, B: ByteOrder> SeqAccess<'de> for SequenceIterator<'de, 'a, B> {
    type Error = DeserializerError;

    fn next_element_seed<T>(&mut self, seed: T) -> Result<Option<T::Value>, Self::Error>
    where
        T: serde::de::DeserializeSeed<'de>,
    {
        if self.len == 0 {
            return Ok(None);
        }

        self.len -= 1;
        seed.deserialize(&mut *self.de).map(Some)
    }

    fn size_hint(&self) -> Option<usize> {
        Some(self.len)
    }
}

impl<'de, 'a, B: ByteOrder> MapAccess<'de> for SequenceIterator<'de, 'a, B> {
    type Error = DeserializerError;

    fn next_key_seed<K>(&mut self, seed: K) -> Result<Option<K::Value>, Self::Error>
    where
        K: serde::de::DeserializeSeed<'de>,
    {
        if self.len == 0 {
            return Ok(None);
        }

        self.len -= 1;
        seed.deserialize(&mut *self.de).map(Some)
    }

    fn next_value_seed<V>(&mut self, seed: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::DeserializeSeed<'de>,
    {
        seed.deserialize(&mut *self.de)
    }

    fn size_hint(&self) -> Option<usize> {
        Some(self.len)
    }
}

struct Enum<'de, 'a, B: ByteOrder> {
    de: &'a mut Deserializer<'de, B>,
    variant: u8,
}

impl<'de, 'a, B: ByteOrder> EnumAccess<'de> for Enum<'de, 'a, B> {
    type Error = DeserializerError;
    type Variant = &'a mut Deserializer<'de, B>;

    fn variant_seed<V>(self, _: V) -> Result<(V::Value, Self::Variant), Self::Error>
    where
        V: serde::de::DeserializeSeed<'de>,
    {
        // When serializing/deserializing, serde passes a variant_index into the handlers. We
        // currently write these as u8's and have already parsed' them during deserialize_enum
        // before we reach this point.
        //
        // Normally, when deserializing enum tags from a wire format that does not match the
        // expected size, we would use a u*.into_deserializer() to feed the already parsed
        // result into the visit_u64 visitor method during `__Field` deserialize.
        //
        // The problem with this however is during `visit_u64`, there is a possibility the
        // enum variant is not valid, which triggers Serde to return an `Unexpected` error.
        // These errors have the unfortunate side effect of triggering Rust including float
        // operations in the resulting binary, which breaks WASM environments.
        //
        // To work around this, we rely on the following facts:
        //
        // - variant_index in Serde is always 0 indexed and contiguous
        // - transmute_copy into a 0 sized type is safe
        // - transmute_copy is safe to cast into __Field as long as u8 >= size_of::<__Field>()
        //
        // This behaviour relies on serde not changing its enum deserializer generation, but
        // this would be a major backwards compatibility break for them so we should be safe.
        require!(
            size_of::<u8>() >= size_of::<V::Value>(),
            DeserializerError::InvalidEnumVariant
        );

        Ok((
            unsafe { std::mem::transmute_copy::<u8, V::Value>(&self.variant) },
            self.de,
        ))
    }
}
