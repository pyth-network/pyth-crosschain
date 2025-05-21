-- U256 max value is 78 digits, so 100 is a safe upper bound
ALTER TABLE request
ADD COLUMN gas_used VARCHAR(100);
ALTER TABLE request
ADD COLUMN gas_limit VARCHAR(100) NOT NULL;
