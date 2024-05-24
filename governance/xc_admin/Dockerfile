# Defined in Dockerfile.lerna
FROM lerna

USER root

WORKDIR /home/node/
USER 1000

COPY --chown=1000:1000 target_chains/solana/sdk/js target_chains/solana/sdk/js
COPY --chown=1000:1000 governance/xc_admin governance/xc_admin
COPY --chown=1000:1000 pythnet/message_buffer pythnet/message_buffer
COPY --chown=1000:1000 price_service/sdk/js price_service/sdk/js

RUN npx lerna run build --scope="{@pythnetwork/xc-admin-crank-executor,@pythnetwork/xc-admin-crank-pythnet-relayer,@pythnetwork/xc-admin-proposer-server}" --include-dependencies

WORKDIR /home/node/governance/xc_admin

CMD [ "npx", "node", "packages/crank_executor/lib/index.js" ]
