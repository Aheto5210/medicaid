FROM node:20-alpine

WORKDIR /app


COPY scripts ./scripts
COPY src ./src
COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

CMD ["npm", "start"]
