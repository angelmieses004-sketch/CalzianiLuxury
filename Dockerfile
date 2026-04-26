FROM node:20-alpine

# Build tools needed for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
