export const env = {
  elevenLabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
  },
  openAi: {
    apiKey: process.env.OPENAI_API_KEY,
  },
} as const;

if (!env.elevenLabs.apiKey) {
  throw new Error("ELEVENLABS_API_KEY is required");
}

if (!env.openAi.apiKey) {
  throw new Error("OPENAI_API_KEY is required");
}
