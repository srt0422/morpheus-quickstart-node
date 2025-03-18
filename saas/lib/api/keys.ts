import { initRateLimit, CountFn } from '@lib/rate-limit'
import { get, incr, expire } from '@lib/redis-adapter'
import { API_KEY_PREFIX } from './constants'
import { ipRateLimit } from '@lib/ip-rate-limit'

/**
 * Creates a rate limit function that uses the API token for rate
 * limiting, and fallbacks to IP rate limiting if there's no token
 */
export const tokenRateLimit = initRateLimit(async (request, response) => {
  // Get bearer token from header
  const token = request.headers.get('Authorization')?.split(' ')[1]

  // Fallback to IP rate limiting if no bearer token is present
  if (!token) return ipRateLimit(request, response)

  // For simple API keys (starting with 'sk-')
  if (token.startsWith('sk-')) {
    try {
      console.log('[RATE-LIMIT] Checking API key:', token.substring(0, 8) + '...');
      // Check if the API key exists using redis adapter
      const userId = await get(`${API_KEY_PREFIX}${token}`)
      
      if (!userId) {
        console.log('[RATE-LIMIT] API key not found in Redis');
        return tokenExpired()
      }
      
      console.log('[RATE-LIMIT] API key is valid for user:', userId);
      
      // For simple keys, use default rate limits
      return {
        jti: token.substring(3, 13), // Use part of key as unique ID
        iat: Math.floor(Date.now() / 1000) - 60, // Set an arbitrary created time
        limit: 500, // Default limit
        timeframe: 60, // Default timeframe in seconds
        id: `simple-token:${token.substring(3, 13)}`,
        count: simpleKeyIncrement(token),
      }
    } catch (err) {
      console.error('[RATE-LIMIT] Error validating API key:', err)
      return tokenExpired()
    }
  }

  // Not a valid API key format
  console.log('[RATE-LIMIT] Invalid API key format, expecting sk-*');
  return tokenExpired()
})

// Helper function for simple key rate limiting
const simpleKeyIncrement = (token: string): CountFn => 
  async ({ response, key, timeframe }) => {
    // Latency logging
    const start = Date.now()
    
    // Check if the key still exists using redis adapter
    const userId = await get(`${API_KEY_PREFIX}${token}`)
    
    // Track the counter
    const count = await incr(key)
    await expire(key, timeframe)
    
    // Temporal logging
    const latency = Date.now() - start
    response.headers.set('x-upstash-latency', `${latency}`)
    
    // The key no longer exists in Redis
    if (!userId) return tokenExpired()
    
    return count
  }

const tokenExpired = () =>
  new Response(
    JSON.stringify({ error: { message: 'Invalid or expired API key' } }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
