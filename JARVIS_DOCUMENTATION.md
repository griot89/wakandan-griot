# 🤖 JARVIS-Wakandan Hybrid System Documentation

## Overview

The Wakandan Griot has been transformed into a sophisticated JARVIS-like AI assistant that combines the advanced technology of Tony Stark's JARVIS with Wakandan Vibranium enhancements. This system provides intelligent, context-aware assistance with real-world tool execution capabilities through MCP (Model Context Protocol).

## 🎯 Core Features

### 1. **Advanced AI Processing**
- Support for multiple AI models (OpenAI GPT-4, Anthropic Claude)
- Intelligent fallback to local processing
- Context-aware conversation with memory
- Intent analysis and entity extraction
- Proactive assistance and recommendations

### 2. **MCP Tool Orchestration**
- Filesystem operations
- Web fetching and searching
- Memory and data persistence
- Extensible tool framework
- Real-time tool execution

### 3. **Voice Synthesis**
- ElevenLabs premium voice (ID: Z8dg0fyk7p6js7cQ7lgi)
- Natural, conversational speech
- Fallback to browser TTS

### 4. **Personality & Behavior**
- JARVIS-inspired personality
- Professional yet personable
- Subtle wit and humor
- Proactive problem-solving
- Wakandan cultural elements

## 🚀 API Endpoints

### Core Endpoints

#### 1. JARVIS Query (Advanced)
```http
POST /api/jarvis/query
Content-Type: application/json

{
  "query": "Your question or command",
  "context": {
    "source": "web-ui",
    "urgent": false,
    "followUp": false
  },
  "tools": ["specific", "tools", "to", "use"]
}
```

**Response:**
```json
{
  "success": true,
  "response": "JARVIS's intelligent response",
  "metadata": {
    "model": "gpt-4 or local-intelligence",
    "analysis": {
      "intent": "detected intent",
      "entities": [],
      "requiredTools": [],
      "confidence": 0.8
    },
    "toolResults": {},
    "processingTime": 123,
    "capabilities": {
      "mcp": true,
      "ai": true,
      "tools": ["available", "tools"]
    }
  },
  "timestamp": "2025-08-15T06:00:00.000Z"
}
```

#### 2. System Status
```http
GET /api/jarvis/status
```

**Response:**
```json
{
  "online": true,
  "version": "3.0.0",
  "name": "JARVIS-Wakandan Hybrid",
  "capabilities": {
    "ai": {
      "available": true,
      "models": ["gpt-4", "claude-3", "local-intelligence"],
      "conversationHistory": 10
    },
    "mcp": {
      "connected": true,
      "servers": ["filesystem", "fetch", "memory"],
      "tools": ["read_file", "write_file", "search_web"],
      "resources": []
    },
    "voice": {
      "tts": {
        "elevenlabs": true,
        "voiceId": "Z8dg0fyk7p6js7cQ7lgi"
      }
    }
  }
}
```

#### 3. Clear History
```http
POST /api/jarvis/clear-history
```

#### 4. Legacy Griot Endpoint
```http
POST /api/griot/wisdom
Content-Type: application/json

{
  "message": "Your message"
}
```

## 🔧 Configuration

### Environment Variables (.env)

```env
# Voice Configuration
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=Z8dg0fyk7p6js7cQ7lgi

# AI Model Configuration
OPENAI_API_KEY=your_openai_key        # Optional: For GPT-4
ANTHROPIC_API_KEY=your_anthropic_key  # Optional: For Claude
AI_MODEL=gpt-4                        # Primary model

# MCP Configuration
MCP_ENABLED=true
MCP_DEFAULT_SERVERS=filesystem,fetch,memory

# Server Configuration
PORT=3000
NODE_ENV=production
```

## 🧠 Intelligence Layers

### 1. AI Orchestrator
Manages AI model interactions and intelligent response generation:
- **Intent Analysis**: Understands user intent from queries
- **Entity Extraction**: Identifies dates, names, numbers, URLs
- **Tool Selection**: Determines which tools are needed
- **Response Generation**: Creates contextual, helpful responses
- **Conversation Memory**: Maintains context across interactions

### 2. MCP Manager
Handles Model Context Protocol connections and tool execution:
- **Server Management**: Connects to MCP servers
- **Tool Discovery**: Finds available tools from servers
- **Tool Execution**: Runs tools with appropriate parameters
- **Resource Monitoring**: Tracks available resources
- **Event Handling**: Manages notifications and updates

### 3. Fallback System
Ensures continuous operation:
- **Primary**: AI models (GPT-4, Claude)
- **Secondary**: Local intelligence
- **Tertiary**: Pre-programmed responses

## 📊 Usage Examples

### Basic Conversation
```javascript
fetch('/api/jarvis/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "What's the weather like today?"
  })
});
```

### Complex Task
```javascript
fetch('/api/jarvis/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "Create a Python script that analyzes sales data",
    context: {
      source: "development",
      project: "analytics"
    },
    tools: ["filesystem", "code_executor"]
  })
});
```

### Voice Synthesis
```javascript
fetch('/api/tts/elevenlabs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: "Good morning, Sir. All systems are operational."
  })
});
```

## 🎭 Personality Profile

### JARVIS Characteristics
- **Professional**: Maintains formal yet friendly demeanor
- **Intelligent**: Demonstrates deep understanding
- **Proactive**: Anticipates needs and offers solutions
- **Witty**: Occasional dry humor and clever observations
- **Loyal**: Dedicated to user's success

### Wakandan Enhancements
- **Wisdom**: References ancient knowledge
- **Innovation**: Combines tradition with technology
- **Community**: Emphasizes collective good
- **Power**: Vibranium-enhanced capabilities

## 🔌 MCP Tool Categories

### Available Tools (when configured)
1. **Filesystem Operations**
   - Read files
   - Write files
   - List directories
   - File manipulation

2. **Web Operations**
   - Fetch URLs
   - Search web
   - API calls
   - Data retrieval

3. **Memory Operations**
   - Store information
   - Retrieve data
   - Manage context
   - Persistent storage

4. **Extensible Tools**
   - Custom MCP servers
   - Third-party integrations
   - Service connections

## 🚦 System States

### Operational Modes
1. **Full Capability**: All AI models and MCP tools available
2. **Limited AI**: Local intelligence only, MCP available
3. **Limited Tools**: AI available, MCP unavailable
4. **Basic Mode**: Local intelligence, no MCP
5. **Fallback Mode**: Pre-programmed responses only

## 📈 Performance Optimization

### Best Practices
1. **Conversation Management**
   - Clear history periodically for long sessions
   - Use context parameters for related queries
   - Specify tools when known

2. **Resource Usage**
   - Monitor API usage for cost management
   - Use local intelligence for simple queries
   - Cache responses when appropriate

3. **Tool Selection**
   - Be specific about required tools
   - Allow automatic tool discovery for complex tasks
   - Monitor tool execution results

## 🔒 Security Considerations

1. **API Key Management**
   - Store keys in .env file
   - Never commit keys to repository
   - Use environment-specific keys

2. **Tool Execution**
   - Validate tool parameters
   - Implement rate limiting
   - Monitor for suspicious activity

3. **Data Privacy**
   - Conversation history is temporary
   - Clear history endpoint available
   - No permanent storage without consent

## 🎯 Future Enhancements

### Planned Features
1. **Vision Capabilities**: Image analysis and generation
2. **Advanced Automation**: Complex workflow execution
3. **Learning System**: User preference adaptation
4. **Multi-modal Input**: Voice commands, gestures
5. **Distributed Processing**: Cloud-edge hybrid
6. **Custom Personalities**: User-defined assistant profiles

## 📚 Troubleshooting

### Common Issues

1. **MCP Connection Failures**
   - Check Node.js version (16+)
   - Verify MCP server packages
   - Review error logs

2. **AI Model Unavailable**
   - Verify API keys in .env
   - Check API quotas
   - Falls back to local intelligence

3. **Voice Synthesis Issues**
   - Confirm ElevenLabs API key
   - Check voice ID validity
   - Browser TTS as fallback

## 🤝 Contributing

To extend JARVIS capabilities:

1. **Add MCP Servers**: Configure in MCPManager.js
2. **Enhance AI**: Update AIOrchestrator.js
3. **Add Tools**: Implement tool functions
4. **Improve UI**: Enhance public/index.html

## 📖 References

- [Model Context Protocol](https://modelcontextprotocol.io)
- [OpenAI API](https://platform.openai.com)
- [Anthropic Claude](https://www.anthropic.com)
- [ElevenLabs](https://elevenlabs.io)

---

**"At your service, Sir."** - JARVIS

**Wakanda Forever!** 🐾