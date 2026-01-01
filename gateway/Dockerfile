# Gateway (NestJS) Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
# Copy package manifests
COPY package*.json ./
# Install all dependencies (including dev) for building
# Prefer reproducible install via lockfile; fall back to install if lock is out of sync
RUN npm ci || npm install --include=dev

FROM node:20-alpine AS builder
WORKDIR /app
# Bring in node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy package manifest and configs
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src
# Build to dist/
RUN npm run build

FROM node:20-alpine AS runner
# Install curl for healthcheck used in docker-compose
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
# Copy built app and necessary runtime files
COPY --from=builder /app/dist ./dist
COPY package*.json ./
# Use node_modules from deps and prune dev dependencies for slim runtime
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev
EXPOSE 3001
CMD ["npm", "run", "start:prod"]