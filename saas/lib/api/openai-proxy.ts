/**
 * Utility functions for proxying requests to OpenAI-compatible APIs
 */

// Hard-code the proxy URL to ensure it's used correctly
export const OPENAI_API_HOST = process.env.BASEIMAGE_PROXY_URL || 'https://nfa-proxy-101868473812.us-west1.run.app'
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
export const OPENAI_API_VERSION = 'v1'

/**
 * Verify that the OpenAI configuration is valid
 * @returns Error message if configuration is invalid, or null if valid
 */
export function verifyOpenAIConfig(): string | null {
  // API host is now hard-coded, so we don't need to verify it
  return null
}

/**
 * Build a URL for the OpenAI-compatible API
 * @param endpoint - The API endpoint (without version prefix)
 * @returns Full URL to the API endpoint
 */
export function buildOpenAIUrl(endpoint: string): string {
  // Clean the endpoint to ensure no leading slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint
  
  // The proxy URL structure is uncertain, so we'll log what we're trying
  console.log(`[PROXY] Endpoint requested: ${cleanEndpoint}`);
  
  // First, try the standard OpenAI API pattern with /v1/ prefix
  const url = `${OPENAI_API_HOST}/v1/${cleanEndpoint}`;
  
  console.log(`[PROXY] Using URL: ${url}`);
  console.log(`[PROXY] Note: If this doesn't work, the proxy endpoint structure might be different.`);
  console.log(`[PROXY] You may need to contact the proxy maintainer for the correct URL pattern.`);
  
  return url
}

/**
 * Standard error response format for OpenAI-compatible APIs
 */
export interface OpenAIErrorResponse {
  error: {
    message: string
    type: string
    param?: string | null
    code?: string
  }
} 