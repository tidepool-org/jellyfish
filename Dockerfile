FROM node:6.10.3-alpine

WORKDIR /app

COPY . .

RUN apk --no-cache update && \
    apk --no-cache upgrade && \
    yarn install && \
    yarn cache clean

USER node

CMD ["npm", "start"]
