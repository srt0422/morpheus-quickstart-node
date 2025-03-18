/**
 * Upstash REST and Edge API utils.
 * Note: We use this lib in multiple demos, feel free to
 * use it in your own projects.
 */

// For development use when Upstash credentials are not available
const isDevelopment = process.env.NODE_ENV === 'development';

// Create the mock storage as a simple object for better serialization
let mockStorage: Record<string, any> = {};

// Load any previously saved data
if (isDevelopment && typeof window !== 'undefined') {
  try {
    // In browser context, use localStorage
    const saved = localStorage.getItem('mock-redis-data');
    if (saved) {
      mockStorage = JSON.parse(saved);
      console.log('[UPSTASH] Loaded mock data from localStorage');
    }
  } catch (error) {
    console.error('[UPSTASH] Error loading mock data:', error);
  }
}

// Save mock data to persistent storage
function saveMockData() {
  if (isDevelopment && typeof window !== 'undefined') {
    try {
      localStorage.setItem('mock-redis-data', JSON.stringify(mockStorage));
    } catch (error) {
      console.error('[UPSTASH] Error saving mock data:', error);
    }
  }
}

// Handle mock commands for development environment
function handleMockCommand(args: any[]) {
  const command = Array.isArray(args) && args.length > 0 ? args[0].toLowerCase() : '';
  
  if (command === 'get') {
    return mockStorage[args[1]] || null;
  } 
  else if (command === 'set') {
    mockStorage[args[1]] = args[2];
    saveMockData();
    return 'OK';
  } 
  else if (command === 'incr') {
    const current = mockStorage[args[1]] || 0;
    mockStorage[args[1]] = current + 1;
    saveMockData();
    return current + 1;
  }
  else if (command === 'keys') {
    // For KEYS command, return an empty array if no pattern provided
    if (!args[1]) return [];
    
    // Simple pattern matching for development
    const pattern = args[1].replace(/\*/g, '');
    return Object.keys(mockStorage).filter(key => key.includes(pattern));
  }
  else if (command === 'del') {
    delete mockStorage[args[1]];
    saveMockData();
    return 1;
  }
  
  // Default return for unhandled commands
  return null;
}

async function upstash({
  url,
  token,
  ...init
}: { url: string; token: string } & RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })

  const data = res.headers.get('Content-Type')!.includes('application/json')
    ? await res.json()
    : await res.text()

  if (res.ok) {
    return data
  } else {
    throw new Error(
      `Upstash failed with (${res.status}): ${
        typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      }`
    )
  }
}

export async function upstashRest(
  args: any[],
  options?: { pipeline: boolean }
) {
  const domain = process.env.UPSTASH_REST_API_DOMAIN
  const token = process.env.UPSTASH_REST_API_TOKEN

  console.log(`[UPSTASH] Command: ${args[0]}, Key: ${args[1]}`);

  if ((!domain || !token) && isDevelopment) {
    console.warn('[UPSTASH] Using mock Upstash implementation for development');
    // Mock implementation for development
    const result = handleMockCommand(args);
    console.log(`[UPSTASH] Mock result: ${JSON.stringify(result)}`);
    return result;
  }
  
  if (!domain || !token) {
    console.error('[UPSTASH] Missing Upstash credentials');
    throw new Error('Missing required Upstash credentials of the REST API')
  }

  console.log(`[UPSTASH] Making request to: https://${domain}${options?.pipeline ? '/pipeline' : ''}`);
  try {
    const result = await upstash({
      token,
      url: `https://${domain}${options?.pipeline ? '/pipeline' : ''}`,
      method: 'POST',
      body: JSON.stringify(args),
    });
    console.log(`[UPSTASH] Request successful, result: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    console.error('[UPSTASH] Request failed', error);
    throw error;
  }
}

export async function upstashEdge(args: any[]) {
  const domain = process.env.UPSTASH_EDGE_API_DOMAIN
  const token = process.env.UPSTASH_EDGE_API_TOKEN

  if ((!domain || !token) && isDevelopment) {
    console.warn('[UPSTASH] Using mock Upstash Edge implementation for development.');
    // Return mock response for development
    return null;
  }
  
  if (!domain || !token) {
    throw new Error('Missing required Upstash credentials of the Edge API')
  }

  return upstash({ token, url: `https://${domain}/${args.join('/')}` })
}
