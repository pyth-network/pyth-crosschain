module pyth::data_source {
    use wormhole::external_address::ExternalAddress;

    struct DataSource has copy, drop, store {
        emitter_chain: u64,
        emitter_address: ExternalAddress,
    }

    public fun new(emitter_chain: u64, emitter_address: ExternalAddress): DataSource {
        DataSource {
            emitter_chain: emitter_chain,
            emitter_address: emitter_address,
        }
    }
}
