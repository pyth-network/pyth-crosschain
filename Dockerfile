FROM node:18.20-slim@sha256:1da7652745e9ba5de396e436aa086588ea50d532540fa3147fbc1957c43a46ab 
RUN apt-get update && apt-get install -y git python3 make gcc g++ && corepack enable
RUN npm install -g typescript
RUN npm install -g lerna
RUN npm install -g ts-node
WORKDIR /app
COPY . .
RUN npm install
RUN pnpm install
RUN pnpm exec lerna run build --scope @pythnetwork/price-pusher --include-dependencies
CMD ["npm", "run"]