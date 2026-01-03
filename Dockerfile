# Use official Node.js runtime as base image
FROM node:18-bullseye

# Install system dependencies required for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium-browser \
    chromium-common \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    python3 \
    python3-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create symbolic link for chromium-browser
RUN ln -s /usr/bin/chromium-browser /usr/bin/chromium

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including optional dependencies for sqlite3
RUN npm install --production

# Create non-root user and set permissions
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -m -s /bin/bash -g nodejs hacker-news

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