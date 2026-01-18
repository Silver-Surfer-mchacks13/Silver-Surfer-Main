import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/error-handler";
import { SpeechToTextService } from "@/lib/services/speech/speech-to-text.service";

const speechToTextService = new SpeechToTextService();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!(audioFile instanceof File)) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 }
      );
    }

    const text = await speechToTextService.transcribeAudio(audioFile);
    return NextResponse.json({ text });
  } catch (error) {
    return handleApiError(error);
  }
}
