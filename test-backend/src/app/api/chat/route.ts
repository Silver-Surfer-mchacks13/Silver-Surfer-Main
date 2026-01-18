import { NextRequest, NextResponse } from "next/server";
import { processUserRequest } from "@/lib/agent";
import type { ConversationRequest, ConversationResponse } from "@/lib/types";
import { optionalAuth } from "@/lib/utils/auth";
import { conversationService } from "@/lib/services/conversation/conversation-service";

/**
 * @swagger
 * /api/chat:
 *   options:
 *     tags: [Chat]
 *     summary: CORS preflight
 *     description: Handles CORS preflight requests
 *     responses:
 *       200:
 *         description: CORS preflight successful
 */
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

/**
 * @swagger
 * /api/chat:
 *   post:
 *     tags: [Chat]
 *     summary: Process user conversation request
 *     description: Processes a user message and page state, returning actions for the browser agent
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message, page_state]
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: Optional session identifier for conversation continuity
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               title:
 *                 type: string
 *                 description: Title of the conversation
 *                 example: "Find product information"
 *               message:
 *                 type: string
 *                 description: The user message/instruction
 *                 example: "Click on the search button"
 *               page_state:
 *                 type: object
 *                 required: [url, html, screenshot]
 *                 properties:
 *                   url:
 *                     type: string
 *                     format: uri
 *                     description: Current page URL
 *                     example: "https://example.com"
 *                   html:
 *                     type: string
 *                     description: Current page HTML content
 *                   screenshot:
 *                     type: string
 *                     format: byte
 *                     description: Base64 encoded screenshot of the current page
 *     responses:
 *       200:
 *         description: Successfully processed request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session_id:
 *                   type: string
 *                   example: "550e8400-e29b-41d4-a716-446655440000"
 *                 actions:
 *                   type: array
 *                   items:
 *                     oneOf:
 *                       - type: object
 *                         properties:
 *                           action_type:
 *                             type: string
 *                             enum: [click]
 *                           x_path:
 *                             type: string
 *                             description: CSS selector or XPath
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           reasoning:
 *                             type: string
 *                       - type: object
 *                         properties:
 *                           action_type:
 *                             type: string
 *                             enum: [wait]
 *                           duration:
 *                             type: number
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           reasoning:
 *                             type: string
 *                       - type: object
 *                         properties:
 *                           action_type:
 *                             type: string
 *                             enum: [message]
 *                           message:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           reasoning:
 *                             type: string
 *                       - type: object
 *                         properties:
 *                           action_type:
 *                             type: string
 *                             enum: [complete]
 *                           message:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           reasoning:
 *                             type: string
 *                       - type: object
 *                         properties:
 *                           action_type:
 *                             type: string
 *                             enum: [highlight, magnify, scroll]
 *                           selector:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           reasoning:
 *                             type: string
 *                       - type: object
 *                         properties:
 *                           action_type:
 *                             type: string
 *                             enum: [fill_form, select_dropdown]
 *                           selector:
 *                             type: string
 *                           value:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           reasoning:
 *                             type: string
 *                       - type: object
 *                         properties:
 *                           action_type:
 *                             type: string
 *                             enum: [remove_highlights, reset_magnification, remove_clutter, restore_clutter]
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           reasoning:
 *                             type: string
 *                 complete:
 *                   type: boolean
 *                   description: Whether the task is complete
 *       400:
 *         description: Bad request - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing required field: page_state"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 *                 message:
 *                   type: string
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = (await req.json()) as ConversationRequest;
    const { session_id, title, message, page_state } = body;

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

    // Extract user ID from token if present
    const authInfo = optionalAuth(req);
    const userId = authInfo?.userId || null;

    // Log for debugging
    console.log("Received request:", {
      message,
      title,
      userId: userId || 'anonymous',
      hasScreenshot: !!page_state.screenshot,
      screenshotLength: page_state.screenshot?.length || 0,
      hasDistilledDOM: !!page_state.distilledDOM,
      elementCount: page_state.distilledDOM?.elements?.length || 0,
      url: page_state.url
    });

    // Get or create TaskSession
    const sessionTitle = title || message.substring(0, 100) || 'New Conversation';
    const taskSession = await conversationService.getOrCreateSession(
      session_id,
      userId,
      sessionTitle
    );

    // Store user message
    await conversationService.storeMessage(
      taskSession.id,
      userId,
      'user',
      message,
      page_state.url
    );

    // Process the request with the agent
    const { actions, complete, needsObservation } = await processUserRequest(message, page_state);

    // Store agent responses (extract text from message actions)
    for (const action of actions) {
      if (action.action_type === 'message') {
        await conversationService.storeMessage(
          taskSession.id,
          userId,
          'assistant',
          action.message,
          page_state.url
        );
      } else if (action.action_type === 'complete') {
        await conversationService.storeMessage(
          taskSession.id,
          userId,
          'assistant',
          action.message,
          page_state.url
        );
      }
    }

    // Update session completion status
    await conversationService.updateSessionCompletion(taskSession.id, complete);

    // Build the response
    const response: ConversationResponse = {
      session_id: taskSession.id,
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

/**
 * @swagger
 * /api/chat:
 *   get:
 *     tags: [Chat]
 *     summary: Health check endpoint
 *     description: Returns the health status of the API service
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 *                 service:
 *                   type: string
 *                   example: "Silver Surfer API"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
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
