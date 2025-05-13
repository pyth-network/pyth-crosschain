CREATE TABLE log(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain_id VARCHAR(255) NOT NULL,
        sequence INTEGER NOT NULL,
        timestamp DATETIME NOT NULL,
        type VARCHAR(255) NOT NULL,
        block_number INT,
        info TEXT,
        tx_hash VARCHAR(255)
);

CREATE INDEX idx_log_chain_id_sequence ON log (chain_id, sequence);
CREATE INDEX idx_log_chain_id_timestamp ON log (chain_id, timestamp);
CREATE INDEX idx_log_timestamp ON log (timestamp);
CREATE INDEX idx_log_tx_hash ON log (tx_hash) WHERE tx_hash IS NOT NULL;
