-- Remove callback_failed, callback_return_value, and callback_gas_used from the requests table.
ALTER TABLE request DROP COLUMN callback_failed;
ALTER TABLE request DROP COLUMN callback_return_value;
ALTER TABLE request DROP COLUMN callback_gas_used;
