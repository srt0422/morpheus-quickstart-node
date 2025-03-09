# Docker Development Setup

This project includes a Docker Compose configuration for local development, which provides:

1. A Next.js application container
2. A Redis container to replace Upstash for local development

## Requirements

- Docker and Docker Compose installed on your machine
- Node.js and npm installed locally (for running commands outside Docker)

## Getting Started

### Using Docker Compose

1. Start the development environment:

```bash
docker-compose up
```

This will:
- Start a Redis container
- Build and start the Next.js application
- Mount your local codebase to the container for live reloading

2. The application will be available at:
   - http://localhost:3000

3. To stop the services:

```bash
docker-compose down
```

### Development Without Docker

If you prefer to develop without Docker, you can:

1. Run Redis locally or use a remote Redis instance
2. Update the `.env.development` file with the correct Redis connection details
3. Run the application:

```bash
npm install
npm run dev
```

## Environment Variables

- `.env.local` - Used by the Docker setup (Redis host is set to the container name)
- `.env.development` - Used for local development without Docker (Redis host is localhost)

## How It Works

The application uses a Redis adapter that works with both:
- Local Redis for development
- Upstash for production

When the `REDIS_HOST` and `REDIS_PORT` environment variables are set, the application will use the local Redis instance. Otherwise, it will try to use Upstash credentials.

## Testing API Endpoints

After starting the services, you can:

1. Visit http://localhost:3000 to access the UI
2. Generate API keys using the interface
3. Test rate-limiting functionality

## Troubleshooting

- If you encounter connection issues to Redis, make sure the Redis container is running:
  ```bash
  docker-compose ps
  ```

- To view logs:
  ```bash
  docker-compose logs -f
  ```

- If you need to rebuild the application container:
  ```bash
  docker-compose build --no-cache app
  ``` 