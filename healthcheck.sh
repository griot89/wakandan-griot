#!/bin/bash

# Health check script for G Assistant Docker container
set -e

# Check if the main process is running
if ! pgrep -f "node.*g_server_realtime.js" > /dev/null; then
    echo "Main G Assistant process not running"
    exit 1
fi

# Check if the HTTP server is responding
if ! curl -f -s http://localhost:5050/api/health > /dev/null; then
    echo "HTTP server not responding"
    exit 1
fi

# Check if WebSocket server is accessible
if ! nc -z localhost 5050; then
    echo "WebSocket server not accessible"
    exit 1
fi

echo "G Assistant is healthy"
exit 0