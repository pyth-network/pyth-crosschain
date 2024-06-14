FROM public.ecr.aws/bitnami/node:18
RUN apt-get update && apt-get install -y git python3 make gcc g++ && corepack enable
RUN npm install -g typescript
RUN npm install -g lerna
RUN npm install -g ts-node
WORKDIR /app
COPY . .
RUN pnpm install
RUN pnpm exec lerna run build --scope @pythnetwork/price-pusher --include-dependencies
WORKDIR /app/apps/price_pusher