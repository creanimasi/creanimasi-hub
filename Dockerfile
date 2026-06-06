FROM node:18-alpine

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

CMD ["node", "server.js"]
