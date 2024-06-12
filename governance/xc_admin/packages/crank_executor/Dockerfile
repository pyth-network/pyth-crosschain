# Defined in Dockerfile.builder
FROM builder AS xc-admin-crank-executor-builder
RUN pnpm exec lerna run build --scope="@pythnetwork/xc-admin-crank-executor" --include-dependencies
RUN pnpm deploy --filter @pythnetwork/xc-admin-crank-executor --prod /srv/xc-admin-crank-executor


# Defined in Dockerfile.runner
FROM runner as xc-admin-crank-executor
COPY --from=xc-admin-crank-executor-builder --chown=pyth:pyth /srv/xc-admin-crank-executor ./
CMD [ "node", "lib/index.js" ]
