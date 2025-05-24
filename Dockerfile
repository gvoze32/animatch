FROM node:18 AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY astro.config.mjs ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM node:18 AS prod
WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist ./dist

CMD ["serve", "-s", "dist", "-l", "8080"]

EXPOSE 8080