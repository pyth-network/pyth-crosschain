# Defined in Dockerfile.lerna
FROM lerna

USER root

WORKDIR /home/node/
USER 1000

ARG NEXT_PUBLIC_RPC_POOL_TOKEN

COPY --chown=1000:1000 target_chains/solana/sdk/js target_chains/solana/sdk/js
COPY --chown=1000:1000 governance/xc_admin governance/xc_admin
COPY --chown=1000:1000 pythnet/message_buffer pythnet/message_buffer
COPY --chown=1000:1000 price_service/sdk/js price_service/sdk/js

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV NEXT_PUBLIC_RPC_POOL_TOKEN $NEXT_PUBLIC_RPC_POOL_TOKEN

RUN npx lerna run build --scope="xc_admin_frontend" --include-dependencies

WORKDIR /home/node/governance/xc_admin/packages/xc_admin_frontend

EXPOSE 3000

ENV PORT 3000

CMD ["npm", "start"]
