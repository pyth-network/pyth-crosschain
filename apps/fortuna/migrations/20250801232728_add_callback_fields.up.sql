-- Add callback_failed, callback_return_value, and callback_gas_used to the requests table.
ALTER TABLE request ADD COLUMN callback_failed INTEGER;
ALTER TABLE request ADD COLUMN callback_return_value VARCHAR;
ALTER TABLE request ADD COLUMN callback_gas_used VARCHAR(100);
