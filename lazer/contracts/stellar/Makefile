.PHONY: build optimize test clean fmt fmt-check clippy check deploy-testnet

WASM_DIR = $(CURDIR)/target/wasm32-unknown-unknown/release

build:
	cd $(CURDIR) && cargo build --release --target wasm32-unknown-unknown

optimize: build
	wasm-opt -Oz --disable-reference-types \
		$(WASM_DIR)/wormhole_executor_stellar.wasm \
		-o $(WASM_DIR)/wormhole_executor_stellar.optimized.wasm
	wasm-opt -Oz --disable-reference-types \
		$(WASM_DIR)/pyth_lazer_stellar.wasm \
		-o $(WASM_DIR)/pyth_lazer_stellar.optimized.wasm

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
