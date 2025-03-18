import { NextRequest, NextResponse } from 'next/server'
import { NextApiRequest, NextApiResponse } from 'next'
import { get } from '@lib/redis-adapter'
import { API_KEY_PREFIX } from '@lib/api/constants'

export interface AuthenticatedRequest {
  // The user ID associated with the API key if authentication was successful
  userId?: string
  // Indicates if authentication was valid
  isAuthenticated: boolean
  // Any error message if authentication failed
  authError?: string
  // Original request
  originalRequest?: NextRequest | NextApiRequest
}

/**
 * Helper to get headers from either Edge API or Node.js API requests
 * Edge API has headers.get() while Node.js API has headers['header-name']
 */
function getHeader(req: NextRequest | NextApiRequest, name: string): string | null {
  // Check if this is an Edge API request (NextRequest)
  if ('headers' in req && typeof (req.headers as any).get === 'function') {
    return (req.headers as Headers).get(name);
  }
  
  // Otherwise, assume regular Node.js API request (headers are lowercased)
  const nodeReq = req as NextApiRequest;
  const lowerName = name.toLowerCase();
  const headerValue = nodeReq.headers[lowerName];
  
  if (Array.isArray(headerValue)) {
    return headerValue[0] || null;
  }
  
  return headerValue || null;
}

/**
 * Middleware to handle authentication for API requests
 * Supports simple API keys (sk-*)
 */
export async function authMiddleware(req: NextRequest | NextApiRequest): Promise<AuthenticatedRequest> {
  const authReq: AuthenticatedRequest = {
    isAuthenticated: false,
    originalRequest: req
  }
  
  // Get API key from Authorization header or api-key header (OpenAI style)
  const authHeader = getHeader(req, 'Authorization')
  const apiKeyHeader = getHeader(req, 'api-key')
  
  console.log('[AUTH] Headers:', { 
    auth: authHeader ? 'present' : 'missing', 
    apiKey: apiKeyHeader ? 'present' : 'missing' 
  });
  
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7).trim() 
    : apiKeyHeader?.trim() || null
  
  if (!token) {
    console.log('[AUTH] No token found in headers');
    authReq.authError = 'Missing API key'
    return authReq
  }
  
  console.log('[AUTH] Found token:', token.substring(0, 8) + '...');
  
  try {
    // For simple API keys (starting with 'sk-')
    if (token.startsWith('sk-')) {
      console.log('[AUTH] Processing simple API key');
      try {
        // Use redis-adapter to check the key
        console.log('[AUTH] Looking up key in Redis:', `${API_KEY_PREFIX}${token}`);
        const userId = await get(`${API_KEY_PREFIX}${token}`)
        console.log('[AUTH] Redis lookup result:', userId);
        
        if (userId) {
          // Simple API key is valid
          console.log('[AUTH] Simple API key is valid for user:', userId);
          authReq.isAuthenticated = true
          authReq.userId = userId as string
          return authReq
        } else {
          console.log('[AUTH] Simple API key not found in Redis');
          authReq.authError = 'Invalid API key'
          return authReq
        }
      } catch (error) {
        console.error('[AUTH] Error checking simple API key:', error)
        authReq.authError = 'Error validating API key'
        return authReq
      }
    } else {
      // Not a simple API key
      console.log('[AUTH] Not a valid API key format, expecting sk-*');
      authReq.authError = 'Invalid API key format'
      return authReq
    }
  } catch (error) {
    console.error('[AUTH] Auth middleware error:', error)
    authReq.authError = 'Authentication error'
    return authReq
  }
}

/**
 * Helper to handle auth errors for Edge API routes
 */
export function handleAuthError(req: AuthenticatedRequest): Response | NextResponse | null {
  if (!req.isAuthenticated) {
    // For Edge API routes
    return NextResponse.json(
      {
        error: {
          message: req.authError || 'Unauthorized',
          type: 'invalid_request_error',
          code: 'invalid_api_key'
        }
      },
      { status: 401 }
    );
  }
  
  return null
}

/**
 * Helper to handle auth errors for Node.js API routes
 * This function directly uses res to send the response
 */
export function handleNodeAuthError(req: AuthenticatedRequest, res: NextApiResponse): boolean {
  if (!req.isAuthenticated) {
    res.status(401).json({
      error: {
        message: req.authError || 'Unauthorized',
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    });
    return true; // Error was handled
  }
  
  return false; // No error, continue processing
} 