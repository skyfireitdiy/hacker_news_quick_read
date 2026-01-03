# Use official Node.js runtime as base image
FROM node:18-alpine

# Install system dependencies required for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    cairo \
    jpeg-dev \
    pango \
    musl-dev \
    giflib-dev \
    lcms2-dev \
    openjpeg-dev \
    jbig2dec \
    libwebp-dev \
    python3 \
    make \
    g++

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including optional dependencies for sqlite3
RUN npm install --production

# Create non-root user and set permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S hacker-news -u 1001

# Copy application code
COPY . .

# Change ownership to non-root user
RUN chown -R hacker-news:nodejs /app

# Create directory for database and set permissions
RUN mkdir -p /app/data && chown hacker-news:nodejs /app/data

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="false" \
    PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"

# Expose port
EXPOSE 3000

# Use non-root user
USER hacker-news

# Start the application
CMD ["node", "server.js"]