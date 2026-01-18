import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/error-handler";
import { TextToSpeechService } from "@/lib/services/speech/text-to-speech.service";

const textToSpeechService = new TextToSpeechService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = body?.text;
    const voiceId = body?.voiceId;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required and must be a string" },
        { status: 400 }
      );
    }

    const audioStream = await textToSpeechService.convertTextToSpeech(text, voiceId);

    return new NextResponse(audioStream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": "inline; filename=\"speech.mp3\"",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
