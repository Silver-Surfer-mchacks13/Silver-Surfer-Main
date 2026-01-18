import { env } from "@/lib/config/env";

export interface TextToSpeechRequest {
  text: string;
  voiceId?: string;
}

export class TextToSpeechService {
  private readonly apiKey: string;
  private readonly defaultVoiceId = "21m00Tcm4TlvDq8ikWAM";

  constructor() {
    this.apiKey = env.elevenLabs.apiKey!;
  }

  async convertTextToSpeech(
    text: string,
    voiceId?: string
  ): Promise<ReadableStream<Uint8Array>> {
    const voice = voiceId || this.defaultVoiceId;
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": this.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs TTS failed: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error("No response body from ElevenLabs");
    }

    return response.body;
  }
}
