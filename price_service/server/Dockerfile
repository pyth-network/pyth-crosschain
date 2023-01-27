FROM node:16-alpine@sha256:72a490e7ed8aed68e16b8dc8f37b5bcc35c5b5c56ee3256effcdee63e2546f93

ARG BASE_PATH=/usr/src/pyth2wormhole
RUN addgroup -S pyth -g 10001 && adduser -S pyth -G pyth -u 10001
USER pyth

# Adds wormhole_attester/sdk/js dependency
ARG ATTESTER_SDK_REL_PATH=wormhole_attester/sdk/js
WORKDIR ${BASE_PATH}/${ATTESTER_SDK_REL_PATH}
COPY --chown=pyth:pyth ${ATTESTER_SDK_REL_PATH} .
RUN npm ci && npm run build && npm cache clean --force

ARG PRICE_SERVICE_REL_PATH=price_service/server
WORKDIR ${BASE_PATH}/${PRICE_SERVICE_REL_PATH}
COPY --chown=pyth:pyth ${PRICE_SERVICE_REL_PATH} .
RUN npm ci && npm run build && npm cache clean --force

# If you are building for production
# RUN npm ci --only=production

RUN mkdir -p ${BASE_PATH}/${PRICE_SERVICE_REL_PATH}/logs

CMD [ "npm", "run", "start" ]
