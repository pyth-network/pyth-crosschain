CREATE TABLE request(
                    chain_id VARCHAR(255) NOT NULL,
                    sequence INTEGER NOT NULL,
                    created_at DATETIME NOT NULL,
                    last_updated_at DATETIME NOT NULL,
                    state VARCHAR(255) NOT NULL,
                    request_block_number INT NOT NULL,
                    request_tx_hash VARCHAR(255) NOT NULL,
                    sender VARCHAR(255) NOT NULL,
                    reveal_block_number INT,
                    reveal_tx_hash VARCHAR(255),
                    info TEXT,
                    PRIMARY KEY (chain_id, sequence)
);

CREATE INDEX idx_request_sequence ON request (sequence);
CREATE INDEX idx_request_chain_id_created_at ON request (chain_id, created_at);
CREATE INDEX idx_request_created_at ON request (created_at);
CREATE INDEX idx_request_request_tx_hash ON request (request_tx_hash) WHERE request_tx_hash IS NOT NULL;
CREATE INDEX idx_request_reveal_tx_hash ON request (reveal_tx_hash) WHERE reveal_tx_hash IS NOT NULL;
CREATE INDEX idx_request_sender ON request (sender) WHERE sender IS NOT NULL;
