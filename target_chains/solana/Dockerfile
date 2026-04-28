#
# Docker image to generate a deterministic build of the Pyth Solana Receiver
# program. This image extends backpackapp/build to support local dependencies
# outside the Cargo workspace of the program.
#

FROM backpackapp/build:v0.32.0

WORKDIR /workspace

COPY pythnet/pythnet_sdk pythnet/pythnet_sdk
COPY target_chains/solana target_chains/solana

WORKDIR /workspace/target_chains/solana

CMD ["bash", "-c", \
        "anchor build --arch sbf && cp target/deploy/*.so /artifacts"]
