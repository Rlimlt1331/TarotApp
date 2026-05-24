# Tarot Reading Portal 🃏

A full-stack web application for tarot card readings with user authentication, reading history, and personalized preferences.

## Features

✨ **Frontend**
- Beautiful, responsive React UI with Tailwind CSS
- Interactive tarot card selection
- Reading history and interpretation storage
- User authentication and profiles
- Dark/light theme support

🔧 **Backend**
- Express.js REST API
- PostgreSQL database with Prisma ORM
- JWT authentication
- User management and preferences
- Reading history persistence

## Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Shadcn/ui** - Component library
- **React Router** - Navigation

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **Prisma** - ORM
- **PostgreSQL** - Database
- **JWT** - Authentication

## Quick Start

### Prerequisites
- Node.js 18+
- Docker Desktop (for PostgreSQL)

### One-Command Setup
```bash
./setup.sh
```

Or manual setup:

**1. Start PostgreSQL**
```bash
docker run --name tarot_db \
  -e POSTGRES_USER=tarot_user \
  -e POSTGRES_PASSWORD=tarot_password \
  -e POSTGRES_DB=tarot_db \
  -p 5432:5432 \
  -d postgres:16-alpine
```

**2. Backend Setup**
```bash
cd server
npm install
npm run prisma:migrate
npm run dev
# Backend runs on http://localhost:3000
```

**3. Frontend Setup** (new terminal)
```bash
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

## Project Structure

```
├── server/                 # Backend (Express + Prisma)
│   ├── src/
│   │   ├── index.ts       # Server entry point
│   │   ├── routes/
│   │   │   ├── auth.ts    # Auth endpoints
│   │   │   ├── readings.ts # Reading CRUD
│   │   │   └── users.ts   # User endpoints
│   │   └── middleware/
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   └── package.json
│
├── src/                   # Frontend (React)
│   ├── app/
│   ├── components/
│   ├── lib/
│   │   └── api-client.ts  # API integration
│   └── styles/
│
├── .github/workflows/     # CI/CD
├── FULLSTACK_SETUP.md     # Detailed setup guide
└── GITHUB_SECRETS_SETUP.md# GitHub secrets guide
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/verify` - Verify token

### Readings
- `POST /api/readings` - Create reading
- `GET /api/readings` - Get all readings
- `GET /api/readings/:id` - Get reading
- `PUT /api/readings/:id` - Update reading
- `DELETE /api/readings/:id` - Delete reading

### Users
- `GET /api/users/profile` - Get profile
- `PUT /api/users/profile` - Update profile
- `GET /api/users/preferences` - Get preferences
- `PUT /api/users/preferences` - Update preferences
- `GET /api/users/stats` - Get statistics

## Development

### Environment Variables

**Frontend (.env.local)**
```
VITE_API_URL=http://localhost:3000/api
```

**Backend (server/.env)**
```
DATABASE_URL=postgresql://tarot_user:tarot_password@localhost:5432/tarot_db?schema=public
JWT_SECRET=your_secret_key_here
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
```

### Database Management

```bash
cd server

# Run migrations
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate

# Open Prisma Studio (GUI)
npm run prisma:studio

# Reset database (development only)
npx prisma migrate reset
```

### Building for Production

**Frontend**
```bash
npm run build
npm run preview  # Test production build locally
```

**Backend**
```bash
cd server
npm run build
npm start
```

## Deployment

### GitHub Secrets Required
Add these to your GitHub repository:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing key
- `API_URL` - Backend URL (optional)

See [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) for detailed instructions.

### Deployment Platforms

**Frontend**: Vercel, Netlify, GitHub Pages
**Backend**: Railway, Render, Heroku
**Database**: Supabase, Railway, Heroku Postgres

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## Troubleshooting

**Can't connect to database**
- Verify Docker container is running: `docker ps | grep tarot_db`
- Check DATABASE_URL format
- Ensure port 5432 is not blocked

**"Cannot find module" errors**
- Run `npm install` in the appropriate directory
- Delete `node_modules` and `package-lock.json`, then reinstall

**API CORS errors**
- Verify `FRONTEND_URL` in backend `.env`
- Check backend is running on correct port

**JWT/Auth errors**
- Ensure `JWT_SECRET` is set correctly
- Clear browser localStorage: `localStorage.clear()`
- Login again

## Documentation

- [Full Stack Setup Guide](./FULLSTACK_SETUP.md) - Detailed local development setup
- [GitHub Secrets Configuration](./GITHUB_SECRETS_SETUP.md) - Production environment setup
- [API Documentation](./server/API.md) - Detailed API reference

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues and questions:
- Check [FULLSTACK_SETUP.md](./FULLSTACK_SETUP.md) troubleshooting section
- Open an issue on GitHub
- Check existing issues for similar problems

---

**Happy reading! 🔮✨**
