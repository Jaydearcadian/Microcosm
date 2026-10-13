FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci

EXPOSE 3000

CMD ["npm", "run", "start:api"]

