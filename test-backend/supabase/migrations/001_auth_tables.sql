-- Create auth provider enum type in public schema
CREATE TYPE public.auth_provider AS ENUM ('Local', 'Google', 'Microsoft', 'GitHub');

-- Create users table (matching C# User model)
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    "PasswordHash" VARCHAR(255),  -- Matches C# PasswordHash property
    provider public.auth_provider NOT NULL DEFAULT 'Local',
    "ProviderUserId" VARCHAR(255),  -- Matches C# ProviderUserId property
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint: email + provider combination must be unique
    CONSTRAINT unique_email_provider UNIQUE (email, provider),
    
    -- Unique constraint: provider_user_id + provider combination must be unique (when not null)
    CONSTRAINT unique_provider_user_id UNIQUE (provider, "ProviderUserId")
);

-- Create indexes for users table (matching C# indexes)
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_provider ON public.users(provider);
CREATE INDEX idx_users_provider_user_id ON public.users(provider, "ProviderUserId") WHERE "ProviderUserId" IS NOT NULL;

-- Create refresh_tokens table (matching C# RefreshToken model)
CREATE TABLE public.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "UserId" UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- Matches C# UserId property
    token VARCHAR(500) NOT NULL UNIQUE,  -- Matches C# max length
    "ExpiresAt" TIMESTAMPTZ NOT NULL,  -- Matches C# ExpiresAt property
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- Matches C# CreatedAt property
    "RevokedAt" TIMESTAMPTZ,  -- Matches C# RevokedAt property
    "ReplacedByToken" VARCHAR(255),  -- Matches C# ReplacedByToken property
    "RevocationReason" VARCHAR(255)  -- Matches C# RevocationReason property
);

-- Create indexes for refresh_tokens table (matching C# indexes)
CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens("UserId");
CREATE INDEX idx_refresh_tokens_token ON public.refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens("ExpiresAt");
CREATE INDEX idx_refresh_tokens_revoked_at ON public.refresh_tokens("RevokedAt") WHERE "RevokedAt" IS NOT NULL;

-- Create password_reset_requests table (matching C# PasswordResetRequest model)
CREATE TABLE public.password_reset_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "UserId" UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- Matches C# UserId property
    token VARCHAR(500) NOT NULL UNIQUE,  -- Matches C# max length
    "ExpiresAt" TIMESTAMPTZ NOT NULL,  -- Matches C# ExpiresAt property
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP  -- Matches C# CreatedAt property
);

-- Create indexes for password_reset_requests table (matching C# indexes)
CREATE INDEX idx_password_reset_requests_user_id ON public.password_reset_requests("UserId");
CREATE INDEX idx_password_reset_requests_token ON public.password_reset_requests(token);
CREATE INDEX idx_password_reset_requests_expires_at ON public.password_reset_requests("ExpiresAt");

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."UpdatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions for PostgREST to access the schema
-- This allows the Supabase JS client to query these tables
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- IMPORTANT: PostgREST needs the schema to be exposed
-- Add public to PostgREST's exposed schemas
-- This is done via Supabase Dashboard → Settings → Database → Exposed Schemas
-- OR via SQL (if you have access to postgres role):
-- ALTER DATABASE postgres SET app.settings.db_schema = 'public,public';
-- 
-- Alternatively, create views in public schema that point to the custom schema tables
-- This allows PostgREST to access them without schema qualification

-- Create TaskSessions table (matching C# TaskSession model)
CREATE TABLE public."TaskSessions" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "UserId" UUID REFERENCES public.users(id) ON DELETE SET NULL,
    "Title" VARCHAR(1000) NOT NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CompletedAt" TIMESTAMPTZ
);

-- Create indexes for TaskSessions table
CREATE INDEX idx_task_sessions_user_id ON public."TaskSessions"("UserId");
CREATE INDEX idx_task_sessions_created_at ON public."TaskSessions"("CreatedAt");

-- Create trigger to automatically update updated_at on TaskSessions table
CREATE TRIGGER update_task_sessions_updated_at BEFORE UPDATE ON public."TaskSessions"
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create ClickAgentActions table (matching C# ClickAgentAction model)
CREATE TABLE public."ClickAgentActions" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "SessionId" UUID NOT NULL REFERENCES public."TaskSessions"(id) ON DELETE CASCADE,
    "Target" VARCHAR(500) NOT NULL,
    "Reasoning" VARCHAR(5000) NOT NULL,
    "Success" BOOLEAN NOT NULL,
    "ErrorMessage" VARCHAR(1000),
    "PageUrl" VARCHAR(2000) NOT NULL,
    "PageHtml" VARCHAR(50000),
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for ClickAgentActions table
CREATE INDEX idx_click_agent_actions_session_id ON public."ClickAgentActions"("SessionId");
CREATE INDEX idx_click_agent_actions_created_at ON public."ClickAgentActions"("CreatedAt");

-- Create WaitAgentActions table (matching C# WaitAgentAction model)
CREATE TABLE public."WaitAgentActions" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "SessionId" UUID NOT NULL REFERENCES public."TaskSessions"(id) ON DELETE CASCADE,
    "Duration" INTEGER NOT NULL,
    "Reasoning" VARCHAR(5000) NOT NULL,
    "Success" BOOLEAN NOT NULL,
    "ErrorMessage" VARCHAR(1000),
    "PageUrl" VARCHAR(2000) NOT NULL,
    "PageHtml" VARCHAR(50000),
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for WaitAgentActions table
CREATE INDEX idx_wait_agent_actions_session_id ON public."WaitAgentActions"("SessionId");
CREATE INDEX idx_wait_agent_actions_created_at ON public."WaitAgentActions"("CreatedAt");

-- Create CompleteAgentActions table (matching C# CompleteAgentAction model)
CREATE TABLE public."CompleteAgentActions" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "SessionId" UUID NOT NULL REFERENCES public."TaskSessions"(id) ON DELETE CASCADE,
    "Message" VARCHAR(1000) NOT NULL,
    "Reasoning" VARCHAR(5000) NOT NULL,
    "Success" BOOLEAN NOT NULL,
    "ErrorMessage" VARCHAR(1000),
    "PageUrl" VARCHAR(2000) NOT NULL,
    "PageHtml" VARCHAR(50000),
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for CompleteAgentActions table
CREATE INDEX idx_complete_agent_actions_session_id ON public."CompleteAgentActions"("SessionId");
CREATE INDEX idx_complete_agent_actions_created_at ON public."CompleteAgentActions"("CreatedAt");

-- Create MessageAgentActions table (matching C# MessageAgentAction model)
CREATE TABLE public."MessageAgentActions" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "SessionId" UUID NOT NULL REFERENCES public."TaskSessions"(id) ON DELETE CASCADE,
    "Message" VARCHAR(1000) NOT NULL,
    "Reasoning" VARCHAR(5000) NOT NULL,
    "PageUrl" VARCHAR(2000) NOT NULL,
    "PageHtml" VARCHAR(50000),
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for MessageAgentActions table
CREATE INDEX idx_message_agent_actions_session_id ON public."MessageAgentActions"("SessionId");
CREATE INDEX idx_message_agent_actions_created_at ON public."MessageAgentActions"("CreatedAt");

-- Create SitePatterns table (matching C# SitePattern model)
CREATE TABLE public."SitePatterns" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Domain" VARCHAR(255) NOT NULL UNIQUE,
    "PatternJson" TEXT NOT NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger to automatically update updated_at on SitePatterns table
CREATE TRIGGER update_site_patterns_updated_at BEFORE UPDATE ON public."SitePatterns"
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions on tables (public schema is default, but being explicit)
GRANT ALL ON public.users TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.refresh_tokens TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.password_reset_requests TO postgres, anon, authenticated, service_role;
GRANT ALL ON public."TaskSessions" TO postgres, anon, authenticated, service_role;
GRANT ALL ON public."ClickAgentActions" TO postgres, anon, authenticated, service_role;
GRANT ALL ON public."WaitAgentActions" TO postgres, anon, authenticated, service_role;
GRANT ALL ON public."CompleteAgentActions" TO postgres, anon, authenticated, service_role;
GRANT ALL ON public."MessageAgentActions" TO postgres, anon, authenticated, service_role;
GRANT ALL ON public."SitePatterns" TO postgres, anon, authenticated, service_role;
