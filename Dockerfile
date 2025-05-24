FROM node:16 AS build
WORKDIR /app
COPY package.json package.json
COPY yarn.lock yarn.lock
COPY tsconfig.json tsconfig.json
RUN yarn install
COPY src ./src
COPY public ./public
COPY astro.config.mjs astro.config.mjs
RUN yarn build

FROM caddy:latest
COPY --from=build /app/dist /usr/share/caddy
EXPOSE 80