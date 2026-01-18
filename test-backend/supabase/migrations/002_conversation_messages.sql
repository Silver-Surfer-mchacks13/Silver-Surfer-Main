-- Create ConversationMessages table to store user messages and agent responses
CREATE TABLE public."ConversationMessages" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "SessionId" UUID NOT NULL REFERENCES public."TaskSessions"(id) ON DELETE CASCADE,
    "UserId" UUID REFERENCES public.users(id) ON DELETE SET NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    "PageUrl" VARCHAR(2000),
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for ConversationMessages table
CREATE INDEX idx_conversation_messages_session_id ON public."ConversationMessages"("SessionId");
CREATE INDEX idx_conversation_messages_user_id ON public."ConversationMessages"("UserId") WHERE "UserId" IS NOT NULL;
CREATE INDEX idx_conversation_messages_created_at ON public."ConversationMessages"("CreatedAt");

-- Grant permissions on ConversationMessages table
GRANT ALL ON public."ConversationMessages" TO postgres, anon, authenticated, service_role;
