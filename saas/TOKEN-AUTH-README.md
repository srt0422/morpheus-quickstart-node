# Token Authentication Layer for BaseImage Proxy

This project implements a token authentication layer for the BaseImage proxy service. It proxies requests from the SaaS service to the BaseImage service after authenticating them, without requiring any changes to the BaseImage project.

## How It Works

1. The SaaS application authenticates API requests using API keys that start with `sk-` and are stored in Redis.
2. Once authenticated, the request is proxied to the BaseImage service with the appropriate headers.
3. The BaseImage service receives the request and processes it normally.

## Configuration

The following environment variables need to be set:

```env
# BaseImage proxy configuration
BASEIMAGE_PROXY_URL=http://your-baseimage-proxy-url
BASEIMAGE_AUTH_TOKEN=your-baseimage-auth-token
```

- `BASEIMAGE_PROXY_URL`: The URL of the BaseImage proxy service
- `BASEIMAGE_AUTH_TOKEN`: The authentication token to use when making requests to the BaseImage proxy

## API Endpoints

The authentication layer proxies requests to the following endpoints:

- `/api/v1/chat/completions`: Chat completions API (POST)

## Authentication Flow

1. Client makes a request to the SaaS API with an API key in the `Authorization` header (format: `Bearer sk-xxx`)
2. The SaaS API authenticates the request using its Redis-based authentication system
3. If authentication is successful, the SaaS API proxies the request to the BaseImage service with the `BASEIMAGE_AUTH_TOKEN` in the `X-API-Key` header
4. The BaseImage service processes the request and returns the response
5. The SaaS API forwards the response back to the client

## Security Considerations

- The SaaS application never exposes the BaseImage authentication token to clients
- All authentication happens in the SaaS application before proxying to BaseImage
- No modifications are needed in the BaseImage project
- The SaaS application can implement rate limiting, quotas, and other security measures independently

## Implementation Details

The main components of the authentication layer are:

1. `lib/api/auth-middleware.ts`: Handles API key authentication
2. `lib/api/baseimage-proxy.ts`: Proxies authenticated requests to the BaseImage service
3. `pages/api/v1/chat/completions.ts`: API endpoint that handles chat completions

## Testing

You can test the authentication layer using curl:

```bash
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key" \
  -d '{
    "model": "LMR-Hermes-2-Theta-Llama-3-8B",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

## End-to-End Testing with the UI

The SaaS application includes a UI for testing the chat completions API. To use the UI for end-to-end testing:

1. Ensure Redis is running (on port 6379 by default)
2. Start the SaaS application:
   ```bash
   cd saas
   npm run dev
   ```

3. Open your browser to http://localhost:3000
4. Use the UI to:
   - Create a new API key (using the "Add new API Key" button)
   - Activate the key
   - Select the key from the dropdown
   - Enter a prompt and click "Make request"

### Troubleshooting

If you encounter issues with the end-to-end testing, check the following:

1. **Redis Connection**: Ensure Redis is running and accessible. The application will log Redis connection errors in the console.

2. **BaseImage Proxy URL**: Verify that the BaseImage proxy URL in `.env` is correctly pointing to your BaseImage service. For local development, you can set it to `http://localhost:3000` (or the port your BaseImage service is running on).

3. **API Key Authentication**: Make sure your API key is properly stored in Redis. You can check this by running:
   ```bash
   redis-cli GET api:key:sk-your-api-key
   ```
   This should return a user ID if the key is valid.

4. **Response Format**: If you're getting errors about parsing the response, check that the BaseImage service is returning responses in the expected format. The SaaS application tries to handle various response formats, but may need adjustments for specific BaseImage implementations.

5. **Network Access**: Ensure there are no network issues preventing the SaaS application from reaching the BaseImage service.

## Customizing the Integration

If you need to customize the integration to handle specific response formats or authentication methods:

1. Modify `lib/api/baseimage-proxy.ts` to adjust the proxy behavior
2. Update `pages/api/v1/chat/completions.ts` to handle different response formats
3. If necessary, update `components/api-request.tsx` to display the response properly 