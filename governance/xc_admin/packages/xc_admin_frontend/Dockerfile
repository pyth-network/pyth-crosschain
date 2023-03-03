# Defined in tilt_devnet/docker_images/Dockerfile.lerna
FROM lerna

USER root
RUN apt-get update && apt-get install -y libc6

WORKDIR /home/node/
USER 1000

COPY --chown=1000:1000 governance/xc_admin governance/xc_admin

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN npx lerna run build --scope="xc_admin_frontend" --include-dependencies

WORKDIR /home/node/governance/xc_admin/packages/xc_admin_frontend

EXPOSE 3000

ENV PORT 3000

CMD ["npm", "start"]
