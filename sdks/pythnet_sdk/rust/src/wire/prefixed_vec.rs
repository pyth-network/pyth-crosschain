use {
    borsh::{BorshDeserialize, BorshSerialize},
    serde::{
        de::DeserializeSeed,
        ser::{SerializeSeq, SerializeStruct},
        Deserialize, Serialize,
    },
};

/// PrefixlessVec overrides the serialization to _not_ write a length prefix.
#[derive(Clone, Debug, Hash, PartialEq, PartialOrd, BorshDeserialize, BorshSerialize)]
struct PrefixlessVec<T> {
    inner: Vec<T>,
}

impl<T> Serialize for PrefixlessVec<T>
where
    T: Serialize,
{
    #[inline]
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut seq = serializer.serialize_seq(None)?;
        for item in &self.inner {
            seq.serialize_element(item)?;
        }
        seq.end()
    }
}

struct PrefixlessSeed<T> {
    __phantom: std::marker::PhantomData<T>,
    len: usize,
}

/// We implement DeserializeSeed for PrefixlessSeed which is aware of the len that should be read
/// for the Vec, this len would have been found previously during parsing the PrefixedVec which
/// will drive this deserializer forward. The result is a PrefixlessVec<T> which is intended to
/// be read by the PrefixedVec deserializer.
impl<'de, T> DeserializeSeed<'de> for PrefixlessSeed<T>
where
    T: Deserialize<'de>,
{
    type Value = PrefixlessVec<T>;

    fn deserialize<D: serde::Deserializer<'de>>(
        self,
        deserializer: D,
    ) -> Result<Self::Value, D::Error> {
        struct PrefixlessVecVisitor<T> {
            len: usize,
            __phantom: std::marker::PhantomData<T>,
        }

        impl<'de, T> serde::de::Visitor<'de> for PrefixlessVecVisitor<T>
        where
            T: Deserialize<'de>,
        {
            type Value = PrefixlessVec<T>;

            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("struct PrefixlessVec")
            }

            #[inline]
            fn visit_seq<V>(self, mut seq: V) -> Result<PrefixlessVec<T>, V::Error>
            where
                V: serde::de::SeqAccess<'de>,
            {
                let mut data = Vec::with_capacity(self.len);
                for i in 0..self.len {
                    data.push(
                        seq.next_element::<T>()?
                            .ok_or_else(|| serde::de::Error::invalid_length(i, &"PrefixlessVec"))?,
                    );
                }

                Ok(PrefixlessVec { inner: data })
            }
        }

        deserializer.deserialize_tuple(
            self.len,
            PrefixlessVecVisitor {
                len: self.len,
                __phantom: std::marker::PhantomData,
            },
        )
    }
}

/// PrefixedVec allows overriding the default u8 size of the length prefix for a Vec.
///
/// This is useful when the size of a Vec is greater than 255 and we wish to override the
/// Pyth serialization logic to use a u16 etc instead. This works by serializing the Vec
/// as a struct with a len field with the overridden type, when combined with PrefixlessVec
/// below the combination of `{ "len": L, "data": [T] }` is serialized as expected in the
/// wire format.
///
/// For non-Pyth formats this results in a struct which is the correct way to interpret our
/// data on chain anyway.
#[derive(Clone, Debug, Hash, PartialEq, PartialOrd, BorshDeserialize, BorshSerialize)]
pub struct PrefixedVec<L, T> {
    __phantom: std::marker::PhantomData<L>,
    data: PrefixlessVec<T>,
}

impl<L, T> From<Vec<T>> for PrefixedVec<L, T> {
    fn from(data: Vec<T>) -> Self {
        Self {
            __phantom: std::marker::PhantomData,
            data: PrefixlessVec { inner: data },
        }
    }
}

impl<L, T> From<PrefixedVec<L, T>> for Vec<T> {
    fn from(data: PrefixedVec<L, T>) -> Self {
        data.data.inner
    }
}

impl<L, T> AsRef<Vec<T>> for PrefixedVec<L, T> {
    fn as_ref(&self) -> &Vec<T> {
        &self.data.inner
    }
}

impl<L, T> IntoIterator for PrefixedVec<L, T> {
    type Item = T;
    type IntoIter = std::vec::IntoIter<Self::Item>;

    fn into_iter(self) -> Self::IntoIter {
        self.data.inner.into_iter()
    }
}

impl<L, T> PrefixedVec<L, T> {
    pub fn iter(&self) -> std::slice::Iter<T> {
        self.data.inner.iter()
    }
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
        let len: L = L::try_from(self.data.inner.len()).unwrap();
        let mut st = serializer.serialize_struct("SizedVec", 1)?;
        st.serialize_field("len", &len)?;
        st.serialize_field("data", &self.data)?;
        st.end()
    }
}

impl<'de, L, T> Deserialize<'de> for PrefixedVec<L, T>
where
    T: Deserialize<'de>,
    L: Deserialize<'de>,
    L: Into<usize>,
    L: Copy,
{
    #[inline]
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(field_identifier, rename_all = "lowercase")]
        enum Field {
            Len,
            Data,
        }

        struct PrefixedVecVisitor<L, T> {
            __phantom: std::marker::PhantomData<(L, T)>,
        }

        impl<'de, L, T> serde::de::Visitor<'de> for PrefixedVecVisitor<L, T>
        where
            T: Deserialize<'de>,
            L: Deserialize<'de>,
            L: Into<usize>,
            L: Copy,
        {
            type Value = PrefixedVec<L, T>;

            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("struct PrefixedVec")
            }

            #[inline]
            fn visit_seq<V>(self, mut seq: V) -> Result<PrefixedVec<L, T>, V::Error>
            where
                V: serde::de::SeqAccess<'de>,
            {
                // First we parse the expected size type from the wire format.
                let len: usize = seq
                    .next_element::<L>()?
                    .ok_or_else(|| serde::de::Error::invalid_length(0, &"PrefixlessVec"))?
                    .into();

                // We now rely on the PrefixlessVec deserializer to do the rest of the work. We
                // need to use the PrefixlessSeed to pass the expected size to the deserializer.
                let data = seq
                    .next_element_seed(PrefixlessSeed {
                        __phantom: std::marker::PhantomData,
                        len,
                    })?
                    .ok_or_else(|| serde::de::Error::invalid_length(1, &"PrefixlessVec"))?;

                Ok(PrefixedVec {
                    __phantom: std::marker::PhantomData,
                    data,
                })
            }
        }

        deserializer.deserialize_struct(
            "PrefixedVec",
            &["len", "data"],
            PrefixedVecVisitor {
                __phantom: std::marker::PhantomData,
            },
        )
    }
}

#[test]
fn test_borsh_roundtrip() {
    let prefixed_vec = PrefixedVec::<u16, u8>::from(vec![1, 2, 3, 4, 5]);
    let encoded = borsh::to_vec(&prefixed_vec).unwrap();
    assert_eq!(encoded, vec![5, 0, 0, 0, 1, 2, 3, 4, 5]);

    let decoded_prefixed_vec = PrefixedVec::<u16, u8>::try_from_slice(encoded.as_slice()).unwrap();
    assert_eq!(decoded_prefixed_vec, prefixed_vec);
}
