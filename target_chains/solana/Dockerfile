#
# Docker image to generate a deterministic build of the Pyth Solana Receiver
# program. This image extends backpackapp/build to support local dependencies
# outside the Cargo workspace of the program.
#

FROM backpackapp/build:v0.29.0@sha256:9aee169b2d8b89b4a4243419ae35c176773136e78d751b3e439eff692c9c1293

WORKDIR /workspace

COPY pythnet/pythnet_sdk pythnet/pythnet_sdk
COPY target_chains/solana target_chains/solana

WORKDIR /workspace/target_chains/solana

CMD ["bash", "-c", \
        "anchor build --arch sbf && cp target/deploy/*.so /artifacts"]
