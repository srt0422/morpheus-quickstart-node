/**
 * CLI script to generate API keys for development and testing
 * Run with: npx ts-node scripts/generate-api-key.ts [userId] [keyType]
 * 
 * Note: This script is for local development only and uses direct Redis connections.
 * The API endpoints should use the redis-adapter instead.
 */

import Redis from 'ioredis'
import crypto from 'crypto'

// Prefixes for Redis storage
const API_KEY_PREFIX = 'apikey:'
const USER_KEYS_PREFIX = 'user-keys:'

/**
 * Generate a secure random API key
 * In the format "sk-" followed by 48 characters (OpenAI compatible)
 */
function generateApiKey(): string {
  return `sk-${crypto.randomBytes(24).toString('hex')}`
}

async function main() {
  // Get user ID and key type from command line args
  const userId = process.argv[2] || 'test-user'
  const keyType = process.argv[3] || 'simple'
  
  // Only support simple keys in this script
  if (keyType !== 'simple') {
    console.log('This script only supports generating "simple" API keys.')
    console.log('For JWT tokens, use the API endpoint: POST /api/keys with { keyType: "jwt" }')
    process.exit(1)
  }
  
  try {
    // NOTE: In regular API code, use the redis-adapter instead
    // This is only for local CLI use
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    console.log(`Connecting to Redis at ${redisUrl}`)
    const redis = new Redis(redisUrl)
    
    // Generate API key
    const apiKey = generateApiKey()
    const createdAt = new Date().toISOString()
    
    console.log(`Generating API key for user: ${userId}`)
    
    // Store API key in Redis with user ID as value
    await redis.set(`${API_KEY_PREFIX}${apiKey}`, userId)
    console.log(`API key stored at ${API_KEY_PREFIX}${apiKey}`)
    
    // Add key to user's list of keys
    await redis.set(`${USER_KEYS_PREFIX}${userId}:${apiKey}`, createdAt)
    console.log(`API key added to user's keys at ${USER_KEYS_PREFIX}${userId}:${apiKey}`)
    
    // Close the Redis connection
    await redis.quit()
    
    // Display the key
    console.log('\n========== API KEY GENERATED ==========')
    console.log(`API key: ${apiKey}`)
    console.log('=======================================')
    console.log('\nStore this key securely! It will not be shown again.')
    console.log('Use it in the Authorization header: "Bearer YOUR_API_KEY"')
    console.log('This key is compatible with OpenAI client libraries.')
  } catch (error) {
    console.error('Error generating API key:', error)
    process.exit(1)
  }
}

// Run the script
main() 