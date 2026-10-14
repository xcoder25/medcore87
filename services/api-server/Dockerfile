# Multi-stage Dockerfile for @medcore/api-server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy repo configuration needed for workspaces
COPY package.json package-lock.json* ./
COPY packages/types ./packages/types
COPY services/api-server ./services/api-server

RUN npm install
RUN npm run build --workspace=services/api-server

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY package.json ./
COPY packages/types ./packages/types
COPY services/api-server/package.json ./services/api-server/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/api-server/dist ./services/api-server/dist

EXPOSE 4000

CMD ["node", "services/api-server/dist/server.js"]
