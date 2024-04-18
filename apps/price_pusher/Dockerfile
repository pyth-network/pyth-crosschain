# Defined in Dockerfile.lerna
FROM lerna:latest

USER root

WORKDIR /home/node/
USER 1000

# local dependencies
COPY --chown=1000:1000 target_chains/ethereum/sdk/solidity target_chains/ethereum/sdk/solidity
COPY --chown=1000:1000 target_chains/sui/sdk/js target_chains/sui/sdk/js
COPY --chown=1000:1000 price_service/client/js price_service/client/js
COPY --chown=1000:1000 price_service/sdk/js price_service/sdk/js
COPY --chown=1000:1000 target_chains/solana/sdk/js target_chains/solana/sdk/js

COPY --chown=1000:1000 apps/price_pusher apps/price_pusher

RUN npx lerna run build --scope="@pythnetwork/price-pusher" --include-dependencies

WORKDIR /home/node/apps/price_pusher

ENTRYPOINT [ "npm", "run", "start" ]
