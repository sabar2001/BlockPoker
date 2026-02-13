import { GoogleGenAI, Modality } from "@google/genai";

// Initialize Gemini
// NOTE: process.env.API_KEY is assumed to be available in the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateBotChat = async (
  botName: string, 
  context: string, 
  personality: string = "aggressive"
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "Nice move."; // Fallback if no key
  }

  try {
    const model = 'gemini-3-flash-preview';
    // Softened "toxic" to "trash-talking" and added "Avoid explicit profanity" 
    // to prevent the TTS model from refusing to speak (which causes the non-audio response error).
    const systemPrompt = `You are playing a high-stakes poker game in a Krunker.io style FPS environment. 
    You are ${botName}. Your personality is ${personality}. 
    Keep your response extremely short (max 6 words). 
    Use gamer slang (bruh, ez, rekt, lol, etc) or poker slang. 
    Be trash-talking but funny, or confident. Avoid explicit profanity.`;

    const userPrompt = `Game Context: ${context}. What do you say to the table?`;

    const response = await ai.models.generateContent({
      model: model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 20,
        temperature: 0.9,
        // Disable thinking to ensure maxOutputTokens limit is respected and reduce latency
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    return response.text?.trim() || "Hmm...";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "Lag...";
  }
};

export const generateBotSpeech = async (text: string): Promise<string | undefined> => {
    if (!process.env.API_KEY) return undefined;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
                    },
                },
            },
        });

        // The API returns raw PCM data in base64
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (error: any) {
        // Handle specific "non-audio response" error gracefully
        if (error.toString().includes("non-audio response") || (error.message && error.message.includes("non-audio response"))) {
             console.warn("Gemini TTS: Model refused to generate audio for prompt:", text);
             return undefined;
        }
        console.error("Gemini TTS Error:", error);
        return undefined;
    }
};