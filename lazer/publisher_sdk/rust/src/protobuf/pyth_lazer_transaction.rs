// This file is generated by rust-protobuf 3.7.2. Do not edit
// .proto file is parsed by pure
// @generated

// https://github.com/rust-lang/rust-clippy/issues/702
#![allow(unknown_lints)]
#![allow(clippy::all)]

#![allow(unused_attributes)]
#![cfg_attr(rustfmt, rustfmt::skip)]

#![allow(dead_code)]
#![allow(missing_docs)]
#![allow(non_camel_case_types)]
#![allow(non_snake_case)]
#![allow(non_upper_case_globals)]
#![allow(trivial_casts)]
#![allow(unused_results)]
#![allow(unused_mut)]

//! Generated file from `pyth_lazer_transaction.proto`

/// Generated files are compatible only with the same version
/// of protobuf runtime.
const _PROTOBUF_VERSION_CHECK: () = ::protobuf::VERSION_3_7_2;

// @@protoc_insertion_point(message:pyth_lazer_transaction.SignedLazerTransaction)
#[derive(PartialEq,Clone,Default,Debug)]
pub struct SignedLazerTransaction {
    // message fields
    // @@protoc_insertion_point(field:pyth_lazer_transaction.SignedLazerTransaction.signature_type)
    pub signature_type: ::std::option::Option<::protobuf::EnumOrUnknown<TransactionSignatureType>>,
    // @@protoc_insertion_point(field:pyth_lazer_transaction.SignedLazerTransaction.signature)
    pub signature: ::std::option::Option<::std::vec::Vec<u8>>,
    // @@protoc_insertion_point(field:pyth_lazer_transaction.SignedLazerTransaction.payload)
    pub payload: ::std::option::Option<::std::vec::Vec<u8>>,
    // special fields
    // @@protoc_insertion_point(special_field:pyth_lazer_transaction.SignedLazerTransaction.special_fields)
    pub special_fields: ::protobuf::SpecialFields,
}

impl<'a> ::std::default::Default for &'a SignedLazerTransaction {
    fn default() -> &'a SignedLazerTransaction {
        <SignedLazerTransaction as ::protobuf::Message>::default_instance()
    }
}

impl SignedLazerTransaction {
    pub fn new() -> SignedLazerTransaction {
        ::std::default::Default::default()
    }

    fn generated_message_descriptor_data() -> ::protobuf::reflect::GeneratedMessageDescriptorData {
        let mut fields = ::std::vec::Vec::with_capacity(3);
        let mut oneofs = ::std::vec::Vec::with_capacity(0);
        fields.push(::protobuf::reflect::rt::v2::make_option_accessor::<_, _>(
            "signature_type",
            |m: &SignedLazerTransaction| { &m.signature_type },
            |m: &mut SignedLazerTransaction| { &mut m.signature_type },
        ));
        fields.push(::protobuf::reflect::rt::v2::make_option_accessor::<_, _>(
            "signature",
            |m: &SignedLazerTransaction| { &m.signature },
            |m: &mut SignedLazerTransaction| { &mut m.signature },
        ));
        fields.push(::protobuf::reflect::rt::v2::make_option_accessor::<_, _>(
            "payload",
            |m: &SignedLazerTransaction| { &m.payload },
            |m: &mut SignedLazerTransaction| { &mut m.payload },
        ));
        ::protobuf::reflect::GeneratedMessageDescriptorData::new_2::<SignedLazerTransaction>(
            "SignedLazerTransaction",
            fields,
            oneofs,
        )
    }
}

impl ::protobuf::Message for SignedLazerTransaction {
    const NAME: &'static str = "SignedLazerTransaction";

    fn is_initialized(&self) -> bool {
        true
    }

    fn merge_from(&mut self, is: &mut ::protobuf::CodedInputStream<'_>) -> ::protobuf::Result<()> {
        while let Some(tag) = is.read_raw_tag_or_eof()? {
            match tag {
                8 => {
                    self.signature_type = ::std::option::Option::Some(is.read_enum_or_unknown()?);
                },
                18 => {
                    self.signature = ::std::option::Option::Some(is.read_bytes()?);
                },
                26 => {
                    self.payload = ::std::option::Option::Some(is.read_bytes()?);
                },
                tag => {
                    ::protobuf::rt::read_unknown_or_skip_group(tag, is, self.special_fields.mut_unknown_fields())?;
                },
            };
        }
        ::std::result::Result::Ok(())
    }

    // Compute sizes of nested messages
    #[allow(unused_variables)]
    fn compute_size(&self) -> u64 {
        let mut my_size = 0;
        if let Some(v) = self.signature_type {
            my_size += ::protobuf::rt::int32_size(1, v.value());
        }
        if let Some(v) = self.signature.as_ref() {
            my_size += ::protobuf::rt::bytes_size(2, &v);
        }
        if let Some(v) = self.payload.as_ref() {
            my_size += ::protobuf::rt::bytes_size(3, &v);
        }
        my_size += ::protobuf::rt::unknown_fields_size(self.special_fields.unknown_fields());
        self.special_fields.cached_size().set(my_size as u32);
        my_size
    }

    fn write_to_with_cached_sizes(&self, os: &mut ::protobuf::CodedOutputStream<'_>) -> ::protobuf::Result<()> {
        if let Some(v) = self.signature_type {
            os.write_enum(1, ::protobuf::EnumOrUnknown::value(&v))?;
        }
        if let Some(v) = self.signature.as_ref() {
            os.write_bytes(2, v)?;
        }
        if let Some(v) = self.payload.as_ref() {
            os.write_bytes(3, v)?;
        }
        os.write_unknown_fields(self.special_fields.unknown_fields())?;
        ::std::result::Result::Ok(())
    }

    fn special_fields(&self) -> &::protobuf::SpecialFields {
        &self.special_fields
    }

    fn mut_special_fields(&mut self) -> &mut ::protobuf::SpecialFields {
        &mut self.special_fields
    }

    fn new() -> SignedLazerTransaction {
        SignedLazerTransaction::new()
    }

    fn clear(&mut self) {
        self.signature_type = ::std::option::Option::None;
        self.signature = ::std::option::Option::None;
        self.payload = ::std::option::Option::None;
        self.special_fields.clear();
    }

    fn default_instance() -> &'static SignedLazerTransaction {
        static instance: SignedLazerTransaction = SignedLazerTransaction {
            signature_type: ::std::option::Option::None,
            signature: ::std::option::Option::None,
            payload: ::std::option::Option::None,
            special_fields: ::protobuf::SpecialFields::new(),
        };
        &instance
    }
}

impl ::protobuf::MessageFull for SignedLazerTransaction {
    fn descriptor() -> ::protobuf::reflect::MessageDescriptor {
        static descriptor: ::protobuf::rt::Lazy<::protobuf::reflect::MessageDescriptor> = ::protobuf::rt::Lazy::new();
        descriptor.get(|| file_descriptor().message_by_package_relative_name("SignedLazerTransaction").unwrap()).clone()
    }
}

impl ::std::fmt::Display for SignedLazerTransaction {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        ::protobuf::text_format::fmt(self, f)
    }
}

impl ::protobuf::reflect::ProtobufValue for SignedLazerTransaction {
    type RuntimeType = ::protobuf::reflect::rt::RuntimeTypeMessage<Self>;
}

// @@protoc_insertion_point(message:pyth_lazer_transaction.LazerTransaction)
#[derive(PartialEq,Clone,Default,Debug)]
pub struct LazerTransaction {
    // message oneof groups
    pub payload: ::std::option::Option<lazer_transaction::Payload>,
    // special fields
    // @@protoc_insertion_point(special_field:pyth_lazer_transaction.LazerTransaction.special_fields)
    pub special_fields: ::protobuf::SpecialFields,
}

impl<'a> ::std::default::Default for &'a LazerTransaction {
    fn default() -> &'a LazerTransaction {
        <LazerTransaction as ::protobuf::Message>::default_instance()
    }
}

impl LazerTransaction {
    pub fn new() -> LazerTransaction {
        ::std::default::Default::default()
    }

    // .pyth_lazer_transaction.PublisherUpdate publisher_update = 1;

    pub fn publisher_update(&self) -> &super::publisher_update::PublisherUpdate {
        match self.payload {
            ::std::option::Option::Some(lazer_transaction::Payload::PublisherUpdate(ref v)) => v,
            _ => <super::publisher_update::PublisherUpdate as ::protobuf::Message>::default_instance(),
        }
    }

    pub fn clear_publisher_update(&mut self) {
        self.payload = ::std::option::Option::None;
    }

    pub fn has_publisher_update(&self) -> bool {
        match self.payload {
            ::std::option::Option::Some(lazer_transaction::Payload::PublisherUpdate(..)) => true,
            _ => false,
        }
    }

    // Param is passed by value, moved
    pub fn set_publisher_update(&mut self, v: super::publisher_update::PublisherUpdate) {
        self.payload = ::std::option::Option::Some(lazer_transaction::Payload::PublisherUpdate(v))
    }

    // Mutable pointer to the field.
    pub fn mut_publisher_update(&mut self) -> &mut super::publisher_update::PublisherUpdate {
        if let ::std::option::Option::Some(lazer_transaction::Payload::PublisherUpdate(_)) = self.payload {
        } else {
            self.payload = ::std::option::Option::Some(lazer_transaction::Payload::PublisherUpdate(super::publisher_update::PublisherUpdate::new()));
        }
        match self.payload {
            ::std::option::Option::Some(lazer_transaction::Payload::PublisherUpdate(ref mut v)) => v,
            _ => panic!(),
        }
    }

    // Take field
    pub fn take_publisher_update(&mut self) -> super::publisher_update::PublisherUpdate {
        if self.has_publisher_update() {
            match self.payload.take() {
                ::std::option::Option::Some(lazer_transaction::Payload::PublisherUpdate(v)) => v,
                _ => panic!(),
            }
        } else {
            super::publisher_update::PublisherUpdate::new()
        }
    }

    fn generated_message_descriptor_data() -> ::protobuf::reflect::GeneratedMessageDescriptorData {
        let mut fields = ::std::vec::Vec::with_capacity(1);
        let mut oneofs = ::std::vec::Vec::with_capacity(1);
        fields.push(::protobuf::reflect::rt::v2::make_oneof_message_has_get_mut_set_accessor::<_, super::publisher_update::PublisherUpdate>(
            "publisher_update",
            LazerTransaction::has_publisher_update,
            LazerTransaction::publisher_update,
            LazerTransaction::mut_publisher_update,
            LazerTransaction::set_publisher_update,
        ));
        oneofs.push(lazer_transaction::Payload::generated_oneof_descriptor_data());
        ::protobuf::reflect::GeneratedMessageDescriptorData::new_2::<LazerTransaction>(
            "LazerTransaction",
            fields,
            oneofs,
        )
    }
}

impl ::protobuf::Message for LazerTransaction {
    const NAME: &'static str = "LazerTransaction";

    fn is_initialized(&self) -> bool {
        true
    }

    fn merge_from(&mut self, is: &mut ::protobuf::CodedInputStream<'_>) -> ::protobuf::Result<()> {
        while let Some(tag) = is.read_raw_tag_or_eof()? {
            match tag {
                10 => {
                    self.payload = ::std::option::Option::Some(lazer_transaction::Payload::PublisherUpdate(is.read_message()?));
                },
                tag => {
                    ::protobuf::rt::read_unknown_or_skip_group(tag, is, self.special_fields.mut_unknown_fields())?;
                },
            };
        }
        ::std::result::Result::Ok(())
    }

    // Compute sizes of nested messages
    #[allow(unused_variables)]
    fn compute_size(&self) -> u64 {
        let mut my_size = 0;
        if let ::std::option::Option::Some(ref v) = self.payload {
            match v {
                &lazer_transaction::Payload::PublisherUpdate(ref v) => {
                    let len = v.compute_size();
                    my_size += 1 + ::protobuf::rt::compute_raw_varint64_size(len) + len;
                },
            };
        }
        my_size += ::protobuf::rt::unknown_fields_size(self.special_fields.unknown_fields());
        self.special_fields.cached_size().set(my_size as u32);
        my_size
    }

    fn write_to_with_cached_sizes(&self, os: &mut ::protobuf::CodedOutputStream<'_>) -> ::protobuf::Result<()> {
        if let ::std::option::Option::Some(ref v) = self.payload {
            match v {
                &lazer_transaction::Payload::PublisherUpdate(ref v) => {
                    ::protobuf::rt::write_message_field_with_cached_size(1, v, os)?;
                },
            };
        }
        os.write_unknown_fields(self.special_fields.unknown_fields())?;
        ::std::result::Result::Ok(())
    }

    fn special_fields(&self) -> &::protobuf::SpecialFields {
        &self.special_fields
    }

    fn mut_special_fields(&mut self) -> &mut ::protobuf::SpecialFields {
        &mut self.special_fields
    }

    fn new() -> LazerTransaction {
        LazerTransaction::new()
    }

    fn clear(&mut self) {
        self.payload = ::std::option::Option::None;
        self.special_fields.clear();
    }

    fn default_instance() -> &'static LazerTransaction {
        static instance: LazerTransaction = LazerTransaction {
            payload: ::std::option::Option::None,
            special_fields: ::protobuf::SpecialFields::new(),
        };
        &instance
    }
}

impl ::protobuf::MessageFull for LazerTransaction {
    fn descriptor() -> ::protobuf::reflect::MessageDescriptor {
        static descriptor: ::protobuf::rt::Lazy<::protobuf::reflect::MessageDescriptor> = ::protobuf::rt::Lazy::new();
        descriptor.get(|| file_descriptor().message_by_package_relative_name("LazerTransaction").unwrap()).clone()
    }
}

impl ::std::fmt::Display for LazerTransaction {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        ::protobuf::text_format::fmt(self, f)
    }
}

impl ::protobuf::reflect::ProtobufValue for LazerTransaction {
    type RuntimeType = ::protobuf::reflect::rt::RuntimeTypeMessage<Self>;
}

/// Nested message and enums of message `LazerTransaction`
pub mod lazer_transaction {

    #[derive(Clone,PartialEq,Debug)]
    #[non_exhaustive]
    // @@protoc_insertion_point(oneof:pyth_lazer_transaction.LazerTransaction.payload)
    pub enum Payload {
        // @@protoc_insertion_point(oneof_field:pyth_lazer_transaction.LazerTransaction.publisher_update)
        PublisherUpdate(super::super::publisher_update::PublisherUpdate),
    }

    impl ::protobuf::Oneof for Payload {
    }

    impl ::protobuf::OneofFull for Payload {
        fn descriptor() -> ::protobuf::reflect::OneofDescriptor {
            static descriptor: ::protobuf::rt::Lazy<::protobuf::reflect::OneofDescriptor> = ::protobuf::rt::Lazy::new();
            descriptor.get(|| <super::LazerTransaction as ::protobuf::MessageFull>::descriptor().oneof_by_name("payload").unwrap()).clone()
        }
    }

    impl Payload {
        pub(in super) fn generated_oneof_descriptor_data() -> ::protobuf::reflect::GeneratedOneofDescriptorData {
            ::protobuf::reflect::GeneratedOneofDescriptorData::new::<Payload>("payload")
        }
    }
}

#[derive(Clone,Copy,PartialEq,Eq,Debug,Hash)]
// @@protoc_insertion_point(enum:pyth_lazer_transaction.TransactionSignatureType)
pub enum TransactionSignatureType {
    // @@protoc_insertion_point(enum_value:pyth_lazer_transaction.TransactionSignatureType.ed25519)
    ed25519 = 0,
}

impl ::protobuf::Enum for TransactionSignatureType {
    const NAME: &'static str = "TransactionSignatureType";

    fn value(&self) -> i32 {
        *self as i32
    }

    fn from_i32(value: i32) -> ::std::option::Option<TransactionSignatureType> {
        match value {
            0 => ::std::option::Option::Some(TransactionSignatureType::ed25519),
            _ => ::std::option::Option::None
        }
    }

    fn from_str(str: &str) -> ::std::option::Option<TransactionSignatureType> {
        match str {
            "ed25519" => ::std::option::Option::Some(TransactionSignatureType::ed25519),
            _ => ::std::option::Option::None
        }
    }

    const VALUES: &'static [TransactionSignatureType] = &[
        TransactionSignatureType::ed25519,
    ];
}

impl ::protobuf::EnumFull for TransactionSignatureType {
    fn enum_descriptor() -> ::protobuf::reflect::EnumDescriptor {
        static descriptor: ::protobuf::rt::Lazy<::protobuf::reflect::EnumDescriptor> = ::protobuf::rt::Lazy::new();
        descriptor.get(|| file_descriptor().enum_by_package_relative_name("TransactionSignatureType").unwrap()).clone()
    }

    fn descriptor(&self) -> ::protobuf::reflect::EnumValueDescriptor {
        let index = *self as usize;
        Self::enum_descriptor().value_by_index(index)
    }
}

impl ::std::default::Default for TransactionSignatureType {
    fn default() -> Self {
        TransactionSignatureType::ed25519
    }
}

impl TransactionSignatureType {
    fn generated_enum_descriptor_data() -> ::protobuf::reflect::GeneratedEnumDescriptorData {
        ::protobuf::reflect::GeneratedEnumDescriptorData::new::<TransactionSignatureType>("TransactionSignatureType")
    }
}

static file_descriptor_proto_data: &'static [u8] = b"\
    \n\x1cpyth_lazer_transaction.proto\x12\x16pyth_lazer_transaction\x1a\x16\
    publisher_update.proto\"\xe5\x01\n\x16SignedLazerTransaction\x12\\\n\x0e\
    signature_type\x18\x01\x20\x01(\x0e20.pyth_lazer_transaction.Transaction\
    SignatureTypeH\0R\rsignatureType\x88\x01\x01\x12!\n\tsignature\x18\x02\
    \x20\x01(\x0cH\x01R\tsignature\x88\x01\x01\x12\x1d\n\x07payload\x18\x03\
    \x20\x01(\x0cH\x02R\x07payload\x88\x01\x01B\x11\n\x0f_signature_typeB\
    \x0c\n\n_signatureB\n\n\x08_payload\"s\n\x10LazerTransaction\x12T\n\x10p\
    ublisher_update\x18\x01\x20\x01(\x0b2'.pyth_lazer_transaction.PublisherU\
    pdateH\0R\x0fpublisherUpdateB\t\n\x07payload*'\n\x18TransactionSignature\
    Type\x12\x0b\n\x07ed25519\x10\0b\x06proto3\
";

/// `FileDescriptorProto` object which was a source for this generated file
fn file_descriptor_proto() -> &'static ::protobuf::descriptor::FileDescriptorProto {
    static file_descriptor_proto_lazy: ::protobuf::rt::Lazy<::protobuf::descriptor::FileDescriptorProto> = ::protobuf::rt::Lazy::new();
    file_descriptor_proto_lazy.get(|| {
        ::protobuf::Message::parse_from_bytes(file_descriptor_proto_data).unwrap()
    })
}

/// `FileDescriptor` object which allows dynamic access to files
pub fn file_descriptor() -> &'static ::protobuf::reflect::FileDescriptor {
    static generated_file_descriptor_lazy: ::protobuf::rt::Lazy<::protobuf::reflect::GeneratedFileDescriptor> = ::protobuf::rt::Lazy::new();
    static file_descriptor: ::protobuf::rt::Lazy<::protobuf::reflect::FileDescriptor> = ::protobuf::rt::Lazy::new();
    file_descriptor.get(|| {
        let generated_file_descriptor = generated_file_descriptor_lazy.get(|| {
            let mut deps = ::std::vec::Vec::with_capacity(1);
            deps.push(super::publisher_update::file_descriptor().clone());
            let mut messages = ::std::vec::Vec::with_capacity(2);
            messages.push(SignedLazerTransaction::generated_message_descriptor_data());
            messages.push(LazerTransaction::generated_message_descriptor_data());
            let mut enums = ::std::vec::Vec::with_capacity(1);
            enums.push(TransactionSignatureType::generated_enum_descriptor_data());
            ::protobuf::reflect::GeneratedFileDescriptor::new_generated(
                file_descriptor_proto(),
                deps,
                messages,
                enums,
            )
        });
        ::protobuf::reflect::FileDescriptor::new_generated_2(generated_file_descriptor)
    })
}
