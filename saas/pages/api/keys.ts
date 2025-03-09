import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { get, set, getRedisClient } from '@lib/redis-adapter'
import { API_KEY_PREFIX, USER_KEYS_PREFIX } from '@lib/api/constants'

// Helper to generate OpenAI-compatible API keys
function generateSimpleApiKey(): string {
  return `sk-${crypto.randomBytes(24).toString('hex')}`
}

export default async function keys(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'PUT': {
        try {
          console.log('[KEYS-API] Creating a new key');
          console.log('[KEYS-API] Request body:', req.body);
          
          // Extract user ID parameter from request body or use default
          const userId = req.body?.userId || 'default-user';

          console.log(`[KEYS-API] Creating a simple key for user: ${userId}`);

          // Generate an OpenAI-compatible API key
          const apiKey = generateSimpleApiKey();
          const createdAt = new Date().toISOString();
          
          console.log(`[KEYS-API] Generated new simple API key: ${apiKey.substring(0, 8)}...`);
          console.log(`[KEYS-API] Storing in Redis with key: ${API_KEY_PREFIX}${apiKey}`);
          
          // Store the API key in Redis with the user ID as the value
          await set(`${API_KEY_PREFIX}${apiKey}`, userId);
          
          // Add this key to the user's list of keys with creation timestamp
          await set(`${USER_KEYS_PREFIX}${userId}:${apiKey}`, createdAt);
          
          console.log('[KEYS-API] Key stored successfully in Redis');
          console.log('[KEYS-API] Verifying key was stored...');
          
          // Verify the key was stored correctly
          const storedUserId = await get(`${API_KEY_PREFIX}${apiKey}`);
          console.log(`[KEYS-API] Verification result: ${storedUserId ? 'success' : 'failed'}`);
          
          return res.status(200).json({ 
            done: true, 
            key: apiKey, 
            type: 'simple',
            createdAt 
          });
        } catch (error) {
          console.error('Error creating API key:', error);
          return res.status(500).json({ error: { message: 'Failed to create API key' } });
        }
      }
      case 'GET': {
        try {
          const userId = req.query.userId || 'default-user';
          console.log(`[KEYS-API] Getting keys for user: ${userId}`);
          
          const redis = await getRedisClient();
          let keys: any[] = [];
          
          // Get simple API keys for the user
          try {
            const simpleKeyPattern = `${USER_KEYS_PREFIX}${userId}:*`;
            console.log(`[KEYS-API] Looking up keys with pattern: ${simpleKeyPattern}`);
            
            const simpleKeys = await redis.keys(simpleKeyPattern) || [];
            console.log(`[KEYS-API] Found ${simpleKeys.length} keys`);
            
            // Ensure simpleKeys is always iterable
            if (Array.isArray(simpleKeys)) {
              for (const keyPath of simpleKeys) {
                const createdAt = await get(keyPath);
                const key = keyPath.split(':').pop(); // Extract the key from the path
                
                if (key && createdAt) {
                  // For client compatibility, use a standard format
                  keys.push([key, {
                    limit: 500,
                    timeframe: 60,
                    iat: new Date(createdAt).getTime() / 1000,
                    jti: key.substring(3, 10) // Use part of the key as the jti
                  }]);
                }
              }
            }
          } catch (error) {
            console.error('[KEYS-API] Error getting simple keys:', error);
          }

          console.log(`[KEYS-API] Returning ${keys.length} keys to client`);
          // Use the original response format for frontend compatibility
          return res.status(200).json({ apiKeys: keys });
        } catch (error) {
          console.error('Error listing API keys:', error);
          return res.status(500).json({ error: { message: 'Failed to list API keys' } });
        }
      }
      case 'DELETE': {
        try {
          const { key } = req.query;
          
          if (!key || typeof key !== 'string') {
            return res.status(400).json({ error: { message: 'Invalid request' } });
          }
          
          if (!key.startsWith('sk-')) {
            return res.status(400).json({ error: { message: 'Invalid API key format' } });
          }
          
          console.log(`[KEYS-API] Deleting key: ${key.substring(0, 8)}...`);
          
          const redis = await getRedisClient();
          const userId = req.query.userId || 'default-user';
          
          // Delete the key reference
          await redis.del(`${API_KEY_PREFIX}${key}`);
          
          // Delete from user's key list
          await redis.del(`${USER_KEYS_PREFIX}${userId}:${key}`);
          
          console.log('[KEYS-API] Key deleted successfully');
          return res.status(200).json({ done: true });
        } catch (error) {
          console.error('Error deleting API key:', error);
          return res.status(500).json({ error: { message: 'Failed to delete API key' } });
        }
      }
      default:
        res.status(405).json({
          error: { message: 'Method not allowed' },
        });
    }
  } catch (err) {
    console.error('Error managing API keys:', err);
    return res.status(500).json({
      error: { message: `An error occurred, ${err}` },
    });
  }
}
