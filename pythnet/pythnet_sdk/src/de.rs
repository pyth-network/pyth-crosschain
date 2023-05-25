use {
    byteorder::{
        ByteOrder,
        ReadBytesExt,
    },
    serde::{
        de::{
            EnumAccess,
            IntoDeserializer,
            MapAccess,
            SeqAccess,
            VariantAccess,
        },
        Deserialize,
    },
    std::io::{
        Cursor,
        Seek,
        SeekFrom,
    },
    thiserror::Error,
};

pub fn from_slice<'de, B, T>(bytes: &'de [u8]) -> Result<T, DeserializeError>
where
    T: Deserialize<'de>,
    B: ByteOrder,
{
    let mut deserializer = Deserializer::<B>::new(bytes);
    T::deserialize(&mut deserializer)
}

#[derive(Debug, Error)]
pub enum DeserializeError {
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

impl serde::de::Error for DeserializeError {
    fn custom<T: std::fmt::Display>(msg: T) -> Self {
        DeserializeError::Message(msg.to_string().into_boxed_str())
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
    type Error = DeserializeError;

    fn deserialize_any<V>(self, _visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        Err(DeserializeError::Unsupported)
    }

    fn deserialize_ignored_any<V>(self, _visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        Err(DeserializeError::Unsupported)
    }

    fn deserialize_bool<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self.cursor.read_u8().map_err(DeserializeError::from)?;
        visitor.visit_bool(value != 0)
    }

    fn deserialize_i8<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self.cursor.read_i8().map_err(DeserializeError::from)?;
        visitor.visit_i8(value)
    }

    fn deserialize_i16<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self
            .cursor
            .read_i16::<B>()
            .map_err(DeserializeError::from)?;

        visitor.visit_i16(value)
    }

    fn deserialize_i32<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self
            .cursor
            .read_i32::<B>()
            .map_err(DeserializeError::from)?;

        visitor.visit_i32(value)
    }

    fn deserialize_i64<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self
            .cursor
            .read_i64::<B>()
            .map_err(DeserializeError::from)?;

        visitor.visit_i64(value)
    }

    fn deserialize_u8<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self.cursor.read_u8().map_err(DeserializeError::from)?;
        visitor.visit_u8(value)
    }

    fn deserialize_u16<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self
            .cursor
            .read_u16::<B>()
            .map_err(DeserializeError::from)?;

        visitor.visit_u16(value)
    }

    fn deserialize_u32<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self
            .cursor
            .read_u32::<B>()
            .map_err(DeserializeError::from)?;

        visitor.visit_u32(value)
    }

    fn deserialize_u64<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let value = self
            .cursor
            .read_u64::<B>()
            .map_err(DeserializeError::from)?;

        visitor.visit_u64(value)
    }

    fn deserialize_f32<V>(self, _visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        Err(DeserializeError::Unsupported)
    }

    fn deserialize_f64<V>(self, _visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        Err(DeserializeError::Unsupported)
    }

    fn deserialize_char<V>(self, _visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        Err(DeserializeError::Unsupported)
    }

    fn deserialize_str<V>(self, visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let len = self.cursor.read_u8().map_err(DeserializeError::from)? as u64;

        // Because cursor read methods copy the data out of the internal buffer,
        // where we want a pointer, we need to move the cursor forward first
        // (because the ) get_ref() call triggers a borrow), and then read
        // after.
        self.cursor
            .seek(SeekFrom::Current(len as i64))
            .map_err(DeserializeError::from)?;

        let buf = {
            let buf = self.cursor.get_ref();
            buf[(self.cursor.position() - len) as usize..]
                .get(..len as usize)
                .ok_or(DeserializeError::Eof)?
        };

        visitor.visit_borrowed_str(std::str::from_utf8(buf).map_err(DeserializeError::from)?)
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
        let len = self.cursor.read_u8().map_err(DeserializeError::from)? as u64;

        // See comment in deserialize_str for the reason for the subtraction.
        self.cursor
            .seek(SeekFrom::Current(len as i64))
            .map_err(DeserializeError::from)?;

        let buf = {
            let buf = self.cursor.get_ref();
            buf[(self.cursor.position() - len) as usize..]
                .get(..len as usize)
                .ok_or(DeserializeError::Eof)?
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
        Err(DeserializeError::Unsupported)
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
        let len = self.cursor.read_u8().map_err(DeserializeError::from)? as usize;
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
        let len = self.cursor.read_u8().map_err(DeserializeError::from)? as usize;
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
        _variants: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        let variant = self.cursor.read_u8().map_err(DeserializeError::from)?;
        visitor.visit_enum(Enum { de: self, variant })
    }

    fn deserialize_identifier<V>(self, _visitor: V) -> Result<V::Value, Self::Error>
    where
        V: serde::de::Visitor<'de>,
    {
        Err(DeserializeError::Unsupported)
    }
}

impl<'de, 'a, B: ByteOrder> VariantAccess<'de> for &'a mut Deserializer<'de, B> {
    type Error = DeserializeError;

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
    de:  &'a mut Deserializer<'de, B>,
    len: usize,
}

impl<'de, 'a, B: ByteOrder> SequenceIterator<'de, 'a, B> {
    fn new(de: &'a mut Deserializer<'de, B>, len: usize) -> Self {
        Self { de, len }
    }
}

impl<'de, 'a, B: ByteOrder> SeqAccess<'de> for SequenceIterator<'de, 'a, B> {
    type Error = DeserializeError;

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
    type Error = DeserializeError;

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
    de:      &'a mut Deserializer<'de, B>,
    variant: u8,
}

impl<'de, 'a, B: ByteOrder> EnumAccess<'de> for Enum<'de, 'a, B> {
    type Error = DeserializeError;
    type Variant = &'a mut Deserializer<'de, B>;

    fn variant_seed<V>(self, seed: V) -> Result<(V::Value, Self::Variant), Self::Error>
    where
        V: serde::de::DeserializeSeed<'de>,
    {
        seed.deserialize(self.variant.into_deserializer())
            .map(|v| (v, self.de))
    }
}
