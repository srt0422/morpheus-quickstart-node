import type { NextApiRequest, NextApiResponse } from 'next'
import { get, incr, expire } from '@lib/redis-adapter'
import { getRedisClient } from '@lib/redis-adapter'

export const config = {
  runtime: 'nodejs',
}

// Simple rate limiting for Node.js environment
async function simpleRateLimit(req: NextApiRequest): Promise<boolean> {
  try {
    // Get IP address from request
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (Array.isArray(ip)) {
      ip = ip[0];
    }
    
    const key = `rate-limit:${ip}`;
    
    // Get current count
    const current = await get(key);
    let count = 1;
    
    if (current) {
      count = parseInt(current as string, 10) + 1;
      await incr(key);
    } else {
      await set(key, '1');
      await expire(key, 60); // Expire after 60 seconds
    }
    
    // Allow 100 requests per minute
    return count <= 100;
  } catch (error) {
    console.error('Rate limiting error:', error);
    return true; // Allow on error
  }
}

// Helper to set Redis value
async function set(key: string, value: string): Promise<void> {
  try {
    const client = await getRedisClient();
    await client.set(key, value);
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check rate limit
  const allowed = await simpleRateLimit(req);
  
  if (!allowed) {
    return res.status(429).json({ 
      error: {
        message: 'Too many requests',
        type: 'rate_limit_error'
      }
    });
  }
  
  // Return success response
  res.status(200).json({ success: true });
}
