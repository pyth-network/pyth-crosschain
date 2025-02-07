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
    de::{from_slice, Deserializer, DeserializerError},
    prefixed_vec::PrefixedVec,
    ser::{to_vec, to_writer, Serializer, SerializerError},
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
            accumulators::merkle::MerklePath, error::Error, hashers::keccak256_160::Keccak160,
            require,
        },
        borsh::{BorshDeserialize, BorshSerialize},
        serde::{Deserialize, Serialize},
    };
    pub const PYTHNET_ACCUMULATOR_UPDATE_MAGIC: &[u8; 4] = b"PNAU";
    pub const CURRENT_MINOR_VERSION: u8 = 0;

    // Transfer Format.
    // --------------------------------------------------------------------------------
    // This definition is what will be sent over the wire (I.E, pulled from PythNet and submitted
    // to target chains).
    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub struct AccumulatorUpdateData {
        magic: [u8; 4],
        major_version: u8,
        minor_version: u8,
        trailing: Vec<u8>,
        pub proof: Proof,
    }

    impl AccumulatorUpdateData {
        pub fn new(proof: Proof) -> Self {
            Self {
                magic: *PYTHNET_ACCUMULATOR_UPDATE_MAGIC,
                major_version: 1,
                minor_version: 0,
                trailing: vec![],
                proof,
            }
        }

        pub fn try_from_slice(bytes: &[u8]) -> Result<Self, Error> {
            let message = from_slice::<byteorder::BE, Self>(bytes)
                .map_err(|_| Error::DeserializationError)?;
            require!(
                &message.magic[..] == PYTHNET_ACCUMULATOR_UPDATE_MAGIC,
                Error::InvalidMagic
            );
            require!(message.major_version == 1, Error::InvalidVersion);
            #[allow(clippy::absurd_extreme_comparisons)]
            {
                require!(
                    message.minor_version >= CURRENT_MINOR_VERSION,
                    Error::InvalidVersion
                );
            }
            Ok(message)
        }
    }

    // A hash of some data.
    pub type Hash = [u8; 20];

    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub enum Proof {
        WormholeMerkle {
            vaa: PrefixedVec<u16, u8>,
            updates: Vec<MerklePriceUpdate>,
        },
    }

    #[derive(
        Clone, Debug, Hash, PartialEq, Serialize, Deserialize, BorshDeserialize, BorshSerialize,
    )]
    pub struct MerklePriceUpdate {
        pub message: PrefixedVec<u16, u8>,
        pub proof: MerklePath<Keccak160>,
    }

    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub struct WormholeMessage {
        pub magic: [u8; 4],
        pub payload: WormholePayload,
    }

    pub const ACCUMULATOR_UPDATE_WORMHOLE_VERIFICATION_MAGIC: &[u8; 4] = b"AUWV";

    impl WormholeMessage {
        pub fn new(payload: WormholePayload) -> Self {
            Self {
                magic: *ACCUMULATOR_UPDATE_WORMHOLE_VERIFICATION_MAGIC,
                payload,
            }
        }

        pub fn try_from_bytes(bytes: impl AsRef<[u8]>) -> Result<Self, Error> {
            let message = from_slice::<byteorder::BE, Self>(bytes.as_ref())
                .map_err(|_| Error::DeserializationError)?;
            require!(
                &message.magic[..] == ACCUMULATOR_UPDATE_WORMHOLE_VERIFICATION_MAGIC,
                Error::InvalidMagic
            );
            Ok(message)
        }
    }

    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub enum WormholePayload {
        Merkle(WormholeMerkleRoot),
    }

    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub struct WormholeMerkleRoot {
        pub slot: u64,
        pub ring_size: u32,
        pub root: Hash,
    }
}

#[cfg(test)]
mod tests {
    use crate::wire::{
        array,
        v1::{AccumulatorUpdateData, Proof},
        Deserializer, PrefixedVec, Serializer,
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
            t_u8: u8,
            t_u16: u16,
            t_u32: u32,
            t_u64: u64,

            // Test `str` is serialized to a variable length array.
            t_string: String,
            t_str: &'a str,

            // Test `Vec` is serialized to a variable length array.
            t_vec: Vec<u8>,
            t_vec_empty: Vec<u8>,
            t_vec_nested: Vec<Vec<u8>>,
            t_vec_nested_empty: Vec<Vec<u8>>,
            t_slice: &'a [u8],
            t_slice_empty: &'a [u8],

            // Test tuples serialize as expected.
            t_tuple: (u8, u16, u32, u64, String, Vec<u8>, &'a [u8]),
            t_tuple_nested: ((u8, u16), (u32, u64)),

            // Test enum serializations.
            t_enum_unit: GoldenEnum,
            t_enum_newtype: GoldenEnum,
            t_enum_tuple: GoldenEnum,
            t_enum_struct: GoldenEnum,

            // Test nested structs, which includes our PrefixedVec implementations work as we expect.
            t_struct: GoldenNested<u8>,
            t_prefixed: PrefixedVec<u16, u8>,
        }

        #[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq)]
        struct GoldenNested<T> {
            nested_u8: T,
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
            unit: (),
            t_bool: true,
            t_u8: 1,
            t_u16: 2,
            t_u32: 3,
            t_u64: 4,
            t_string: "9".to_string(),
            t_str: "10",
            t_vec: vec![11, 12, 13],
            t_vec_empty: vec![],
            t_vec_nested: vec![vec![14, 15, 16], vec![17, 18, 19]],
            t_vec_nested_empty: vec![vec![], vec![]],
            t_slice: &[20, 21, 22],
            t_slice_empty: &[],
            t_tuple: (
                29,
                30,
                31,
                32,
                "10".to_string(),
                vec![35, 36, 37],
                &[38, 39, 40],
            ),
            t_tuple_nested: ((41, 42), (43, 44)),
            t_enum_unit: GoldenEnum::Unit,
            t_enum_newtype: GoldenEnum::Newtype(45),
            t_enum_tuple: GoldenEnum::Tuple(46, 47),
            t_enum_struct: GoldenEnum::Struct { a: 48, b: 49 },
            t_struct: GoldenNested {
                nested_u8: 50,
                nested_tuple: (51, 52),
            },
            t_prefixed: vec![0u8; 512].into(),
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

    #[test]
    #[rustfmt::skip]
    /// This method tests that our EnumAccess workaround does not violate any memory safety rules.
    /// In particular we want to make sure we avoid transmuting to any type that is not a u8 (we do
    /// not support > 255 variants anyway).
    fn test_serde_enum_access_behaviour() {
        use serde::Deserialize;
        use serde::Serialize;

        // Small-sized enums should all deserialize safely as single u8.
        #[derive(PartialEq, Serialize, Deserialize, Debug)]
        enum Singleton { A }

        #[derive(PartialEq, Serialize, Deserialize, Debug)]
        enum Pair { A, B }

        #[derive(PartialEq, Serialize, Deserialize, Debug)]
        enum Triple { A, B, C }

        // Intentionally numbered enums with primitive representation (as long as u8) are safe.
        #[derive(PartialEq, Serialize, Deserialize, Debug)]
        enum CustomIndices {
            A = 33,
            B = 55,
            C = 255,
        }

        // Complex enum's should still serialize as u8, and we expect the serde EnumAccess to work
        // the same.
        #[derive(PartialEq, Serialize, Deserialize, Debug)]
        enum Complex {
            A,
            B(u8, u8),
            C { a: u8, b: u8 },
        }

        // Forces the compiler to use a 16-bit discriminant. This must force the serde EnumAccess
        // implementation to return an error. Otherwise we run the risk of the __Field enum in our
        // transmute workaround becoming trash memory leading to UB.
        #[derive(PartialEq, Serialize, Deserialize, Debug)]
        enum ManyVariants {
            _000, _001, _002, _003, _004, _005, _006, _007, _008, _009, _00A, _00B, _00C, _00D,
            _00E, _00F, _010, _011, _012, _013, _014, _015, _016, _017, _018, _019, _01A, _01B,
            _01C, _01D, _01E, _01F, _020, _021, _022, _023, _024, _025, _026, _027, _028, _029,
            _02A, _02B, _02C, _02D, _02E, _02F, _030, _031, _032, _033, _034, _035, _036, _037,
            _038, _039, _03A, _03B, _03C, _03D, _03E, _03F, _040, _041, _042, _043, _044, _045,
            _046, _047, _048, _049, _04A, _04B, _04C, _04D, _04E, _04F, _050, _051, _052, _053,
            _054, _055, _056, _057, _058, _059, _05A, _05B, _05C, _05D, _05E, _05F, _060, _061,
            _062, _063, _064, _065, _066, _067, _068, _069, _06A, _06B, _06C, _06D, _06E, _06F,
            _070, _071, _072, _073, _074, _075, _076, _077, _078, _079, _07A, _07B, _07C, _07D,
            _07E, _07F, _080, _081, _082, _083, _084, _085, _086, _087, _088, _089, _08A, _08B,
            _08C, _08D, _08E, _08F, _090, _091, _092, _093, _094, _095, _096, _097, _098, _099,
            _09A, _09B, _09C, _09D, _09E, _09F, _0A0, _0A1, _0A2, _0A3, _0A4, _0A5, _0A6, _0A7,
            _0A8, _0A9, _0AA, _0AB, _0AC, _0AD, _0AE, _0AF, _0B0, _0B1, _0B2, _0B3, _0B4, _0B5,
            _0B6, _0B7, _0B8, _0B9, _0BA, _0BB, _0BC, _0BD, _0BE, _0BF, _0C0, _0C1, _0C2, _0C3,
            _0C4, _0C5, _0C6, _0C7, _0C8, _0C9, _0CA, _0CB, _0CC, _0CD, _0CE, _0CF, _0D0, _0D1,
            _0D2, _0D3, _0D4, _0D5, _0D6, _0D7, _0D8, _0D9, _0DA, _0DB, _0DC, _0DD, _0DE, _0DF,
            _0E0, _0E1, _0E2, _0E3, _0E4, _0E5, _0E6, _0E7, _0E8, _0E9, _0EA, _0EB, _0EC, _0ED,
            _0EE, _0EF, _0F0, _0F1, _0F2, _0F3, _0F4, _0F5, _0F6, _0F7, _0F8, _0F9, _0FA, _0FB,
            _0FC, _0FD, _0FE, _0FF,

            // > 255
            _100
        }

        #[derive(PartialEq, Serialize, Deserialize, Debug)]
        struct AllValid {
            singleton:  Singleton,
            pair:       Pair,
            triple:     Triple,
            complex:    Complex,
            custom:     CustomIndices,
        }

        #[derive(PartialEq, Serialize, Deserialize, Debug)]
        struct Invalid {
            many_variants: ManyVariants,
        }

        let valid_buffer = [
            // Singleton (A)
            0,
            // Pair (B)
            1,
            // Triple (C)
            2,
            // Complex
            1, 0, 0,
            // Custom
            2,
        ];

        let valid_struct = AllValid {
            singleton:  Singleton::A,
            pair:       Pair::B,
            triple:     Triple::C,
            complex:    Complex::B(0, 0),
            custom:     CustomIndices::C,
        };

        let valid_serialized = crate::wire::ser::to_vec::<_, byteorder::BE>(&valid_struct).unwrap();

        // Confirm that the valid buffer can be deserialized.
        let valid = crate::wire::from_slice::<byteorder::BE, AllValid>(&valid_buffer).unwrap();
        let valid_deserialized = crate::wire::from_slice::<byteorder::BE, AllValid>(&valid_serialized).unwrap();
        assert_eq!(valid, valid_struct);
        assert_eq!(valid_deserialized, valid_struct);

        // Invalid buffer tests that types > u8 fail to deserialize, it's important to note that
        // there is nothing stopping someone compiling a program with an invalid enum deserialize
        // but we can at least ensure an error in deserialization occurs.
        let invalid_buffer = [
            // ManyVariants (256)
            1, 0
        ];

        let result = crate::wire::from_slice::<byteorder::BE, Invalid>(&invalid_buffer);
        assert!(result.is_err());
    }

    // Test if the AccumulatorUpdateData type can be serialized and deserialized
    // and still be the same as the original.
    #[test]
    fn test_accumulator_update_data_serde() {
        use serde::Serialize;
        // Serialize an empty update into a buffer.
        let empty_update = AccumulatorUpdateData::new(Proof::WormholeMerkle {
            vaa: PrefixedVec::from(vec![]),
            updates: vec![],
        });
        let mut buffer = Vec::new();
        let mut cursor = std::io::Cursor::new(&mut buffer);
        let mut serializer: Serializer<_, byteorder::LE> = Serializer::new(&mut cursor);
        empty_update.serialize(&mut serializer).unwrap();

        // Test if it can be deserialized back into the original type.
        let deserialized_update = AccumulatorUpdateData::try_from_slice(&buffer).unwrap();

        // The deserialized value should be the same as the original.
        assert_eq!(deserialized_update, empty_update);
    }

    // Test if the AccumulatorUpdateData major and minor version increases work as expected
    #[test]
    fn test_accumulator_forward_compatibility() {
        use serde::Serialize;
        // Serialize an empty update into a buffer.

        let empty_update = AccumulatorUpdateData::new(Proof::WormholeMerkle {
            vaa: PrefixedVec::from(vec![]),
            updates: vec![],
        });
        let mut buffer = Vec::new();
        let mut cursor = std::io::Cursor::new(&mut buffer);
        let mut serializer: Serializer<_, byteorder::LE> = Serializer::new(&mut cursor);
        empty_update.serialize(&mut serializer).unwrap();

        // Test if bumping minor version is still compatible
        buffer[5] = 0x03;
        AccumulatorUpdateData::try_from_slice(&buffer).unwrap();

        // Test if bumping major version makes it incompatible
        buffer[4] = 0x03;
        AccumulatorUpdateData::try_from_slice(&buffer).unwrap_err();
    }
}
