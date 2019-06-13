FROM node:6.10.3-alpine

RUN apk --no-cache update && \
    apk --no-cache upgrade

WORKDIR /app

COPY package.json package.json

RUN yarn install && \
    yarn cache clean

USER node

COPY . .

CMD ["npm", "start"]
