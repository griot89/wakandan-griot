#!/bin/bash

# G Assistant Deployment Test Script
# Usage: ./test_deployment.sh

echo "🚀 Testing G Assistant Deployment..."

# Test basic health
echo "📊 Checking health endpoint..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5050/api/health)
if [ "$HEALTH" = "200" ]; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed (HTTP $HEALTH)"
    exit 1
fi

# Test basic chat
echo "💬 Testing basic chat..."
CHAT_RESPONSE=$(curl -s -X POST http://localhost:5050/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, are you working?"}')

if echo "$CHAT_RESPONSE" | grep -q "reply"; then
    echo "✅ Basic chat working"
else
    echo "❌ Basic chat failed"
    echo "Response: $CHAT_RESPONSE"
fi

# Test semantic endpoints
echo "🧠 Testing semantic memory..."
SEMANTIC_RESPONSE=$(curl -s http://localhost:5050/api/semantic/vector/stats)

if echo "$SEMANTIC_RESPONSE" | grep -q "success"; then
    echo "✅ Semantic memory working"
else
    echo "❌ Semantic memory failed"
fi

# Test agent system
echo "🤖 Testing multi-agent system..."
AGENT_RESPONSE=$(curl -s http://localhost:5050/api/semantic/agents)

if echo "$AGENT_RESPONSE" | grep -q "semantic_orchestrator"; then
    echo "✅ Multi-agent system working"
else
    echo "❌ Multi-agent system failed"
fi

echo ""
echo "🎉 G Assistant deployment test complete!"
echo "🔗 Access your G Assistant at: http://localhost:5050"
echo ""
echo "📋 Available endpoints:"
echo "  💬 Chat: POST /api/chat"
echo "  🧠 Semantic: POST /api/semantic/chat" 
echo "  🤖 Agents: POST /api/semantic/agents/execute"
echo "  🎤 Voice: WebSocket connection + interface"
echo "  📊 Health: GET /api/health"
echo "  📈 Metrics: GET /api/metrics"