//! Pyth Wire Format
//!
//! Pyth uses a custom wire format when moving data between programs and chains. This module
//! provides the serialization and deserialization logic for this format as well as definitions of
//! data structures used in the PythNet ecosystem.
//!
//! See the `ser` submodule for a description of the Pyth Wire format.

pub mod array;
mod de;
mod prefixed_vec;
mod ser;

pub use {
    de::{
        from_slice,
        Deserializer,
        DeserializerError,
    },
    prefixed_vec::PrefixedVec,
    ser::{
        to_vec,
        to_writer,
        Serializer,
        SerializerError,
    },
};

// Proof Format (V1)
// --------------------------------------------------------------------------------
// The definitions within each module can be updated with append-only data without requiring a new
// module to be defined. So for example, it is possible to add new fields can be added to the end
// of the `AccumulatorAccount` without moving to a `v1`.
pub mod v1 {
    use {
        super::*,
        crate::{
            accumulators::merkle::MerklePath,
            error::Error,
            hashers::keccak256_160::Keccak160,
            require,
        },
        serde::{
            Deserialize,
            Serialize,
        },
    };

    // Transfer Format.
    // --------------------------------------------------------------------------------
    // This definition is what will be sent over the wire (I.E, pulled from PythNet and submitted
    // to target chains).
    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub struct AccumulatorUpdateData {
        magic:         [u8; 4],
        major_version: u8,
        minor_version: u8,
        trailing:      Vec<u8>,
        proof:         Proof,
    }

    impl AccumulatorUpdateData {
        pub fn new(proof: Proof) -> Self {
            Self {
                magic: *b"PNAU",
                major_version: 1,
                minor_version: 0,
                trailing: vec![],
                proof,
            }
        }

        pub fn try_from_slice(bytes: &[u8]) -> Result<Self, Error> {
            let message = from_slice::<byteorder::BE, Self>(bytes).unwrap();
            require!(&message.magic[..] != b"PNAU", Error::InvalidMagic);
            require!(message.major_version == 1, Error::InvalidVersion);
            require!(message.minor_version == 0, Error::InvalidVersion);
            Ok(message)
        }
    }

    // A hash of some data.
    pub type Hash = [u8; 20];

    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub enum Proof {
        WormholeMerkle {
            vaa:     PrefixedVec<u16, u8>,
            updates: Vec<MerklePriceUpdate>,
        },
    }

    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub struct MerklePriceUpdate {
        pub message: PrefixedVec<u16, u8>,
        pub proof:   MerklePath<Keccak160>,
    }

    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub struct WormholeMessage {
        pub magic:   [u8; 4],
        pub payload: WormholePayload,
    }

    impl WormholeMessage {
        pub fn try_from_bytes(bytes: impl AsRef<[u8]>) -> Result<Self, Error> {
            let message = from_slice::<byteorder::BE, Self>(bytes.as_ref()).unwrap();
            require!(&message.magic[..] == b"AUWV", Error::InvalidMagic);
            Ok(message)
        }
    }

    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub enum WormholePayload {
        Merkle(WormholeMerkleRoot),
    }

    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub struct WormholeMerkleRoot {
        pub slot:      u64,
        pub ring_size: u32,
        pub root:      Hash,
    }
}

#[cfg(test)]
mod tests {
    use crate::wire::{
        array,
        Deserializer,
        PrefixedVec,
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

            // Test nested structs, which includes our PrefixedVec implementations work as we expect.
            t_struct:   GoldenNested<u8>,
            t_prefixed: PrefixedVec<u16, u8>,
        }

        #[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq)]
        struct GoldenNested<T> {
            nested_u8:    T,
            nested_tuple: (u8, u8),
        }

        #[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq)]
        enum GoldenEnum {
            Unit,
            Newtype(u8),
            Tuple(u8, u16),
            Struct { a: u8, b: u16 },
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
            t_enum_unit:        GoldenEnum::Unit,
            t_enum_newtype:     GoldenEnum::Newtype(45),
            t_enum_tuple:       GoldenEnum::Tuple(46, 47),
            t_enum_struct:      GoldenEnum::Struct { a: 48, b: 49 },
            t_struct:           GoldenNested {
                nested_u8:    50,
                nested_tuple: (51, 52),
            },
            t_prefixed:         vec![0u8; 512].into(),
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
                50, 51, 52, // t_nested
                0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ]
        );

        // We should also be able to deserialize back into the original type.
        assert_eq!(
            golden_struct,
            crate::wire::from_slice::<byteorder::LE, _>(&buffer).unwrap()
        );
    }
}
