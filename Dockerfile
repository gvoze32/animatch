FROM node:18 AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY astro.config.mjs ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM caddy:latest
COPY --from=build /app/dist /usr/share/caddy
EXPOSE 80