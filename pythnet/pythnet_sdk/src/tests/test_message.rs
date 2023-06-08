use {
    crate::messages::{
        Message,
        PriceFeedMessage,
        TwapMessage,
    },
    quickcheck::Arbitrary,
    quickcheck_macros::quickcheck,
};

impl Arbitrary for PriceFeedMessage {
    fn arbitrary(g: &mut quickcheck::Gen) -> Self {
        let mut id = [0u8; 32];
        for item in &mut id {
            *item = u8::arbitrary(g);
        }

        let publish_time = i64::arbitrary(g);

        PriceFeedMessage {
            id,
            price: i64::arbitrary(g),
            conf: u64::arbitrary(g),
            exponent: i32::arbitrary(g),
            publish_time,
            prev_publish_time: publish_time.saturating_sub(i64::arbitrary(g)),
            ema_price: i64::arbitrary(g),
            ema_conf: u64::arbitrary(g),
        }
    }
}

#[quickcheck]
fn test_price_feed_message_roundtrip(input: PriceFeedMessage) -> bool {
    let reconstructed = PriceFeedMessage::try_from_bytes(&input.to_bytes());

    println!("Failed test case:");
    println!("{:?}", input);
    println!("{:?}", reconstructed);

    reconstructed.is_ok() && reconstructed.unwrap() == input
}


impl Arbitrary for TwapMessage {
    fn arbitrary(g: &mut quickcheck::Gen) -> Self {
        let mut id = [0u8; 32];
        for item in &mut id {
            *item = u8::arbitrary(g);
        }

        let publish_time = i64::arbitrary(g);

        TwapMessage {
            id,
            cumulative_price: i128::arbitrary(g),
            cumulative_conf: u128::arbitrary(g),
            num_down_slots: u64::arbitrary(g),
            exponent: i32::arbitrary(g),
            publish_time,
            prev_publish_time: publish_time.saturating_sub(i64::arbitrary(g)),
            publish_slot: u64::arbitrary(g),
        }
    }
}

#[quickcheck]
fn test_twap_message_roundtrip(input: TwapMessage) -> bool {
    let reconstructed = TwapMessage::try_from_bytes(&input.to_bytes());

    println!("Failed test case:");
    println!("{:?}", input);
    println!("{:?}", reconstructed);
    reconstructed.is_ok() && reconstructed.unwrap() == input
}


impl Arbitrary for Message {
    fn arbitrary(g: &mut quickcheck::Gen) -> Self {
        match u8::arbitrary(g) % 2 {
            0 => Message::PriceFeedMessage(Arbitrary::arbitrary(g)),
            _ => Message::TwapMessage(Arbitrary::arbitrary(g)),
        }
    }
}

#[quickcheck]
fn test_message_roundtrip(input: Message) -> bool {
    let reconstructed = Message::try_from_bytes(&input.to_bytes());

    println!("Failed test case:");
    println!("{:?}", input);
    println!("{:?}", reconstructed);

    reconstructed.is_ok() && reconstructed.unwrap() == input
}
