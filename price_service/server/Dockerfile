# Defined in Dockerfile.lerna
FROM lerna

USER root
RUN apt-get update && apt-get install -y ncat

WORKDIR /home/node/
USER 1000

COPY --chown=1000:1000 price_service/server price_service/server
COPY --chown=1000:1000 price_service/sdk/js price_service/sdk/js
COPY --chown=1000:1000 wormhole_attester/sdk/js wormhole_attester/sdk/js

RUN npx lerna run build --scope="@pythnetwork/price-service-server" --include-dependencies

WORKDIR /home/node/price_service/server

CMD [ "npm", "run", "start" ]
