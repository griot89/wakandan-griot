# 🎤 ElevenLabs Voice Integration Setup

## Voice ID Configuration

The Wakandan Griot is configured to use the following ElevenLabs voice:

**Voice ID:** `Z8dg0fyk7p6js7cQ7lgi`

This specific voice has been selected for its natural, conversational quality that complements the Griot's wise and welcoming personality.

## 🔧 Setup Instructions

### 1. Get Your ElevenLabs API Key

1. Sign up at [ElevenLabs.io](https://elevenlabs.io)
2. Go to your profile settings
3. Copy your API key from the API section

### 2. Configure the Application

1. Open the `.env` file in the project root:
   ```bash
   nano /home/user/webapp/.env
   ```

2. Replace `your_api_key_here` with your actual API key:
   ```env
   ELEVENLABS_API_KEY=your_actual_api_key_here
   ELEVENLABS_VOICE_ID=Z8dg0fyk7p6js7cQ7lgi
   ```

3. Save the file (Ctrl+X, then Y, then Enter in nano)

### 3. Restart the Server

```bash
cd /home/user/webapp
npx pm2 restart wakandan-griot
```

### 4. Verify Integration

1. Open the application in your browser
2. Click the Kimoyo Orb to open chat
3. Send a message and wait for response
4. The response should automatically play with the ElevenLabs voice
5. Look for the "ElevenLabs" indicator in the chat header

## 🎯 Features

### Voice Settings

The integration uses optimized settings for the Griot personality:

- **Stability:** 0.75 (Consistent voice character)
- **Similarity Boost:** 0.75 (Natural voice matching)
- **Style:** 0.5 (Balanced expression)
- **Speaker Boost:** Enabled (Enhanced clarity)

### API Endpoints

The server exposes the following TTS endpoint:

```http
POST /api/tts/elevenlabs
Content-Type: application/json

{
  "text": "Your text to convert to speech",
  "voiceSettings": {
    "stability": 0.75,
    "similarity_boost": 0.75,
    "style": 0.5,
    "use_speaker_boost": true
  }
}
```

### Response Format

```json
{
  "success": true,
  "audio": "data:audio/mpeg;base64,...",
  "voiceId": "Z8dg0fyk7p6js7cQ7lgi"
}
```

## 🔄 Fallback System

The application includes intelligent fallback:

1. **Primary:** ElevenLabs API with specified voice ID
2. **Fallback:** Browser's built-in speech synthesis
3. **Visual Indicators:** Shows when ElevenLabs is active

## 📊 Usage Monitoring

### Check API Status

```bash
# View logs to see ElevenLabs API calls
npx pm2 logs wakandan-griot --lines 50
```

### Browser Console

Open browser developer console to see:
- "Using ElevenLabs voice: Z8dg0fyk7p6js7cQ7lgi" when active
- "ElevenLabs not available, using browser TTS" when falling back

## 🎨 Visual Indicators

When ElevenLabs is active:
- Orange microphone icon appears in chat header
- "ElevenLabs" label shows during playback
- Speaker button glows orange during speech

## ⚠️ Troubleshooting

### Voice Not Playing

1. **Check API Key:** Ensure it's correctly set in `.env`
2. **Verify Credits:** Check your ElevenLabs account has credits
3. **Test Endpoint:** 
   ```bash
   curl -X POST https://your-domain/api/tts/elevenlabs \
     -H "Content-Type: application/json" \
     -d '{"text": "Test speech"}'
   ```

### Fallback to Browser TTS

If the app falls back to browser TTS:
- Check server logs for API errors
- Verify network connectivity
- Ensure API key is valid

### Voice ID Issues

The configured voice ID `Z8dg0fyk7p6js7cQ7lgi` should work with your account. If not:
1. Check if the voice is available in your ElevenLabs account
2. You can find available voices at: https://api.elevenlabs.io/v1/voices
3. Update `ELEVENLABS_VOICE_ID` in `.env` if needed

## 📚 API Documentation

For more details on ElevenLabs API:
- [API Reference](https://docs.elevenlabs.io/api-reference/text-to-speech)
- [Voice Settings](https://docs.elevenlabs.io/speech-synthesis/voice-settings)
- [Models](https://docs.elevenlabs.io/speech-synthesis/models)

## 🔒 Security Notes

- Never commit `.env` file to version control
- Keep your API key confidential
- Consider implementing rate limiting for production
- Use environment-specific API keys

---

**Note:** The ElevenLabs integration enhances the Griot experience with premium voice synthesis, making the interaction more immersive and authentic to the Wakandan theme.

**Wakanda Forever! 🐾**