# Defined in Dockerfile.builder
FROM builder AS price-pusher-builder
RUN apt-get update && apt-get install -y git
RUN pnpm exec lerna run build --scope="@pythnetwork/price-pusher" --include-dependencies
RUN pnpm deploy --filter @pythnetwork/price-pusher --prod /srv/price-pusher


# Defined in Dockerfile.runner
FROM runner as price-pusher
COPY --from=price-pusher-builder --chown=pyth:pyth /srv/price-pusher ./
CMD [ "node", "lib/index.js" ]
