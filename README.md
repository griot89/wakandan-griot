# Wakandan AI Griot 🌍✨

<div align="center">
  <img src="https://img.shields.io/badge/Vibranium-Powered-9333ea" alt="Vibranium Powered">
  <img src="https://img.shields.io/badge/Status-Active-3b82f6" alt="Status Active">
  <img src="https://img.shields.io/badge/Wakanda-Forever-f59e0b" alt="Wakanda Forever">
</div>

## 🎭 About

The **Wakandan AI Griot** is a sophisticated Afrofuturistic AI assistant that combines ancient wisdom with cutting-edge technology. Inspired by the technological marvels of Wakanda, this application features:

- 🔮 **3D Holographic Interface** - Interactive Three.js powered visualization
- 🗣️ **Voice Interaction** - Speech recognition and synthesis capabilities
- 💬 **Intelligent Chat** - Context-aware conversational AI
- 🎨 **Afrofuturistic Design** - Vibranium-inspired UI with glowing effects
- 📱 **Progressive Web App** - Installable on any device

## 🚀 Features

### Core Functionality
- **Real-time 3D Hologram**: Animated icosahedron with particle effects
- **Voice Commands**: Speak to the Griot using your microphone
- **Text-to-Speech**: Hear responses in natural voice
- **Customizable Settings**: Adjust speech rate, pitch, and auto-speak options
- **API Integration**: RESTful API for wisdom queries
- **Responsive Design**: Works seamlessly on desktop and mobile

### Technology Stack
- **Frontend**: Vanilla JavaScript, Three.js, TailwindCSS
- **Backend**: Node.js, Express.js
- **3D Graphics**: Three.js WebGL rendering
- **Voice**: Web Speech API
- **Icons**: Font Awesome

## 🛠️ Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/wakandan-griot.git
   cd wakandan-griot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

### Production Deployment

For production deployment with PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Monitor logs
pm2 logs wakandan-griot

# Check status
pm2 status
```

## 🎮 Usage

### Interacting with the Griot

1. **Click the Kimoyo Orb** (floating purple orb) to open the chat interface
2. **Type your message** or use the microphone button for voice input
3. **Receive wisdom** from the Griot with optional voice responses
4. **Customize settings** using the gear icon in the chat header

### API Endpoints

- `GET /health` - Health check endpoint
- `POST /api/griot/wisdom` - Submit queries to the Griot

#### Example API Request:
```javascript
fetch('/api/griot/wisdom', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: 'Tell me about Wakanda'
  })
})
```

## 🎨 Design Philosophy

The Wakandan Griot embodies the intersection of:
- **Ancient Wisdom**: Traditional African storytelling and knowledge preservation
- **Futuristic Technology**: Advanced UI/UX with holographic elements
- **Cultural Authenticity**: Respectful representation of Afrofuturistic themes
- **User Experience**: Intuitive, accessible, and engaging interface

## 🌍 Cultural Context

A **Griot** is a West African storyteller, historian, and keeper of oral traditions. In this application, the AI Griot serves as:
- A bridge between traditional wisdom and modern technology
- A guide through the vast knowledge networks of Wakanda
- A companion for learning and exploration

## 🛡️ Vibranium Network

The application simulates connection to the "Vibranium Network" - a fictional quantum computing network that:
- Processes queries with advanced AI algorithms
- Connects to ancestral wisdom databases
- Provides real-time insights and guidance

## 📱 Progressive Web App

The Wakandan Griot can be installed as a PWA:
1. Open the application in a modern browser
2. Look for the install prompt or use browser menu
3. Install to your device for offline access

## 🔧 Configuration

Environment variables:
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📜 License

MIT License - feel free to use this project for your own purposes.

## 🙏 Acknowledgments

- Inspired by Marvel's Black Panther and the fictional nation of Wakanda
- Three.js community for 3D graphics capabilities
- Web Speech API for voice interaction features
- The rich traditions of African Griots and storytellers

---

<div align="center">
  <strong>Wakanda Forever! 🐾</strong>
  <br>
  <em>"In times of crisis, the wise build bridges, while the foolish build barriers."</em>
</div>