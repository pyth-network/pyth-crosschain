-- Add down migration script here

DROP INDEX request__network_id__state__created_at;
DROP INDEX request__network_id__created_at;
DROP INDEX request__sender__network_id__state__created_at;
DROP INDEX request__sender__network_id__created_at;
DROP INDEX request__sender__state__created_at;
DROP INDEX request__sender__created_at;
DROP INDEX request__sequence__network_id__state__created_at;
DROP INDEX request__sequence__network_id__created_at;
DROP INDEX request__sequence__state__created_at;
DROP INDEX request__sequence__created_at;
DROP INDEX request__state__created_at;
DROP INDEX request__created_at;


CREATE INDEX idx_request_sequence ON request (sequence);
CREATE INDEX idx_request_network_id_created_at ON request (network_id, created_at);
CREATE INDEX idx_request_created_at ON request (created_at);
CREATE INDEX idx_request_request_tx_hash ON request (request_tx_hash) WHERE request_tx_hash IS NOT NULL;
CREATE INDEX idx_request_reveal_tx_hash ON request (reveal_tx_hash) WHERE reveal_tx_hash IS NOT NULL;
CREATE INDEX idx_request_sender ON request (sender) WHERE sender IS NOT NULL;
