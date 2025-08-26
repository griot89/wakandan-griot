const { GoogleGenerativeAI } = require('@google/generative-ai');

// Test Gemini API
async function testGemini() {
    try {
        const genAI = new GoogleGenerativeAI('AIzaSyAxkO8RYgVK_gSPCOmpHmPAHXGkrEjh0hA');
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

        const result = await model.generateContent('Say hello as JARVIS from Iron Man');
        const response = await result.response;
        const text = response.text();
        
        console.log('✅ Gemini API works!');
        console.log('Response:', text);
    } catch (error) {
        console.error('❌ Gemini API error:', error.message);
        console.error('Full error:', error);
    }
}

testGemini();