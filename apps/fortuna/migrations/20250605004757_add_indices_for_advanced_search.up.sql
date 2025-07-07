-- Add up migration script here

DROP INDEX idx_request_sequence;
DROP INDEX idx_request_network_id_created_at;
DROP INDEX idx_request_created_at;
DROP INDEX idx_request_request_tx_hash;
DROP INDEX idx_request_reveal_tx_hash;
DROP INDEX idx_request_sender;


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
