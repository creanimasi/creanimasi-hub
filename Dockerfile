FROM node:18-alpine

RUN apk add --no-cache curl

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/server.js ./
COPY backend/hub.js ./

# Copy pre-built React (build lokal, commit ke GitHub)
COPY build/ ./build/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
