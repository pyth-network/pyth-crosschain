-- Add up migration script here

CREATE INDEX request__request_tx_hash ON request (request_tx_hash) WHERE request_tx_hash IS NOT NULL;
CREATE INDEX request__reveal_tx_hash ON request (reveal_tx_hash) WHERE reveal_tx_hash IS NOT NULL;
