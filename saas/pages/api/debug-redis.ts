import type { NextApiRequest, NextApiResponse } from 'next'
import { get, getRedisClient } from '@lib/redis-adapter'
import { API_KEY_PREFIX, USER_KEYS_PREFIX } from '@lib/api/constants'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow in development for security
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Forbidden in production' });
  }

  try {
    const { action, key, pattern } = req.query;

    // Get a specific key from Redis
    if (action === 'get' && key) {
      const value = await get(key as string);
      return res.status(200).json({ 
        key, 
        value,
        found: value !== null 
      });
    }
    
    // List keys matching a pattern
    if (action === 'keys' && pattern) {
      const redis = await getRedisClient();
      const keys = await redis.keys(pattern as string);
      
      // Get values for each key
      const values = [];
      for (const key of keys) {
        const value = await get(key);
        values.push({ key, value });
      }
      
      return res.status(200).json({ 
        pattern, 
        keys,
        values,
        count: keys.length 
      });
    }
    
    // List all API keys
    if (action === 'api-keys') {
      const redis = await getRedisClient();
      
      // Get simple keys
      const simpleKeyPattern = `${API_KEY_PREFIX}*`;
      const simpleKeys = await redis.keys(simpleKeyPattern);
      const simpleKeyValues = [];
      
      for (const key of simpleKeys) {
        const value = await get(key);
        simpleKeyValues.push({ key, value });
      }
      
      // Get user keys
      const userKeyPattern = `${USER_KEYS_PREFIX}*`;
      const userKeys = await redis.keys(userKeyPattern);
      const userKeyValues = [];
      
      for (const key of userKeys) {
        const value = await get(key);
        userKeyValues.push({ key, value });
      }
      
      return res.status(200).json({
        simpleKeys: {
          pattern: simpleKeyPattern,
          keys: simpleKeys,
          values: simpleKeyValues,
          count: simpleKeys.length
        },
        userKeys: {
          pattern: userKeyPattern,
          keys: userKeys,
          values: userKeyValues,
          count: userKeys.length
        }
      });
    }
    
    // Default response with instructions
    return res.status(200).json({
      message: 'Redis Debug API',
      usage: [
        { action: 'get', params: { key: 'key-to-get' } },
        { action: 'keys', params: { pattern: 'pattern-to-match*' } },
        { action: 'api-keys', params: {} }
      ]
    });
  } catch (error) {
    console.error('Redis debug API error:', error);
    return res.status(500).json({ error: String(error) });
  }
} 