//! By default, serde does not know how to parse fixed length arrays of sizes
//! that aren't common (I.E: 32) Here we provide a module that can be used to
//! serialize arrays that relies on const generics.
//!
//! Usage:
//!
//! ```rust,ignore`
//! #[derive(Serialize)]
//! struct Example {
//!     #[serde(with = "array")]
//!     array: [u8; 55],
//! }
//! ```
use {
    serde::{Deserialize, Serialize, Serializer},
    std::mem::MaybeUninit,
};

/// Serialize an array of size N using a const generic parameter to drive serialize_seq.
pub fn serialize<S, T, const N: usize>(array: &[T; N], serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
    T: Serialize,
{
    use serde::ser::SerializeTuple;
    let mut seq = serializer.serialize_tuple(N)?;
    array.iter().try_for_each(|e| seq.serialize_element(e))?;
    seq.end()
}

/// A visitor that carries type-level information about the length of the array we want to
/// deserialize.
struct ArrayVisitor<T, const N: usize> {
    _marker: std::marker::PhantomData<T>,
}

/// Implement a Visitor over our ArrayVisitor that knows how many times to
/// call next_element using the generic.
impl<'de, T, const N: usize> serde::de::Visitor<'de> for ArrayVisitor<T, N>
where
    T: Deserialize<'de>,
{
    type Value = [T; N];

    fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(formatter, "an array of length {N}")
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
