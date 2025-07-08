-- we use VARCHAR(40) for addresses and VARCHAR(64) for tx_hashes and 32 byte numbers
CREATE TABLE request(
                    chain_id VARCHAR(20) NOT NULL,
                    network_id INTEGER NOT NULL,
                    provider VARCHAR(40) NOT NULL,
                    sequence INTEGER NOT NULL,
                    created_at DATETIME NOT NULL,
                    last_updated_at DATETIME NOT NULL,
                    state VARCHAR(10) NOT NULL,
                    request_block_number INT NOT NULL,
                    request_tx_hash VARCHAR(64) NOT NULL,
                    user_random_number VARCHAR(64) NOT NULL,
                    sender VARCHAR(40) NOT NULL,
                    reveal_block_number INT,
                    reveal_tx_hash VARCHAR(64),
                    provider_random_number VARCHAR(64),
                    info TEXT,
                    PRIMARY KEY (network_id, sequence, provider, request_tx_hash)
);

CREATE INDEX idx_request_sequence ON request (sequence);
CREATE INDEX idx_request_network_id_created_at ON request (network_id, created_at);
CREATE INDEX idx_request_created_at ON request (created_at);
CREATE INDEX idx_request_request_tx_hash ON request (request_tx_hash) WHERE request_tx_hash IS NOT NULL;
CREATE INDEX idx_request_reveal_tx_hash ON request (reveal_tx_hash) WHERE reveal_tx_hash IS NOT NULL;
CREATE INDEX idx_request_sender ON request (sender) WHERE sender IS NOT NULL;
