### Stage 0 - Base image
FROM node:10.14.2-alpine as base
WORKDIR /app
RUN apk --no-cache update && \
    apk --no-cache upgrade && \
    apk add --no-cache --virtual .build-dependencies gitpython make g++ && \
    mkdir -p node_modules && chown -R node:node .


### Stage 2 - Create cached `node_modules`
# Only rebuild layer if `package.json` has changed
FROM base as dependencies
COPY package.json .
COPY package-lock.json .
RUN \
  # Build and separate all dependancies required for production
  npm install --production && cp -R node_modules production_node_modules \
  # Build all modules, including `devDependancies`
  && npm install


### Stage 3 - Development root with Chromium installed for unit tests
FROM base as development
ENV NODE_ENV=development
# Copy all `node_modules` dependencies
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
# Copy source files
COPY --chown=node:node . .
USER node
CMD ["npm", "start"]


### Stage 4 - Serve production-ready release
FROM base as production
ENV NODE_ENV=production
# Copy only `node_modules` needed to run the server
COPY --from=dependencies /app/production_node_modules ./node_modules
# Copy source files
COPY --chown=node:node . .
USER node
CMD ["npm", "start"]
