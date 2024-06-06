use std::io::{stdin, Read};

use test_vaas::print_as_cli_input;

fn main() {
    let mut buf = String::new();
    stdin().read_to_string(&mut buf).unwrap();
    let binary = hex::decode(buf.trim()).unwrap();
    print_as_cli_input(&binary);
}
