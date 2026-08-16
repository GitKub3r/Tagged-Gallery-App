FROM node:22-bookworm

WORKDIR /app

COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

RUN npm ci \
    && npm ci --prefix client \
    && npm ci --prefix server

COPY . .

EXPOSE 5173 3000

CMD ["npm", "run", "docker:dev"]
