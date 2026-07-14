/// Convenience wrapper around `wormhole::{bytes, cursor}` utils.
module pyth_lazer::parser;

use wormhole::{bytes, cursor::{Self, Cursor}};

public struct Parser(Cursor<u8>)

public(package) fun new(bytes: vector<u8>): Parser {
    Parser(cursor::new(bytes))
}

public(package) fun take_u8(self: &mut Parser): u8 {
    bytes::take_u8(&mut self.0)
}

public(package) fun take_u16_be(self: &mut Parser): u16 {
    bytes::take_u16_be(&mut self.0)
}

public(package) fun take_u64_be(self: &mut Parser): u64 {
    bytes::take_u64_be(&mut self.0)
}

public(package) fun take_bytes(self: &mut Parser, num: u64): vector<u8> {
    bytes::take_bytes(&mut self.0, num)
}

public(package) fun take_rest(self: Parser): vector<u8> {
    let Parser(cursor) = self;
    cursor.take_rest()
}

public(package) fun destroy_empty(self: Parser) {
    let Parser(cursor) = self;
    cursor.destroy_empty()
}
