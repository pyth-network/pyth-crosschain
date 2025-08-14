CREATE TABLE request(
    chain_id VARCHAR(20) NOT NULL,
    network_id INTEGER NOT NULL,
    provider VARCHAR(40) NOT NULL,
    sequence INTEGER NOT NULL,
    created_at BIGINT NOT NULL,
    last_updated_at BIGINT NOT NULL,
    state VARCHAR(10) NOT NULL,
    request_block_number INTEGER NOT NULL,
    request_tx_hash VARCHAR(64) NOT NULL,
    user_random_number VARCHAR(64) NOT NULL,
    sender VARCHAR(40) NOT NULL,
    reveal_block_number INTEGER,
    reveal_tx_hash VARCHAR(64),
    provider_random_number VARCHAR(64),
    info TEXT,
    gas_used VARCHAR(100),
    gas_limit VARCHAR(100) NOT NULL,
    callback_failed INTEGER,
    callback_return_value VARCHAR,
    callback_gas_used VARCHAR(100),
    PRIMARY KEY (network_id, sequence, provider, request_tx_hash)
);
CREATE INDEX request__network_id__state__created_at ON request(network_id, state, created_at);
CREATE INDEX request__network_id__created_at ON request(network_id, created_at);
CREATE INDEX request__sender__network_id__state__created_at ON request(sender, network_id, state, created_at);
CREATE INDEX request__sender__network_id__created_at ON request(sender, network_id, created_at);
CREATE INDEX request__sender__state__created_at ON request(sender, state, created_at);
CREATE INDEX request__sender__created_at ON request(sender, created_at);
CREATE INDEX request__sequence__network_id__state__created_at ON request(sequence, network_id, state, created_at);
CREATE INDEX request__sequence__network_id__created_at ON request(sequence, network_id, created_at);
CREATE INDEX request__sequence__state__created_at ON request(sequence, state, created_at);
CREATE INDEX request__sequence__created_at ON request(sequence, created_at);
CREATE INDEX request__state__created_at ON request(state, created_at);
CREATE INDEX request__created_at ON request(created_at);
CREATE INDEX request__request_tx_hash ON request (request_tx_hash)
WHERE request_tx_hash IS NOT NULL;
CREATE INDEX request__reveal_tx_hash ON request (reveal_tx_hash)
WHERE reveal_tx_hash IS NOT NULL;
