# Full-Stack Setup Guide - Tarot Reading Portal

## Project Structure

```
Tarot Reading Portal/
├── server/                 # Express.js backend
│   ├── src/
│   │   ├── index.ts       # Express server entry point
│   │   ├── routes/
│   │   │   ├── auth.ts    # Authentication endpoints
│   │   │   ├── readings.ts # Readings CRUD endpoints
│   │   │   └── users.ts   # User profile & preferences
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   ├── .env               # Backend environment variables
│   └── package.json
├── src/                   # React frontend
│   ├── lib/
│   │   └── api-client.ts  # API client utility
│   └── components/
├── .env.local             # Frontend environment variables
└── .github/workflows/     # CI/CD pipelines
```

## Local Development Setup

### Prerequisites
- Node.js 18+ installed
- Docker Desktop installed (for PostgreSQL)

### Step 1: Start PostgreSQL with Docker

```bash
docker run --name tarot_db \
  -e POSTGRES_USER=tarot_user \
  -e POSTGRES_PASSWORD=tarot_password \
  -e POSTGRES_DB=tarot_db \
  -p 5432:5432 \
  -d postgres:16-alpine

# Verify it's running
docker ps | grep tarot_db
```

### Step 2: Setup Backend

```bash
cd server

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start backend server (runs on http://localhost:3000)
npm run dev
```

### Step 3: Setup Frontend

In a new terminal:

```bash
# From project root
npm install

# Start frontend dev server (runs on http://localhost:5173)
npm run dev
```

### Step 4: Test the Setup

1. **API Health Check**: Visit http://localhost:3000/api/health
2. **Frontend**: Visit http://localhost:5173
3. **Prisma Studio**: Run `cd server && npm run prisma:studio` to browse database

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify token validity

### Readings
- `POST /api/readings` - Create new reading
- `GET /api/readings` - Get all user readings
- `GET /api/readings/:id` - Get specific reading
- `PUT /api/readings/:id` - Update reading
- `DELETE /api/readings/:id` - Delete reading

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/preferences` - Get user preferences
- `PUT /api/users/preferences` - Update preferences
- `GET /api/users/stats` - Get reading statistics

## GitHub Secrets Configuration

Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

1. **DATABASE_URL** (Required for production)
   - Format: `postgresql://user:password@host:port/database?schema=public`
   - Example: `postgresql://tarot_user:secure_password@db.example.com:5432/tarot_db?schema=public`

2. **JWT_SECRET** (Required)
   - Generate a random string: `openssl rand -base64 32`
   - Example: `your_random_jwt_secret_key_here`

3. **API_URL** (Optional for production)
   - Example: `https://api.yourdomain.com`

### Setting GitHub Secrets

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with its corresponding value

## Environment Variables Reference

### Frontend (.env.local)
```
VITE_API_URL=http://localhost:3000/api          # Backend API URL
```

### Backend (server/.env)
```
DATABASE_URL="postgresql://..."                 # Database connection string
JWT_SECRET="your_secret_key"                    # JWT signing key
NODE_ENV="development"                          # Environment (development/production)
PORT=3000                                        # Server port
FRONTEND_URL="http://localhost:5173"            # Frontend URL for CORS
```

## Database Migrations

### Create a new migration
```bash
cd server
npm run prisma:migrate
```

When prompted, enter a migration name (e.g., `add_user_roles`)

### View database with Prisma Studio
```bash
cd server
npm run prisma:studio
```

## Production Deployment

### Using Vercel (Frontend) + Railway/Supabase (Backend)

1. **Deploy Frontend**
   - Connect repository to Vercel
   - Set `VITE_API_URL` environment variable pointing to your backend

2. **Deploy Backend**
   - Use Railway.app or Render.com
   - Set `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` environment variables
   - Run `npm run prisma:migrate` in deployment hook

3. **Connect Services**
   - Obtain PostgreSQL connection string from hosting provider
   - Set `DATABASE_URL` in GitHub Secrets
   - Update GitHub Actions to use the secret

## Troubleshooting

### "Command not found: docker"
- Install Docker Desktop from https://www.docker.com/products/docker-desktop

### "Cannot find module '@prisma/client'"
- Run `npm install` in the server directory

### "Connection refused" on port 5432
- Ensure Docker container is running: `docker ps | grep tarot_db`

### "CORS error" when calling API
- Check `FRONTEND_URL` in server `.env` matches your frontend URL

### "Invalid token" errors
- Clear localStorage and login again
- Verify `JWT_SECRET` is the same on backend

## Useful Commands

```bash
# Backend
cd server
npm run dev              # Start dev server
npm run build            # Build for production
npm run prisma:studio    # View database GUI

# Frontend
npm run dev              # Start dev server
npm run build            # Build for production

# Docker
docker ps               # List running containers
docker logs tarot_db    # View PostgreSQL logs
docker stop tarot_db    # Stop container
docker rm tarot_db      # Remove container
```

## Next Steps

1. Create more components to integrate with API
2. Add form validation and error handling
3. Implement real-time features (Socket.io)
4. Add testing (Jest, React Testing Library)
5. Set up monitoring and logging
6. Configure domain and SSL certificate
