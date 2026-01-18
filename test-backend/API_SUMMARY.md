# Chat & Conversation API Summary

## Base URL
All endpoints are under `/api`

## Authentication
- **Chat endpoint** (`POST /api/chat`): Optional authentication (works with or without JWT token)
- **Conversation endpoints**: **Required** authentication (JWT Bearer token)
- Header format: `Authorization: Bearer <token>`

---

## 1. Chat Endpoint - Send Message & Get Actions

### `POST /api/chat`
Processes a user message and page state, returning actions for the browser agent to execute.

**Authentication:** Optional (works anonymously, but conversations are tied to user if token provided)

**Request Body:**
```typescript
{
  session_id?: string;        // Optional: UUID for conversation continuity
  title?: string;             // Optional: Conversation title
  message: string;            // Required: User's message/instruction
  page_state: {               // Required: Current page information
    url: string;              // Current page URL
    distilledDOM: DistilledDOM | null;  // Structured page content (optional)
    screenshot: string;        // Base64 encoded screenshot
  }
}
```

**Response (200 OK):**
```typescript
{
  session_id: string;         // UUID of the conversation session
  actions: ConversationAction[];  // Array of actions to execute
  complete: boolean;           // Whether the task is complete
  needs_observation: boolean;  // Whether agent needs updated page state after actions
}
```

**Action Types:**
The `actions` array contains objects with different `action_type` values:

1. **Click Action:**
```typescript
{
  action_type: "click";
  x_path: string;        // CSS selector or XPath
  timestamp: string;     // ISO date-time
  reasoning?: string;     // Optional explanation
}
```

2. **Wait Action:**
```typescript
{
  action_type: "wait";
  duration: number;       // Duration in milliseconds
  timestamp: string;
  reasoning?: string;
}
```

3. **Message Action:**
```typescript
{
  action_type: "message";
  message: string;       // Assistant's text message
  timestamp: string;
  reasoning?: string;
}
```

4. **Complete Action:**
```typescript
{
  action_type: "complete";
  message: string;       // Completion message
  timestamp: string;
  reasoning?: string;
}
```

5. **Other Actions** (highlight, scroll, fill_form, etc.):
```typescript
{
  action_type: "highlight" | "magnify" | "scroll" | "fill_form" | "select_dropdown" | 
               "remove_highlights" | "reset_magnification" | "remove_clutter" | "restore_clutter";
  selector?: string;     // CSS selector (for actions that need it)
  value?: string;        // Value to fill/select (for form actions)
  timestamp: string;
  reasoning?: string;
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields (`message` or `page_state`)
- `500 Internal Server Error`: Server error

**Notes:**
- If `session_id` is provided, continues existing conversation; otherwise creates new session
- User message is automatically saved to `ConversationMessages` table
- All agent actions are saved to respective action tables
- Returns `session_id` to use for subsequent messages in the same conversation

---

## 2. List Conversations

### `GET /api/conversations`
Get all conversations (sessions) for the authenticated user.

**Authentication:** Required (JWT Bearer token)

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```typescript
Array<{
  id: string;              // UUID
  UserId: string | null;    // UUID of user (null for anonymous)
  Title: string;            // Conversation title
  CreatedAt: string;        // ISO date-time
  UpdatedAt: string;        // ISO date-time (most recent activity)
  CompletedAt: string | null;  // ISO date-time when completed (null if ongoing)
}>
```

**Ordering:** Results are ordered by `UpdatedAt` descending (most recent first)

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `500 Internal Server Error`: Server error

---

## 3. Get Conversation with Messages

### `GET /api/conversations/[sessionId]`
Get a specific conversation with all its messages.

**Authentication:** Required (JWT Bearer token)

**Path Parameters:**
- `sessionId`: UUID of the conversation session

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```typescript
{
  id: string;              // Session UUID
  UserId: string | null;    // User UUID
  Title: string;            // Conversation title
  CreatedAt: string;        // ISO date-time
  UpdatedAt: string;        // ISO date-time
  CompletedAt: string | null;  // Completion date (null if ongoing)
  messages: Array<{        // All messages in chronological order
    id: string;             // Message UUID
    SessionId: string;     // Session UUID
    UserId: string | null; // User UUID
    role: "user" | "assistant";  // Message sender
    content: string;        // Message text
    PageUrl: string | null;     // URL when message was sent
    CreatedAt: string;      // ISO date-time
  }>
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Session not found or doesn't belong to user
- `500 Internal Server Error`: Server error

**Security:** Users can only access their own conversations. Accessing another user's session returns 403.

---

## Data Flow Example

### Starting a New Conversation:
```typescript
// 1. Send initial message
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'  // Optional
  },
  body: JSON.stringify({
    title: "Find product information",
    message: "Click on the search button",
    page_state: {
      url: "https://example.com",
      screenshot: "<base64_image>",
      distilledDOM: { /* structured DOM */ }
    }
  })
});

const data = await response.json();
// data.session_id = "550e8400-e29b-41d4-a716-446655440000"
// data.actions = [...]
// data.complete = false
```

### Continuing a Conversation:
```typescript
// 2. Use session_id for follow-up messages
const response2 = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'
  },
  body: JSON.stringify({
    session_id: data.session_id,  // Continue existing conversation
    message: "Now click on the first result",
    page_state: {
      url: "https://example.com/search?q=...",
      screenshot: "<base64_image>",
      distilledDOM: { /* updated DOM */ }
    }
  })
});
```

### Retrieving Conversation History:
```typescript
// 3. Get all conversations for user
const conversations = await fetch('/api/conversations', {
  headers: {
    'Authorization': 'Bearer <token>'
  }
});
// Returns array of conversation summaries

// 4. Get full conversation with messages
const conversation = await fetch(`/api/conversations/${sessionId}`, {
  headers: {
    'Authorization': 'Bearer <token>'
  }
});
// Returns conversation with all messages
```

---

## Important Notes

1. **Session Management:**
   - Each conversation has a unique `session_id` (UUID)
   - Pass `session_id` in subsequent requests to continue the conversation
   - Sessions are automatically created if not provided

2. **User Association:**
   - If authenticated (JWT token provided), conversations are tied to the user
   - Anonymous users can still use the chat, but conversations won't be retrievable later
   - Use authentication to enable conversation history

3. **Message Storage:**
   - User messages are stored in `ConversationMessages` with `role: "user"`
   - Assistant text messages are stored with `role: "assistant"`
   - Browser actions (click, wait, etc.) are stored in separate action tables

4. **Action Execution:**
   - Frontend should execute actions in the order returned
   - Check `needs_observation` flag - if true, send updated page state after executing actions
   - When `complete: true`, the task is finished

5. **CORS:**
   - All endpoints support CORS with `Access-Control-Allow-Origin: *`
   - Include `OPTIONS` preflight requests as needed

---

## TypeScript Types Reference

```typescript
interface ConversationRequest {
  session_id?: string;
  title?: string;
  message: string;
  page_state: PageState;
}

interface ConversationResponse {
  session_id: string;
  actions: ConversationAction[];
  complete: boolean;
  needs_observation: boolean;
}

interface PageState {
  url: string;
  distilledDOM: DistilledDOM | null;
  screenshot: string;  // Base64 encoded
}

interface TaskSession {
  id: string;
  UserId: string | null;
  Title: string;
  CreatedAt: string;
  UpdatedAt: string;
  CompletedAt: string | null;
}

interface ConversationMessage {
  id: string;
  SessionId: string;
  UserId: string | null;
  role: "user" | "assistant";
  content: string;
  PageUrl: string | null;
  CreatedAt: string;
}
```
