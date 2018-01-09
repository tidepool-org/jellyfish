FROM node:6.10.3-alpine

WORKDIR /app

COPY . .

RUN yarn install

USER node

CMD ["npm", "start"]
