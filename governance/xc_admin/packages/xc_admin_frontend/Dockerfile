# Defined in Dockerfile.node
FROM builder-base AS xc-admin-frontend-builder
ARG NEXT_PUBLIC_RPC_POOL_TOKEN
ENV NEXT_TELEMETRY_DISABLED 1
ENV BUILD_STANDALONE true
ENV NEXT_PUBLIC_RPC_POOL_TOKEN $NEXT_PUBLIC_RPC_POOL_TOKEN
ENV CI true
RUN pnpm turbo build --filter @pythnetwork/xc-admin-frontend


# See https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile
# Defined in Dockerfile.node
FROM runner-base as xc-admin-frontend
COPY --from=xc-admin-frontend-builder --chown=pyth:pyth /usr/src/pyth/governance/xc_admin/packages/xc_admin_frontend/.next/standalone ./
COPY --from=xc-admin-frontend-builder --chown=pyth:pyth /usr/src/pyth/governance/xc_admin/packages/xc_admin_frontend/.next/static ./governance/xc_admin/packages/xc_admin_frontend/.next/static
COPY --from=xc-admin-frontend-builder /usr/src/pyth/governance/xc_admin/packages/xc_admin_frontend/public ./governance/xc_admin/packages/xc_admin_frontend/public
ENV NEXT_TELEMETRY_DISABLED 1
ENV HOSTNAME 0.0.0.0
ENV PORT 3000
EXPOSE $PORT
CMD [ "node", "governance/xc_admin/packages/xc_admin_frontend/server.js" ]
