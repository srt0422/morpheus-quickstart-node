import type { NextApiRequest, NextApiResponse } from 'next';
import {
  authMiddleware,
  handleNodeAuthError,
  AuthenticatedRequest
} from '@lib/api/auth-middleware'
import {
  buildOpenAIUrl,
  OPENAI_API_KEY,
  verifyOpenAIConfig
} from '@lib/api/openai-proxy'

// For Node.js API routes, we need a different handler signature
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: {
        message: 'Method not allowed',
        type: 'invalid_request_error',
      }
    });
  }

  // Verify configuration
  const configError = verifyOpenAIConfig()
  if (configError) {
    return res.status(500).json({
      error: {
        message: configError,
        type: 'server_error',
      }
    });
  }

  // Authenticate the request
  const authReq = await authMiddleware(req);
  
  // Handle authentication errors in Node.js API route style
  if (handleNodeAuthError(authReq, res)) {
    return; // Authentication failed, response already sent
  }

  try {
    // Create the proxy request to the OpenAI-compatible API
    const url = buildOpenAIUrl('models')
    console.log(`[PROXY] Making request to: ${url}`);
    
    // Build headers for the proxy request
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    // Get the client's authorization token
    if (req.headers.authorization) {
      // Forward the client's Authorization header if available
      headers['Authorization'] = req.headers.authorization;
      console.log(`[PROXY] Forwarding client's authorization header`);
    } 
    // Use configured API key only if client's token not available
    else if (OPENAI_API_KEY) {
      headers['Authorization'] = `Bearer ${OPENAI_API_KEY}`;
      console.log(`[PROXY] Using configured API key`);
    }
    
    // Copy over relevant headers from the original request
    const forwardHeaders = [
      'anthropic-version',
      'anthropic-beta',
      'x-api-key',
      'claude-api-key',
      'claude-api-version'
    ]
    
    for (const header of forwardHeaders) {
      const headerKey = header.toLowerCase()
      if (req.headers[headerKey]) {
        const value = Array.isArray(req.headers[headerKey]) 
          ? (req.headers[headerKey] as string[])[0]
          : req.headers[headerKey] as string
        headers[header] = value
      }
    }
    
    // Make the proxy request
    const proxyResponse = await fetch(url, {
      method: 'GET',
      headers
    })
    
    // Handle errors from the upstream API
    if (!proxyResponse.ok) {
      console.error(`[PROXY] Error from upstream API: ${proxyResponse.status}`);
      
      try {
        // Try to parse as JSON first
        const errorData = await proxyResponse.json();
        return res.status(proxyResponse.status).json(errorData);
      } catch (parseError) {
        // If not JSON, get the text response
        try {
          const errorText = await proxyResponse.text();
          console.error(`[PROXY] Non-JSON error response: ${errorText.substring(0, 100)}...`);
          return res.status(proxyResponse.status).json({
            error: {
              message: `Proxy error: ${proxyResponse.status} ${proxyResponse.statusText}`,
              type: 'proxy_error',
              proxy_status: proxyResponse.status,
              proxy_text: errorText.substring(0, 200) // Include part of the response for debugging
            }
          });
        } catch (textError) {
          // If we can't even get the text, return a generic error
          return res.status(proxyResponse.status).json({
            error: {
              message: `Proxy error: ${proxyResponse.status} ${proxyResponse.statusText}`,
              type: 'proxy_error'
            }
          });
        }
      }
    }
    
    // Try to parse the response as JSON
    try {
      const data = await proxyResponse.json();
      console.log(`[PROXY] Success: received models data`);
      return res.status(200).json(data);
    } catch (parseError) {
      console.error(`[PROXY] Error parsing JSON response: ${parseError}`);
      return res.status(500).json({
        error: {
          message: 'Failed to parse proxy response as JSON',
          type: 'server_error',
        }
      });
    }
    
  } catch (error) {
    console.error('[PROXY] Error proxying request:', error)
    return res.status(500).json({
      error: {
        message: 'An error occurred while processing your request',
        type: 'server_error',
      }
    })
  }
}

// Configure for Node.js runtime
export const config = {
  runtime: 'nodejs',
} 