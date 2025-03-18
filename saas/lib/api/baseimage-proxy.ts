/**
 * Utility functions for proxying authenticated requests to the BaseImage proxy
 */

export const BASEIMAGE_PROXY_URL = process.env.BASEIMAGE_PROXY_URL || 'http://localhost:3000'
export const BASEIMAGE_AUTH_TOKEN = process.env.BASEIMAGE_AUTH_TOKEN || ''

/**
 * Build a URL for the BaseImage proxy API
 * @param endpoint - The API endpoint (without version prefix)
 * @returns Full URL to the API endpoint
 */
export function buildBaseImageUrl(endpoint: string): string {
  // Clean the endpoint to ensure no leading slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint
  
  // Build the URL with the v1 prefix
  const url = `${BASEIMAGE_PROXY_URL}/v1/${cleanEndpoint}`;
  
  console.log(`[BASEIMAGE-PROXY] Using URL: ${url}`);
  
  return url
}

/**
 * Formats OpenAI-compatible streaming data for SSE
 * The BaseImage proxy may not format the streaming response exactly like OpenAI,
 * so we need to ensure the response is properly formatted
 */
export function formatStreamingResponse(originalData: string): string {
  // If empty or whitespace, ignore
  if (!originalData || !originalData.trim()) {
    return '';
  }
  
  // If the data is already properly formatted, return it as is
  if (originalData.startsWith('data:')) {
    return originalData;
  }

  try {
    // Try to parse the data as JSON
    const jsonData = JSON.parse(originalData);
    
    // Format it as an SSE compatible event
    return `data: ${JSON.stringify(jsonData)}\n\n`;
  } catch (e) {
    // If parsing fails, handle as text
    
    // Clean the text - remove any invalid characters that might break JSON
    const cleanText = originalData
      .replace(/\\/g, '\\\\') // Escape backslashes
      .replace(/"/g, '\\"')   // Escape quotes
      .replace(/\n/g, '\\n')  // Convert newlines to escaped newlines
      .replace(/\r/g, '\\r')  // Convert carriage returns
      .replace(/\t/g, '\\t'); // Convert tabs
      
    console.log(`[BASEIMAGE-PROXY] Formatting text response: ${cleanText.substring(0, 50)}${cleanText.length > 50 ? '...' : ''}`);
    
    // Wrap the text in a simple delta format compatible with OpenAI streaming format
    return `data: {"choices":[{"delta":{"content":"${cleanText}"}}]}\n\n`;
  }
}

/**
 * Proxy a request to the BaseImage proxy with authentication
 * This function handles proxying requests with the proper authentication headers
 * 
 * @param endpoint - The API endpoint (e.g. "chat/completions")
 * @param method - The HTTP method
 * @param headers - The request headers from the client
 * @param body - The request body
 * @returns The response from the BaseImage proxy
 */
export async function proxyToBaseImage(
  endpoint: string, 
  method: string, 
  headers: Record<string, string>,
  body: any
): Promise<Response> {
  const url = buildBaseImageUrl(endpoint);
  
  // Create headers for the proxy request
  const proxyHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // If we have a configured auth token for BaseImage, use it
  if (BASEIMAGE_AUTH_TOKEN) {
    proxyHeaders['X-API-Key'] = BASEIMAGE_AUTH_TOKEN;
    console.log(`[BASEIMAGE-PROXY] Using configured auth token`);
  }
  
  // If there's an OpenAI-compatible API key in the Authorization header,
  // still add it as X-OpenAI-Auth so the BaseImage service can use it if needed
  if (headers.authorization && headers.authorization.startsWith('Bearer sk-')) {
    proxyHeaders['X-OpenAI-Auth'] = headers.authorization;
    console.log(`[BASEIMAGE-PROXY] Forwarding client API key as X-OpenAI-Auth`);
  }
  
  // Copy over selected headers from the original request
  // (only those that don't interfere with our auth mechanism)
  const forwardHeaders = [
    'user-agent',
    'accept',
    'accept-encoding',
    'accept-language'
  ];
  
  for (const header of forwardHeaders) {
    if (headers[header]) {
      proxyHeaders[header] = headers[header];
    }
  }

  console.log(`[BASEIMAGE-PROXY] Forwarding request to ${url}`);
  console.log(`[BASEIMAGE-PROXY] Request body:`, body);
  
  // Make the proxy request
  return fetch(url, {
    method,
    headers: proxyHeaders,
    body: JSON.stringify(body)
  });
} 