# Use Node 22 LTS
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies needed for build
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and compile
COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY src ./src
COPY prisma ./prisma
RUN ./node_modules/.bin/prisma generate
RUN npm run build

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install production-only dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled app and generated Prisma client
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

# Run as the unprivileged user shipped with the node image.
RUN chown -R node:node /app
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Apply every pending Prisma migration before accepting sync requests.
# Uses the pinned prisma from package-lock (never `npx`, which could download another version).
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
