FROM node:6.10.3-alpine

# Common ENV
ENV API_SECRET="This is a local API secret for everyone. BsscSHqSHiwrBMJsEGqbvXiuIUPAjQXU" \
    SERVER_SECRET="This needs to be the same secret everywhere. YaHut75NsK1f9UKUXuWqxNN0RUwHFBCy" \
    LONGTERM_KEY="abcdefghijklmnopqrstuvwxyz" \
    DISCOVERY_HOST=hakken:8000 \
    PUBLISH_HOST=hakken \
    METRICS_SERVICE="{ \"type\": \"static\", \"hosts\": [{ \"protocol\": \"http\", \"host\": \"highwater:9191\" }] }" \
    USER_API_SERVICE="{ \"type\": \"static\", \"hosts\": [{ \"protocol\": \"http\", \"host\": \"shoreline:9107\" }] }" \
    SEAGULL_SERVICE="{ \"type\": \"static\", \"hosts\": [{ \"protocol\": \"http\", \"host\": \"seagull:9120\" }] }" \
    GATEKEEPER_SERVICE="{ \"type\": \"static\", \"hosts\": [{ \"protocol\": \"http\", \"host\": \"gatekeeper:9123\" }] }" \
# Container specific ENV
    PORT=9122 \
    SERVICE_NAME=jellyfish-local \
    SERVE_STATIC=dist \
    MINIMUM_UPLOADER_VERSION="0.99.0" \
    SCHEMA_VERSION=1 \
    SALT_DEPLOY=itNkczadZ1EeC9fUWR3LnbKFagtYYLOk \
    MONGO_CONNECTION_STRING="mongodb://mongo/data"

WORKDIR /app

COPY package.json /app/package.json
RUN apk --no-cache add git \
 && yarn install \
 && apk del git
COPY . /app

VOLUME /app
USER node

CMD ["npm", "start"]
