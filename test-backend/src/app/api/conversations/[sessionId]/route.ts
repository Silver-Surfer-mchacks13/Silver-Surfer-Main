import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { conversationService } from "@/lib/services/conversation/conversation-service";
import type { TaskSession, ConversationMessage } from "@/lib/db/supabase";

/**
 * @swagger
 * /api/conversations/{sessionId}:
 *   options:
 *     tags: [Conversations]
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * @swagger
 * /api/conversations/{sessionId}:
 *   get:
 *     tags: [Conversations]
 *     summary: Get a specific conversation with all its messages
 *     description: Returns a conversation (session) with all associated messages, verifying the session belongs to the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the conversation session
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Successfully retrieved conversation with messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   example: "550e8400-e29b-41d4-a716-446655440000"
 *                 UserId:
 *                   type: string
 *                   format: uuid
 *                   nullable: true
 *                   example: "123e4567-e89b-12d3-a456-426614174000"
 *                 Title:
 *                   type: string
 *                   example: "Find product information"
 *                 CreatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00Z"
 *                 UpdatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T11:45:00Z"
 *                 CompletedAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                   example: "2024-01-15T12:00:00Z"
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         example: "660e8400-e29b-41d4-a716-446655440001"
 *                       SessionId:
 *                         type: string
 *                         format: uuid
 *                         example: "550e8400-e29b-41d4-a716-446655440000"
 *                       UserId:
 *                         type: string
 *                         format: uuid
 *                         nullable: true
 *                         example: "123e4567-e89b-12d3-a456-426614174000"
 *                       role:
 *                         type: string
 *                         enum: [user, assistant]
 *                         example: "user"
 *                       content:
 *                         type: string
 *                         example: "Click on the search button"
 *                       PageUrl:
 *                         type: string
 *                         nullable: true
 *                         example: "https://example.com"
 *                       CreatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00Z"
 *       401:
 *         description: Unauthorized - missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Authorization token required"
 *       403:
 *         description: Forbidden - session not found or doesn't belong to user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Session not found or access denied"
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
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Require authentication
    const authInfo = requireAuth(req);
    const userId = authInfo.userId;

    // Get sessionId from route params (async in Next.js 15+)
    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Get session and verify ownership
    const session = await conversationService.getSessionById(sessionId, userId);

    // Get conversation history (messages)
    const messages = await conversationService.getConversationHistory(sessionId);

    // Combine session with messages
    const response: TaskSession & { messages: ConversationMessage[] } = {
      ...session,
      messages,
    };

    return NextResponse.json(response, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("API Error:", error);

    // Handle authentication errors
    if (error instanceof Error && error.message.includes("token")) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Handle session not found or access denied
    if (error instanceof Error && error.message.includes("Session not found")) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 403,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

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
