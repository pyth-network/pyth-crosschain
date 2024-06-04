# Defined in Dockerfile.lerna
FROM lerna

USER root
RUN apt-get update && apt-get install -y ncat

WORKDIR /home/node/
USER 1000

COPY --chown=1000:1000 apps/hermes/client/js apps/hermes/client/js

RUN npx lerna run build --scope="@pythnetwork/hermes-client" --include-dependencies

WORKDIR /home/node/apps/hermes/client/js

ENTRYPOINT ["npm"]
