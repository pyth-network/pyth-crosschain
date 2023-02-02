# Defined in tilt_devnet/docker_images/Dockerfile.lerna
FROM lerna

USER root
RUN apt-get update && apt-get install -y ncat

WORKDIR /home/node/
USER 1000

COPY --chown=1000:1000 price_service/client/js price_service/client/js
COPY --chown=1000:1000 price_service/sdk/js price_service/sdk/js

RUN npx lerna run build --scope="@pythnetwork/price-service-client" --include-dependencies

WORKDIR /home/node/price_service/client/js

ENTRYPOINT ["npm"]
