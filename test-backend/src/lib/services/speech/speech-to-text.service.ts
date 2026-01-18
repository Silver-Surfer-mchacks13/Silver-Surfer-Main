import { env } from "@/lib/config/env";

export class SpeechToTextService {
  private readonly apiKey: string;

  constructor() {
    this.apiKey = env.openAi.apiKey!;
  }

  async transcribeAudio(audioFile: File | Blob): Promise<string> {
    const formData = new FormData();
    formData.append("file", audioFile, "audio.webm");
    formData.append("model", "whisper-1");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whisper STT failed: ${response.status} - ${error}`);
    }

    const result = await response.json();
    return result.text || "";
  }
}
