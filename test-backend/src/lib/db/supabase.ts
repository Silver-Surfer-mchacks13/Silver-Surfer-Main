import { createClient } from '@supabase/supabase-js';

// Schema name - using public schema for simplicity
export const SCHEMA = 'public';

// Parse Supabase connection string or use separate env vars
// Supported formats:
// 1. supabase://[project-ref]:[service-role-key]
// 2. postgresql://postgres.[project-ref]:[password]@[host]:[port]/postgres (extracts project-ref, but still needs service-role-key)
// 3. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (separate env vars)
function getSupabaseConfig() {
  const connectionString = process.env.SUPABASE_CONNECTION_STRING;
  
  if (connectionString) {
    // Format 1: supabase://[project-ref]:[service-role-key]
    const supabaseMatch = connectionString.match(/^supabase:\/\/([^:]+):(.+)$/);
    if (supabaseMatch) {
      const [, projectRef, serviceRoleKey] = supabaseMatch;
      return {
        url: `https://${projectRef}.supabase.co`,
        key: serviceRoleKey,
      };
    }

    // Format 2: postgresql://postgres.[project-ref]:[password]@[host]:[port]/postgres
    // Extract project ref from PostgreSQL connection string
    const postgresMatch = connectionString.match(/postgres\.([a-zA-Z0-9]+)/);
    if (postgresMatch) {
      const [, projectRef] = postgresMatch;
      // Still need service role key - check if provided separately
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        throw new Error(
          `❌ Supabase configuration incomplete!\n\n` +
          `PostgreSQL connection string detected (project: ${projectRef})\n` +
          `But SUPABASE_SERVICE_ROLE_KEY is missing.\n\n` +
          `📋 To fix:\n` +
          `1. Go to: https://supabase.com/dashboard/project/${projectRef}/settings/api\n` +
          `2. Copy the "service_role" key (the long JWT token, NOT the anon key)\n` +
          `3. Add to your .env.local file:\n` +
          `   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\n\n` +
          `4. Restart your Next.js dev server (Ctrl+C then npm run dev)\n\n` +
          `💡 Alternative: Use this format instead:\n` +
          `   SUPABASE_CONNECTION_STRING="supabase://${projectRef}:your-service-role-key-here"`
        );
      }
      return {
        url: `https://${projectRef}.supabase.co`,
        key: serviceRoleKey,
      };
    }

    throw new Error(
      'Invalid SUPABASE_CONNECTION_STRING format.\n' +
      'Supported formats:\n' +
      '1. supabase://[project-ref]:[service-role-key]\n' +
      '2. postgresql://postgres.[project-ref]:[password]@[host]:[port]/postgres (also requires SUPABASE_SERVICE_ROLE_KEY)\n' +
      '3. Use SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY separately'
    );
  }

  // Fall back to separate env vars
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase configuration required. Use one of:\n' +
      '1. SUPABASE_CONNECTION_STRING=supabase://[project-ref]:[service-role-key]\n' +
      '2. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY\n' +
      'Get credentials from: Supabase Dashboard → Project Settings → API'
    );
  }

  return { url, key };
}

const config = getSupabaseConfig();

// Create Supabase client with service role key for server-side operations
// This bypasses RLS and allows full database access
export const supabase = createClient(config.url, config.key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper to get table name for PostgREST
// With the schema exposed in Supabase Dashboard → Settings → Database → Exposed Schemas
// PostgREST will search exposed schemas when you use the table name directly
// Since silver_surfers_main is exposed, we can use table names directly
// PostgREST searches exposed schemas in order (public first, then others)
export function table(tableName: string) {
  // Use table name directly - PostgREST will find it in the exposed silver_surfers_main schema
  // If there's a conflict with public schema, PostgREST will use the first match
  return supabase.from(tableName);
}

// Database types (matching C# models exactly)
export type AuthProvider = 'Local' | 'Google' | 'Microsoft' | 'GitHub';

// User model (matching C# User class)
export interface User {
  id: string;  // Guid in C#
  email: string;  // required string
  PasswordHash: string | null;  // string? in C#
  provider: AuthProvider;  // AuthProvider enum
  ProviderUserId: string | null;  // string? in C#
  CreatedAt: string;  // DateTime in C#
  UpdatedAt: string;  // DateTime in C#
}

// RefreshToken model (matching C# RefreshToken class)
export interface RefreshToken {
  id: string;  // Guid in C#
  UserId: string;  // Guid in C#
  token: string;  // required string
  ExpiresAt: string;  // DateTime in C#
  CreatedAt: string;  // DateTime in C#
  RevokedAt: string | null;  // DateTime? in C#
  ReplacedByToken: string | null;  // string? in C#
  RevocationReason: string | null;  // string? in C#
}

// PasswordResetRequest model (matching C# PasswordResetRequest class)
export interface PasswordResetRequest {
  id: string;  // Guid in C#
  UserId: string;  // Guid in C#
  token: string;  // required string
  ExpiresAt: string;  // DateTime in C#
  CreatedAt: string;  // DateTime in C#
}

// TaskSession model (matching C# TaskSession class)
export interface TaskSession {
  id: string;  // Guid in C#
  UserId: string | null;  // Guid? in C#
  Title: string;  // required string
  CreatedAt: string;  // DateTime in C#
  UpdatedAt: string;  // DateTime in C#
  CompletedAt: string | null;  // DateTime? in C#
}

// ConversationMessage model
export interface ConversationMessage {
  id: string;  // Guid
  SessionId: string;  // Guid - foreign key to TaskSessions
  UserId: string | null;  // Guid? - foreign key to users (optional)
  role: 'user' | 'assistant';  // Message role
  content: string;  // Message content (TEXT)
  PageUrl: string | null;  // URL when message was sent (optional)
  CreatedAt: string;  // DateTime
}