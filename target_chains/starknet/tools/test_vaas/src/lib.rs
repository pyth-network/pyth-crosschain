use primitive_types::U256;

/// A data format compatible with `pyth::byte_array::ByteArray`.
struct CairoByteArrayData {
    // Number of bytes stored in the last item of `self.data` (or 0 if it's empty).
    num_last_bytes: usize,
    // Bytes in big endian. Each item except the last one stores 31 bytes.
    // If `num_last_bytes < 31`, unused most significant bytes of the last item must be unset.
    data: Vec<U256>,
}

/// Converts bytes into a format compatible with `pyth::byte_array::ByteArray`.
fn to_cairo_byte_array_data(data: &[u8]) -> CairoByteArrayData {
    let mut pos = 0;
    let mut r = Vec::new();
    while pos < data.len() {
        if pos + 31 <= data.len() {
            let mut buf = [0u8; 32];
            buf[1..].copy_from_slice(&data[pos..pos + 31]);
            r.push(U256::from_big_endian(&buf));
        } else {
            let mut buf = [0u8; 32];
            let len = data.len() - pos;
            buf[32 - len..].copy_from_slice(&data[pos..]);
            r.push(U256::from_big_endian(&buf));
            return CairoByteArrayData {
                num_last_bytes: len,
                data: r,
            };
        }
        pos += 31;
    }
    CairoByteArrayData {
        num_last_bytes: 0,
        data: r,
    }
}

/// Print data in the format compatible with `starkli invoke` or `starkli call`.
pub fn print_as_cli_input(data: &[u8]) {
    let data = to_cairo_byte_array_data(data);
    print!("{} {} ", data.num_last_bytes, data.data.len());
    for item in data.data {
        print!("{item} ");
    }
    println!();
}

/// Print data in the format suitable for embedding in tests.
pub fn print_as_array_and_last(data: &[u8]) {
    let data = to_cairo_byte_array_data(data);
    println!("let bytes = array![");
    for item in data.data {
        println!("    {item},");
    }
    println!("];");
    println!("let last = {};", data.num_last_bytes);
}
