# Deploying Backend to Northflank

Northflank is a modern container deployment platform perfect for Node.js applications.

## Step 1: Sign Up to Northflank

1. Go to https://northflank.com
2. Create a free account
3. Verify your email

## Step 2: Create a Project

1. Click "Create project"
2. Name it: `RabbitTarot`
3. Select your region (closest to your users)

## Step 3: Connect GitHub Repository

1. In Northflank dashboard, click "Connect source"
2. Choose "GitHub"
3. Authorize Northflank to access your repositories
4. Select your `TarotApp` repository
5. Select branch: `main`

## Step 4: Configure Build Settings

1. **Build context**: `server/`
2. **Dockerfile**: `server/Dockerfile`
3. **Build command**: Leave empty (uses Dockerfile)

## Step 5: Set Environment Variables

In Northflank deployment settings, add:

```
DATABASE_URL=postgresql://neondb_owner:npg_xxxxx@ep-calm-art-apfbw0gk-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=your_random_jwt_secret_key_here
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
PORT=3000
```

## Step 6: Configure Ports

- **Container port**: 3000
- **Published port**: 3000 (or use their auto port)

## Step 7: Deploy

1. Click "Deploy"
2. Wait for build to complete (~5-10 minutes)
3. Get your public URL (e.g., `https://tarot-api-xxx.northflank.com`)

## Step 8: Run Database Migrations

After first deployment:

```bash
cd server
npx prisma migrate deploy
```

Or use Northflank's exec feature:
1. Go to your service
2. Click "Exec"
3. Run: `npx prisma migrate deploy`

## Step 9: Update Frontend API URL

Update your frontend `.env.production`:
```
VITE_API_URL=https://your-northflank-url
```

## Monitoring & Logs

1. View logs in Northflank dashboard
2. Monitor CPU/memory usage
3. Set up alerts if needed

## Scaling

As you grow:
- Increase container replicas
- Add more resources
- Enable auto-scaling

## Cost

- Free tier: 1 project, 1 service, limited resources
- Paid: ~$10-50/month depending on usage

## Troubleshooting

**Build fails**: Check Docker build logs in Northflank UI
**Connection timeout**: Verify DATABASE_URL is correct
**Port already in use**: Container port should be 3000

## Support

- Northflank docs: https://docs.northflank.com
- GitHub issues in your repo
