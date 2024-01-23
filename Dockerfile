### Stage 0 - Base image
FROM node:20.11.0-alpine as base
WORKDIR /app
RUN apk --no-cache update && \
    apk --no-cache upgrade && \
    apk add --no-cache --virtual .build-dependencies python3 make g++

### Stage 1 - Cached node_modules image
FROM base as dependencies
COPY package.json .
COPY package-lock.json .
RUN NODE_ENV=production npm install && mv node_modules node_modules_production
RUN NODE_ENV=development npm install && mv node_modules node_modules_development

### Stage 2 - Development image
FROM base as development
ENV NODE_ENV=development
COPY --from=dependencies /app/node_modules_development ./node_modules
COPY . .
USER nobody
CMD ["node", "app"]

### Stage 3 - Production image
FROM base as production
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules_production ./node_modules
COPY . .
USER nobody
CMD ["node", "app"]
