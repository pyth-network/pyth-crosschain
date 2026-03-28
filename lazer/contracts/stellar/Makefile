.PHONY: build test clean

build:
	cd $(CURDIR) && cargo build --release --target wasm32-unknown-unknown

test:
	cd $(CURDIR) && cargo test

clean:
	cd $(CURDIR) && cargo clean
