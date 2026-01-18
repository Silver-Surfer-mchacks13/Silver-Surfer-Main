import { NextRequest, NextResponse } from 'next/server';

/**
 * @swagger
 * /api/config:
 *   get:
 *     tags: [Core]
 *     summary: Check environment variable configuration
 *     description: Returns the status of environment variables (values are masked for security)
 *     responses:
 *       200:
 *         description: Configuration status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jwt:
 *                   type: object
 *                   properties:
 *                     secret:
 *                       type: boolean
 *                     issuer:
 *                       type: string
 *                     audience:
 *                       type: string
 *                 supabase:
 *                   type: object
 *                   properties:
 *                     configured:
 *                       type: boolean
 *                     url:
 *                       type: string
 *                 openai:
 *                   type: object
 *                   properties:
 *                     apiKey:
 *                       type: boolean
 *                     model:
 *                       type: string
 *                 oauth:
 *                   type: object
 *                   properties:
 *                     google:
 *                       type: object
 *                       properties:
 *                         clientId:
 *                           type: string
 *                     microsoft:
 *                       type: object
 *                       properties:
 *                         clientId:
 *                           type: string
 *                         tenantId:
 *                           type: string
 *                     github:
 *                       type: object
 *                       properties:
 *                         clientId:
 *                           type: string
 *                         clientSecret:
 *                           type: string
 */
export async function GET(req: NextRequest) {
  // Check JWT config
  const jwtSecret = process.env.JWT_SECRET;
  const jwtIssuer = process.env.JWT_ISSUER || 'SilverSurferAPI (default)';
  const jwtAudience = process.env.JWT_AUDIENCE || 'SilverSurferClient (default)';

  // Check Supabase config
  const supabaseConnectionString = process.env.SUPABASE_CONNECTION_STRING;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  let supabaseConfigured = false;
  let supabaseUrlDisplay = 'Not configured';
  let supabaseProjectRef: string | null = null;
  
  if (supabaseConnectionString) {
    const postgresMatch = supabaseConnectionString.match(/postgres\.([a-zA-Z0-9]+)/);
    if (postgresMatch) {
      const [, projectRef] = postgresMatch;
      supabaseProjectRef = projectRef;
      supabaseUrlDisplay = `https://${projectRef}.supabase.co`;
      supabaseConfigured = !!supabaseKey;
    } else if (supabaseConnectionString.startsWith('supabase://')) {
      const match = supabaseConnectionString.match(/^supabase:\/\/([^:]+):/);
      if (match) {
        const [, projectRef] = match;
        supabaseProjectRef = projectRef;
        supabaseUrlDisplay = `https://${projectRef}.supabase.co`;
        supabaseConfigured = true;
      }
    }
  } else if (supabaseUrl && supabaseKey) {
    supabaseUrlDisplay = supabaseUrl;
    supabaseConfigured = true;
  }

  // Check OpenAI config
  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o (default)';

  // Check OAuth config
  const oauthGoogleId = process.env.OAUTH_GOOGLE_CLIENT_ID;
  const oauthMicrosoftId = process.env.OAUTH_MICROSOFT_CLIENT_ID;
  const oauthMicrosoftTenant = process.env.OAUTH_MICROSOFT_TENANT_ID;
  const oauthGithubId = process.env.OAUTH_GITHUB_CLIENT_ID;
  const oauthGithubSecret = process.env.OAUTH_GITHUB_CLIENT_SECRET;

  const response = {
    jwt: {
      secret: jwtSecret || null,
      issuer: jwtIssuer,
      audience: jwtAudience,
      accessTokenExpirationMinutes: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRATION_MINUTES || '15', 10),
      refreshTokenExpirationDays: parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRATION_DAYS || '30', 10),
    },
    supabase: {
      configured: supabaseConfigured,
      url: supabaseUrlDisplay,
      projectRef: supabaseProjectRef,
      connectionString: supabaseConnectionString || null,
      serviceRoleKey: supabaseKey || null,
    },
    openai: {
      apiKey: openaiKey || null,
      model: openaiModel,
    },
    oauth: {
      google: {
        clientId: oauthGoogleId || null,
      },
      microsoft: {
        clientId: oauthMicrosoftId || null,
        tenantId: oauthMicrosoftTenant || 'common (default)',
      },
      github: {
        clientId: oauthGithubId || null,
        clientSecret: oauthGithubSecret || null,
      },
    },
    status: {
      allRequired: !!(jwtSecret && supabaseConfigured && openaiKey),
      missing: [
        !jwtSecret && 'JWT_SECRET',
        !supabaseConfigured && 'SUPABASE (connection string + service role key)',
        !openaiKey && 'OPENAI_API_KEY',
      ].filter(Boolean) as string[],
    },
  };

  return NextResponse.json(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
