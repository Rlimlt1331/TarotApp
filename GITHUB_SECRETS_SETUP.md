# GitHub Secrets Configuration Guide

## What are GitHub Secrets?

GitHub Secrets are encrypted environment variables that you can use in your GitHub Actions workflows. They're perfect for storing sensitive information like database credentials and API keys without exposing them in your code.

## Required Secrets for This Project

### 1. DATABASE_URL
**Purpose**: PostgreSQL connection string for production database

**Format**:
```
postgresql://username:password@host:port/database_name?schema=public
```

**Example**:
```
postgresql://tarot_user:MySecurePassword123@db.railway.internal:5432/railway?schema=public
```

**Where to get it**:
- **Supabase**: Create project → Settings → Database → Connection string (PostgreSQL)
- **Railway**: Create PostgreSQL service → Variables → DATABASE_URL
- **Heroku**: Add PostgreSQL addon → Settings → Config Vars → DATABASE_URL

---

### 2. JWT_SECRET
**Purpose**: Secret key for signing JWT authentication tokens

**How to generate**:
```bash
# On macOS/Linux
openssl rand -base64 32

# On Windows (PowerShell)
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Random -SetSeed 0).ToString())) | ForEach-Object { $_ }

# Or use an online generator
# https://www.random.org/strings/
```

**Example**:
```
aB7xK9mL2qR5sT8vW3yZ4cD6eF9gH1jI2kL5mN8oP1qR4sT7uV
```

---

### 3. API_URL (Optional - for frontend production builds)
**Purpose**: Backend API URL for production frontend

**Example**:
```
https://api.yourdomain.com
```

---

## How to Add Secrets to GitHub

### Step 1: Go to Repository Settings
1. Navigate to your GitHub repository
2. Click **Settings** at the top right

### Step 2: Access Secrets Section
1. In the left sidebar, click **Secrets and variables**
2. Click **Actions**

### Step 3: Create New Secret
1. Click **New repository secret** button
2. Enter the secret **Name** (e.g., `DATABASE_URL`)
3. Enter the secret **Value**
4. Click **Add secret**

### Step 4: Repeat for all secrets
Create secrets for:
- `DATABASE_URL`
- `JWT_SECRET`
- `API_URL` (optional)

---

## Using Secrets in GitHub Actions

The secrets are automatically available in GitHub Actions workflows as environment variables:

```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  API_URL: ${{ secrets.API_URL }}
```

---

## Best Practices

✅ **DO:**
- Use strong, random secrets (min 32 characters)
- Rotate secrets periodically
- Use different secrets for dev/staging/production
- Keep secrets out of version control
- Use `.env.example` with placeholder values

❌ **DON'T:**
- Commit `.env` files to git
- Hardcode secrets in workflow files
- Share secret values in pull requests or issues
- Use simple/predictable secrets

---

## Setting Database on Production Services

### Using Supabase (Recommended)
1. Create free account at https://supabase.com
2. Create new project
3. Go to Settings → Database
4. Copy the connection string (PostgreSQL)
5. Add as `DATABASE_URL` secret

### Using Railway
1. Create account at https://railway.app
2. Create new PostgreSQL database
3. Go to Variables tab
4. Copy `DATABASE_URL`
5. Add as GitHub secret

### Using Render
1. Create account at https://render.com
2. Create PostgreSQL service
3. Copy connection string from Internal URL or External URL
4. Add as `DATABASE_URL` secret

---

## Verifying Secrets are Working

### In GitHub Actions
Secrets appear as `***` in logs for security. You can verify they're set by checking if workflows complete successfully.

### Testing locally
Before deploying, test with `.env` file:
```bash
# Backend
cd server
cat .env
npm run dev
```

---

## Troubleshooting

### "Secret not found" error
- Check secret name matches exactly (case-sensitive)
- Verify it's added to correct repository
- Wait a few seconds after adding secret

### "Connection refused" in workflow
- Verify DATABASE_URL is correct
- Check database service is running
- Try connecting locally first

### "Invalid JWT" errors
- Ensure JWT_SECRET matches between local `.env` and GitHub secret
- Regenerate JWT_SECRET if changed

---

## Support

For issues with specific services:
- **Supabase**: https://supabase.com/docs
- **Railway**: https://docs.railway.app
- **GitHub Secrets**: https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions
