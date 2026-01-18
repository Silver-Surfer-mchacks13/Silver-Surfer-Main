import { NextRequest, NextResponse } from "next/server";
import { processUserRequest } from "@/lib/agent";
import type { ConversationRequest, ConversationResponse } from "@/lib/types";

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = (await req.json()) as ConversationRequest;
    const { session_id, title, message, page_state, conversation_history } = body;

    // Validate required fields
    if (!page_state) {
      return NextResponse.json(
        { error: "Missing required field: page_state" },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: "Missing required field: message (user message)" },
        { status: 400 }
      );
    }

    // Log for debugging
    console.log("Received request:", {
      message,
      title,
      hasScreenshot: !!page_state.screenshot,
      screenshotLength: page_state.screenshot?.length || 0,
      hasDistilledDOM: !!page_state.distilledDOM,
      elementCount: page_state.distilledDOM?.elements?.length || 0,
      url: page_state.url,
      historyLength: conversation_history?.length || 0
    });

    // Process the request with the agent - include conversation history
    const { actions, complete, needsObservation } = await processUserRequest(
      message,
      page_state,
      conversation_history || []
    );

    // Build the response
    const response: ConversationResponse = {
      session_id: session_id || crypto.randomUUID(),
      actions,
      complete,
      needs_observation: needsObservation,
    };

    return NextResponse.json(response, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("API Error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "Silver Surfer API",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
