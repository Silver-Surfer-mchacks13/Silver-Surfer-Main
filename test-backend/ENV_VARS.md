# Environment Variables Setup

## Required Variables

Create a `.env.local` file in the `test-backend` directory with these variables:

### JWT Configuration (Required)
```bash
JWT_SECRET=your-secret-key-here-change-in-production
# Optional - defaults provided:
JWT_ISSUER=SilverSurferAPI
JWT_AUDIENCE=SilverSurferClient
JWT_ACCESS_TOKEN_EXPIRATION_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRATION_DAYS=30
```

**How to get JWT_SECRET:**
- Generate a random string: `openssl rand -base64 32`
- Or use any long random string (at least 32 characters)
- In development, if you don't set it, a temporary one will be auto-generated (not secure!)

### Supabase Configuration (Required - Choose ONE option)

**Option 1: Single Connection String (Recommended)**
```bash
SUPABASE_CONNECTION_STRING=supabase://[project-ref]:[service-role-key]
```

**Option 2: Separate Variables**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**How to get Supabase credentials:**
1. Go to https://supabase.com and create a project (or use existing)
2. Go to Project Settings → API
3. Find your "Project URL" - it looks like `https://abcdefghijklmnop.supabase.co`
   - The `abcdefghijklmnop` part is your project-ref
4. Copy the "service_role" key (NOT the anon key) - it's a long JWT token
5. Format: `supabase://abcdefghijklmnop:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
6. Run the migration: Go to SQL Editor in Supabase dashboard and run `supabase/migrations/001_auth_tables.sql`

### OpenAI Configuration (Already exists)
```bash
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o
```

## Optional Variables (Only if using OAuth)

OAuth login will fail gracefully if not configured - you can still use email/password auth.

```bash
# Google OAuth (optional)
OAUTH_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Microsoft OAuth (optional)
OAUTH_MICROSOFT_CLIENT_ID=your-microsoft-client-id
OAUTH_MICROSOFT_TENANT_ID=common

# GitHub OAuth (optional)
OAUTH_GITHUB_CLIENT_ID=your-github-client-id
OAUTH_GITHUB_CLIENT_SECRET=your-github-client-secret

# Auth0 OAuth (optional)
OAUTH_AUTH0_DOMAIN=your-tenant.auth0.com
OAUTH_AUTH0_CLIENT_ID=your-auth0-client-id
```

**How to get OAuth credentials:**
- **Google**: https://console.cloud.google.com/apis/credentials
- **Microsoft**: https://portal.azure.com → App registrations
- **GitHub**: https://github.com/settings/developers → OAuth Apps
- **Auth0**: https://auth0.com → Create Application → Copy Domain and Client ID

## File Location

Create `.env.local` in: `test-backend/.env.local`

Example file:
```bash
# Required
JWT_SECRET=my-super-secret-key-change-this-in-production
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=sk-...

# Optional OAuth (leave empty if not using)
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_MICROSOFT_CLIENT_ID=
OAUTH_GITHUB_CLIENT_ID=
OAUTH_AUTH0_DOMAIN=
OAUTH_AUTH0_CLIENT_ID=
```
