.PHONY: artifacts
artifacts: build

.PHONY: build
build:
	aptos move compile --save-metadata

.PHONY: clean
clean:
	aptos move clean --assume-yes

.PHONY: test
test:
	aptos move test
