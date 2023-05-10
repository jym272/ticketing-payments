FROM node:20-alpine AS base

FROM base as deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

FROM base as builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN npm run build

FROM base as runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY . .

ENV NODE_ENV development

CMD npm run dev
