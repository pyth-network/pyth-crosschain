FROM node:16-alpine@sha256:72a490e7ed8aed68e16b8dc8f37b5bcc35c5b5c56ee3256effcdee63e2546f93

RUN addgroup -S pyth -g 10001 && adduser -S pyth -G pyth -u 10001
USER pyth

ARG PRICE_PUSHER_PATH=/usr/src/pyth-evm-price-pusher
WORKDIR ${PRICE_PUSHER_PATH}
COPY --chown=pyth:pyth . .
RUN npm ci && npm run build && npm cache clean --force

ENTRYPOINT [ "npm", "run", "start" ]
