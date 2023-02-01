# Defined in tilt_devnet/docker_images/Dockerfile.lerna
FROM lerna

USER root

WORKDIR /home/node/
USER 1000

COPY --chown=1000:1000 governance/xc_admin/packages/crank_executor governance/xc_admin/packages/crank_executor

RUN npx lerna run build --scope="crank_executor" --include-dependencies

WORKDIR /home/node/governance/xc_admin/packages/crank_executor

CMD [ "npx", "node", "lib/index.js" ]
