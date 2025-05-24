FROM node:16 AS build
WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY tsconfig.json tsconfig.json
COPY src ./src
COPY public ./public
COPY astro.config.mjs astro.config.mjs

RUN npm run build

FROM caddy:latest
COPY --from=build /app/dist /usr/share/caddy
EXPOSE 80