.PHONY: build test clean fmt clippy check deploy-testnet

build:
	cd $(CURDIR) && cargo build --release --target wasm32-unknown-unknown

test:
	cd $(CURDIR) && cargo test

clean:
	cd $(CURDIR) && cargo clean

fmt:
	cd $(CURDIR) && cargo fmt --all

fmt-check:
	cd $(CURDIR) && cargo fmt --all -- --check

clippy:
	cd $(CURDIR) && cargo clippy --all-targets -- -D warnings

check: fmt-check clippy test
