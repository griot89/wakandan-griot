# G Assistant Docker Image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for audio processing and other tools
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    git \
    curl \
    sqlite

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S gassistant -u 1001

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories with proper permissions
RUN mkdir -p logs temp g_brain src/temp && \
    chown -R gassistant:nodejs /app && \
    chmod -R 755 /app

# Switch to non-root user
USER gassistant

# Create health check script
RUN echo '#!/bin/sh\ncurl -f http://localhost:5050/health || exit 1' > /app/healthcheck.sh && \
    chmod +x /app/healthcheck.sh

# Expose the application port
EXPOSE 5050

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /app/healthcheck.sh

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5050

# Start the application
CMD ["node", "g_server_realtime.js"]