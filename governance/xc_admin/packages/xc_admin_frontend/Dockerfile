# Defined in Dockerfile.lerna
FROM lerna

USER root

WORKDIR /home/node/
USER 1000

COPY --chown=1000:1000 governance/xc_admin governance/xc_admin
COPY --chown=1000:1000 pythnet/message_buffer pythnet/message_buffer

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN npx lerna run build --scope="xc_admin_frontend" --include-dependencies

WORKDIR /home/node/governance/xc_admin/packages/xc_admin_frontend

EXPOSE 3000

ENV PORT 3000

CMD ["npm", "start"]
