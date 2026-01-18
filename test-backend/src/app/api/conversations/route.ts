import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { conversationService } from "@/lib/services/conversation/conversation-service";

/**
 * @swagger
 * /api/conversations:
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
 * /api/conversations:
 *   get:
 *     tags: [Conversations]
 *     summary: Get all conversations for the authenticated user
 *     description: Returns a list of all conversations (sessions) belonging to the authenticated user, ordered by most recently updated first
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved conversations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                     example: "550e8400-e29b-41d4-a716-446655440000"
 *                   UserId:
 *                     type: string
 *                     format: uuid
 *                     nullable: true
 *                     example: "123e4567-e89b-12d3-a456-426614174000"
 *                   Title:
 *                     type: string
 *                     example: "Find product information"
 *                   CreatedAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-01-15T10:30:00Z"
 *                   UpdatedAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-01-15T11:45:00Z"
 *                   CompletedAt:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                     example: "2024-01-15T12:00:00Z"
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
export async function GET(req: NextRequest) {
  try {
    // Require authentication
    const authInfo = requireAuth(req);
    const userId = authInfo.userId;

    // Get all sessions for the user
    const sessions = await conversationService.getUserSessions(userId);

    return NextResponse.json(sessions, {
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
