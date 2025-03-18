// Redis debug script to check connection and list stored data
// Run with: node scripts/redis-debug.js

const { createClient } = require('redis');

// Constants from the application
const API_KEY_PREFIX = 'apikey:';
const USER_KEYS_PREFIX = 'user-keys:';

// Connect to Redis
async function main() {
  try {
    console.log('----- Redis Debug Tool -----');
    
    // Use environment variable or default to localhost
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log(`Connecting to Redis at ${redisUrl}`);
    
    // Create Redis client
    const redisClient = createClient({
      url: redisUrl
    });
    
    // Add error handler
    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
      process.exit(1);
    });
    
    // Connect to Redis
    await redisClient.connect();
    console.log('Successfully connected to Redis server');
    
    // List all API keys
    console.log('\n----- API Keys -----');
    const apiKeys = await redisClient.keys(`${API_KEY_PREFIX}*`);
    console.log(`Found ${apiKeys.length} API keys`);
    
    for (const key of apiKeys) {
      const userId = await redisClient.get(key);
      console.log(`Key: ${key} -> User: ${userId}`);
    }
    
    // List all user keys
    console.log('\n----- User Keys -----');
    const userKeys = await redisClient.keys(`${USER_KEYS_PREFIX}*`);
    console.log(`Found ${userKeys.length} user keys`);
    
    for (const key of userKeys) {
      const timestamp = await redisClient.get(key);
      console.log(`Key: ${key} -> Created: ${timestamp}`);
    }
    
    // List all other keys
    console.log('\n----- Other Keys -----');
    const allKeys = await redisClient.keys('*');
    const otherKeys = allKeys.filter(key => 
      !key.startsWith(API_KEY_PREFIX) && 
      !key.startsWith(USER_KEYS_PREFIX)
    );
    
    console.log(`Found ${otherKeys.length} other keys`);
    for (const key of otherKeys) {
      const value = await redisClient.get(key);
      console.log(`Key: ${key} -> Value: ${value}`);
    }
    
    // Close connection
    await redisClient.quit();
    console.log('\nRedis debug completed');
    
  } catch (error) {
    console.error('Error in Redis debug script:', error);
    process.exit(1);
  }
}

// Run the script
main(); 