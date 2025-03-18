import { createClient } from 'redis';
import { upstashRest } from './upstash';

// Create Redis client based on environment
let redisClient: any = null;
let isConnecting = false;

// First, check if a Docker Redis container is available
const hasRedisUrl = typeof process !== 'undefined' && process.env.REDIS_URL;

// Second, check for Upstash credentials
const hasUpstashCreds = typeof process !== 'undefined' && 
                        process.env.UPSTASH_REST_API_DOMAIN && 
                        process.env.UPSTASH_REST_API_TOKEN;

// If REDIS_URL is explicitly set, prioritize using Docker/local Redis
// Otherwise, use Upstash if credentials are available
// If neither is available, use the mock implementation in upstash.ts
const useLocalRedis = hasRedisUrl;

/**
 * Get or create a Redis client
 */
async function getRedisInstance() {
  // Return existing client if it's ready
  if (redisClient && redisClient.isReady) {
    return redisClient;
  }
  
  // Wait if already connecting
  if (isConnecting) {
    let attempts = 0;
    while (isConnecting && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (redisClient && redisClient.isReady) {
      return redisClient;
    }
  }
  
  isConnecting = true;
  
  try {
    // Get Redis URL from environment
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log(`[REDIS] Connecting to Redis at ${redisUrl}`);
    
    // Create Redis client
    redisClient = createClient({
      url: redisUrl
    });
    
    // Add error handler
    redisClient.on('error', (err: Error) => {
      console.error('[REDIS] Connection error:', err);
      // Don't null out the client, let it reconnect
    });
    
    // Connect to Redis
    await redisClient.connect();
    console.log('[REDIS] Successfully connected to Redis server');
    isConnecting = false;
    return redisClient;
  } catch (error) {
    console.error('[REDIS] Failed to create or connect to Redis client:', error);
    isConnecting = false;
    redisClient = null; // Reset client on error
    throw error;
  }
}

/**
 * Helper to check if Redis client is available for retrying connection
 */
async function shouldRetryConnection(): Promise<boolean> {
  if (!useLocalRedis) return false;
  
  // If we've never tried to connect, try now
  if (redisClient === null) return true;
  
  // If client exists but not ready, check if it's been a while since we tried
  if (redisClient && !redisClient.isReady) {
    // Only retry if we've waited at least 5 seconds since last attempt
    const now = Date.now();
    const lastAttempt = (redisClient as any).lastConnectionAttempt || 0;
    if (now - lastAttempt > 5000) {
      (redisClient as any).lastConnectionAttempt = now;
      return true;
    }
  }
  
  return false;
}

/**
 * Get a value from Redis
 */
export async function get(key: string): Promise<any> {
  console.log(`[REDIS] GET operation for key: ${key}`);
  
  // If we're configured to use local Redis, try that first
  if (useLocalRedis) {
    try {
      const client = await getRedisInstance();
      const result = await client.get(key);
      console.log(`[REDIS] Local Redis result: ${result ? 'found' : 'not found'}`);
      return result;
    } catch (error) {
      console.error('[REDIS] Local Redis GET error:', error);
      
      // If we have Upstash credentials, fall back to that
      if (hasUpstashCreds) {
        console.log('[REDIS] Falling back to Upstash for GET');
        try {
          const result = await upstashRest(['GET', key]);
          console.log(`[REDIS] Upstash fallback result: ${result ? 'found' : 'not found'}`);
          return result;
        } catch (fallbackError) {
          console.error('[REDIS] Upstash fallback error:', fallbackError);
        }
      }
    }
  } 
  // If we're not using local Redis, use Upstash if available
  else if (hasUpstashCreds) {
    try {
      console.log('[REDIS] Using Upstash REST API');
      const result = await upstashRest(['GET', key]);
      console.log(`[REDIS] Upstash result: ${result ? 'found' : 'not found'}`);
      return result;
    } catch (error) {
      console.error('[REDIS] Upstash GET error:', error);
    }
  }
  // If neither local Redis nor Upstash is available, use mock implementation
  else {
    console.log('[REDIS] Using mock implementation');
    const result = await upstashRest(['GET', key]);
    console.log(`[REDIS] Mock result: ${result ? 'found' : 'not found'}`);
    return result;
  }
  
  // Return null if all methods fail
  return null;
}

/**
 * Set a value in Redis
 */
export async function set(key: string, value: any, options?: { ex?: number }): Promise<any> {
  console.log(`[REDIS] SET operation for key: ${key}, value: ${value}`);
  
  // If we're configured to use local Redis, try that first
  if (useLocalRedis) {
    try {
      const client = await getRedisInstance();
      let result;
      if (options?.ex) {
        console.log(`[REDIS] Setting with expiration: ${options.ex} seconds`);
        result = await client.set(key, value, { EX: options.ex });
      } else {
        result = await client.set(key, value);
      }
      console.log(`[REDIS] Local Redis SET result: ${result}`);
      return result;
    } catch (error) {
      console.error('[REDIS] Local Redis SET error:', error);
      
      // If we have Upstash credentials, fall back to that
      if (hasUpstashCreds) {
        console.log('[REDIS] Falling back to Upstash for SET');
        try {
          const args = ['SET', key, value];
          if (options?.ex) {
            args.push('EX', options.ex);
          }
          const result = await upstashRest(args);
          console.log(`[REDIS] Upstash fallback SET result: ${result}`);
          return result;
        } catch (fallbackError) {
          console.error('[REDIS] Upstash fallback SET error:', fallbackError);
        }
      }
    }
  } 
  // If we're not using local Redis, use Upstash if available
  else if (hasUpstashCreds) {
    try {
      console.log('[REDIS] Using Upstash REST API for SET');
      const args = ['SET', key, value];
      if (options?.ex) {
        console.log(`[REDIS] Setting with expiration: ${options.ex} seconds`);
        args.push('EX', options.ex);
      }
      const result = await upstashRest(args);
      console.log(`[REDIS] Upstash SET result: ${result}`);
      return result;
    } catch (error) {
      console.error('[REDIS] Upstash SET error:', error);
    }
  }
  // If neither local Redis nor Upstash is available, use mock implementation
  else {
    console.log('[REDIS] Using mock implementation for SET');
    const args = ['SET', key, value];
    if (options?.ex) {
      args.push('EX', options.ex);
    }
    const result = await upstashRest(args);
    console.log(`[REDIS] Mock SET result: ${result}`);
    return result;
  }
  
  // Return null if all methods fail
  return null;
}

/**
 * Increment a value in Redis
 */
export async function incr(key: string): Promise<number> {
  console.log(`[REDIS] INCR operation for key: ${key}`);
  
  // If we're configured to use local Redis, try that first
  if (useLocalRedis) {
    try {
      const client = await getRedisInstance();
      const result = await client.incr(key);
      console.log(`[REDIS] Local Redis INCR result: ${result}`);
      return result;
    } catch (error) {
      console.error('[REDIS] Local Redis INCR error:', error);
      
      // If we have Upstash credentials, fall back to that
      if (hasUpstashCreds) {
        console.log('[REDIS] Falling back to Upstash for INCR');
        try {
          const result = await upstashRest(['INCR', key]);
          console.log(`[REDIS] Upstash fallback INCR result: ${result}`);
          return result;
        } catch (fallbackError) {
          console.error('[REDIS] Upstash fallback INCR error:', fallbackError);
        }
      }
    }
  } 
  // If we're not using local Redis, use Upstash if available
  else if (hasUpstashCreds) {
    try {
      console.log('[REDIS] Using Upstash REST API for INCR');
      const result = await upstashRest(['INCR', key]);
      console.log(`[REDIS] Upstash INCR result: ${result}`);
      return result;
    } catch (error) {
      console.error('[REDIS] Upstash INCR error:', error);
    }
  }
  // If neither local Redis nor Upstash is available, use mock implementation
  else {
    console.log('[REDIS] Using mock implementation for INCR');
    const result = await upstashRest(['INCR', key]);
    console.log(`[REDIS] Mock INCR result: ${result}`);
    return result;
  }
  
  // Return 0 if all methods fail
  return 0;
}

/**
 * Set expiration for a key in Redis
 */
export async function expire(key: string, seconds: number): Promise<any> {
  console.log(`[REDIS] EXPIRE operation for key: ${key}, seconds: ${seconds}`);
  
  // If we're configured to use local Redis, try that first
  if (useLocalRedis) {
    try {
      const client = await getRedisInstance();
      const result = await client.expire(key, seconds);
      console.log(`[REDIS] Local Redis EXPIRE result: ${result}`);
      return result;
    } catch (error) {
      console.error('[REDIS] Local Redis EXPIRE error:', error);
      
      // If we have Upstash credentials, fall back to that
      if (hasUpstashCreds) {
        console.log('[REDIS] Falling back to Upstash for EXPIRE');
        try {
          const result = await upstashRest(['EXPIRE', key, seconds]);
          console.log(`[REDIS] Upstash fallback EXPIRE result: ${result}`);
          return result;
        } catch (fallbackError) {
          console.error('[REDIS] Upstash fallback EXPIRE error:', fallbackError);
        }
      }
    }
  } 
  // If we're not using local Redis, use Upstash if available
  else if (hasUpstashCreds) {
    try {
      console.log('[REDIS] Using Upstash REST API for EXPIRE');
      const result = await upstashRest(['EXPIRE', key, seconds]);
      console.log(`[REDIS] Upstash EXPIRE result: ${result}`);
      return result;
    } catch (error) {
      console.error('[REDIS] Upstash EXPIRE error:', error);
    }
  }
  // If neither local Redis nor Upstash is available, use mock implementation
  else {
    console.log('[REDIS] Using mock implementation for EXPIRE');
    const result = await upstashRest(['EXPIRE', key, seconds]);
    console.log(`[REDIS] Mock EXPIRE result: ${result}`);
    return result;
  }
  
  // Return null if all methods fail
  return null;
}

/**
 * Get a Redis client for direct operations
 */
export async function getRedisClient(): Promise<any> {
  // If we're configured to use local Redis, try that first
  if (useLocalRedis) {
    try {
      // Get or create Redis client
      const client = await getRedisInstance();
      
      // Create a wrapper with all needed methods
      return {
        // Direct client methods
        get: async (key: string) => client.get(key),
        set: async (key: string, value: any) => client.set(key, value),
        incr: async (key: string) => client.incr(key),
        expire: async (key: string, seconds: number) => client.expire(key, seconds),
        
        // Additional methods needed by the application
        keys: async (pattern: string) => client.keys(pattern),
        del: async (key: string) => client.del(key),
        hexists: async (key: string, field: string) => client.hExists(key, field),
        hdel: async (key: string, field: string) => client.hDel(key, field),
        hgetall: async (key: string) => client.hGetAll(key)
      };
    } catch (error) {
      console.error('[REDIS] Error getting local Redis client:', error);
      
      // If we have Upstash credentials, fall back to that
      if (hasUpstashCreds) {
        console.log('[REDIS] Falling back to Upstash client');
        return getUpstashClient();
      }
    }
  }
  // If we're not using local Redis, use Upstash if available
  else if (hasUpstashCreds) {
    return getUpstashClient();
  }
  // If neither local Redis nor Upstash is available, use mock implementation
  else {
    console.log('[REDIS] Using mock implementation client');
    return getUpstashClient();
  }
}

/**
 * Helper to get a client for Upstash operations
 */
function getUpstashClient() {
  console.log('[REDIS] Creating Upstash client wrapper');
  return {
    get: async (key: string) => get(key),
    set: async (key: string, value: any) => set(key, value),
    incr: async (key: string) => incr(key),
    expire: async (key: string, seconds: number) => expire(key, seconds),
    
    // Upstash implementations
    keys: async (pattern: string) => {
      try {
        console.log(`[REDIS] KEYS operation for pattern: ${pattern}`);
        const result = await upstashRest(['KEYS', pattern]);
        
        // Handle Upstash REST API response format which returns {result: [...]}
        if (result && typeof result === 'object' && 'result' in result) {
          console.log(`[REDIS] Upstash KEYS result format detected, extracting array from result property`);
          return Array.isArray(result.result) ? result.result : [];
        }
        
        // Handle direct array response (standard Redis client format)
        return Array.isArray(result) ? result : [];
      } catch (error) {
        console.error('[REDIS] KEYS error:', error);
        return [];
      }
    },
    del: async (key: string) => upstashRest(['DEL', key]),
    hexists: async (key: string, field: string) => upstashRest(['HEXISTS', key, field]),
    hdel: async (key: string, field: string) => upstashRest(['HDEL', key, field]),
    hgetall: async (key: string) => upstashRest(['HGETALL', key])
  };
} 