# ============================================================================
# SENA 3D Landing Page & Meta WhatsApp Bot — Google Cloud Run Dockerfile
# ============================================================================
FROM node:20-alpine AS base

WORKDIR /usr/src/app

# Install dependencies with clean lock
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy application source and 3D assets
COPY server.js ./
COPY public ./public

# Cloud Run mandates listening on 0.0.0.0:$PORT (default 8080)
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Run as non-root user for GCP security best practices
USER node

EXPOSE 8080

CMD ["node", "server.js"]
