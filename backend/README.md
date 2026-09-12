# ChatMoo Backend

A NestJS backend with Prisma (PostgreSQL) and Redis (Upstash) connections.

## Features

- NestJS framework with TypeScript
- Prisma ORM with PostgreSQL database
- Redis caching with Upstash
- Health check endpoints
- User CRUD operations with caching
- Environment configuration

## Prerequisites

- Node.js (v24+)
- PostgreSQL database
- Redis instance (Upstash)
- npm

## Installation

1. Install dependencies:
```bash
npm install --legacy-peer-deps
```

2. Configure environment variables in `.env`:
```env
DATABASE_URL="your_postgresql_connection_string"
UPSTASH_REDIS_REST_URL="your_upstash_redis_url"
UPSTASH_REDIS_REST_TOKEN="your_upstash_redis_token"
```

3. Generate Prisma client:
```bash
npm run prisma:generate
```

4. Push database schema:
```bash
npx prisma db push --accept-data-loss
```

## Running the Application

### Development
```bash
npm run build
npm run start:prod
```

### Production
```bash
npm run build
npm run start:prod
```

The application will start on `http://localhost:3000`

## API Endpoints

### Health Check
- `GET /health` - Check database and Redis connection status

### Users
- `POST /users` - Create a new user
- `GET /users` - Get all users
- `GET /users/:id` - Get a specific user (with caching)
- `PUT /users/:id` - Update a user
- `DELETE /users/:id` - Delete a user

## Example Requests

### Create User
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "name": "John Doe"}'
```

### Get User
```bash
curl http://localhost:3000/users/{user_id}
```

### Health Check
```bash
curl http://localhost:3000/health
```

## Project Structure

```
backend/
├── src/
│   ├── main.ts              # Application entry point
│   ├── app.module.ts        # Root module
│   ├── prisma/              # Prisma configuration
│   │   ├── prisma.service.ts
│   │   └── prisma.module.ts
│   ├── redis/               # Redis configuration
│   │   ├── redis.service.ts
│   │   └── redis.module.ts
│   ├── health/              # Health check endpoints
│   │   ├── health.controller.ts
│   │   └── health.module.ts
│   └── user/                # User module
│       ├── user.controller.ts
│       ├── user.service.ts
│       └── user.module.ts
├── prisma/
│   └── schema.prisma        # Database schema
├── .env                     # Environment variables
├── package.json
└── tsconfig.json
```

## Database Schema

The current schema includes a `User` model:
- `id`: UUID (primary key)
- `email`: String (unique)
- `name`: String (optional)
- `createdAt`: DateTime
- `updatedAt`: DateTime

## Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start in development mode
- `npm run start:prod` - Start in production mode
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run Prisma migrations

## Notes

- The application uses Redis caching for user lookups (1 hour TTL)
- Health check endpoint monitors both database and Redis connections
- TypeScript compilation is required before running the application
- Use `--legacy-peer-deps` flag for npm installations due to dependency conflicts