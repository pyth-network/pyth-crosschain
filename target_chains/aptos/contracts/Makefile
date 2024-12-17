.PHONY: artifacts
artifacts: build

.PHONY: build
build:
	aptos move compile --save-metadata --named-addresses wormhole=0x9236893d6444b208b7e0b3e8d4be4ace90b6d17817ab7d1584e46a33ef5c50c9,deployer=0xa3ad2d9c8114b9a4fe97d45b7a9d3c731148d936b0f5dd396fc20a53a11a70da,pyth=0x9357e76fe965c9956a76181ee49f66d51b7f9c3800182a944ed96be86301e49f

.PHONY: clean
clean:
	aptos move clean --assume-yes

.PHONY: test
test:
	aptos move test
