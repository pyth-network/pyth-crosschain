# Defined in tilt_devnet/docker_images/Dockerfile.lerna
FROM lerna:latest

USER root

WORKDIR /home/node/
USER 1000

# local dependencies
COPY --chown=1000:1000 target_chains/ethereum/sdk/solidity target_chains/ethereum/sdk/solidity
COPY --chown=1000:1000 price_service/client/js price_service/client/js
COPY --chown=1000:1000 price_service/sdk/js price_service/sdk/js

COPY --chown=1000:1000 price_pusher price_pusher

RUN npx lerna run build --scope="@pythnetwork/price-pusher" --include-dependencies

WORKDIR /home/node/price_pusher

ENTRYPOINT [ "npm", "run", "start" ]
