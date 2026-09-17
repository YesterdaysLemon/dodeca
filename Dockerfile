FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm test && node scripts/check.mjs && node scripts/version.mjs && rm -rf .git

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 DATA_DIR=/app/runtime-data PUBLIC_ORIGIN=https://dodeca.alirezaafshan.com
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/runtime-data && chown node:node /app/runtime-data
USER node
VOLUME ["/app/runtime-data"]
EXPOSE 8080
CMD ["node", "server.mjs"]
