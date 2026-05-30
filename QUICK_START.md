# Quick Start Guide - Tarot Reading Portal Enhancements

## 🚀 5-Minute Setup

### 1. Get Gemini API Key (Optional but Recommended)
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Get API Key"
3. Create a new key or use existing
4. Copy the key

### 2. Configure Environment Variables

**`server/.env`:**
```bash
DATABASE_URL=postgresql://tarot_user:tarot_password@localhost:5432/tarot_db?schema=public
JWT_SECRET=your_super_secret_jwt_key_change_me
GEMINI_API_KEY=your_gemini_api_key_here
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
```

**`.env.local`:**
```bash
VITE_API_URL=http://localhost:3000/api
```

### 3. Setup Database
```bash
cd server
npm install
npm run prisma:migrate
npm run prisma:seed
```

Output should show:
```
✔ Generated Prisma Client
Your database is now in sync with your schema.
Admin user created: rabbit@admin.com
```

### 4. Start Development

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
# Server running on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
npm run dev
# Frontend running on http://localhost:5173
```

---

## 🧪 Testing the Features

### Test 1: Guest to Requester Flow
1. Open http://localhost:5173
2. Click "Request Reading" 
3. Select 3 cards
4. Click "Submit Reading"
5. **Expected**: Prompted to sign up
6. Sign up with: `user@example.com` / `password123` / `Your Name`
7. **Expected**: Redirected to My Readings, reading is saved

### Test 2: Requester Feedback
1. Logged in as requester
2. Go to "My Readings"
3. Click on a reading
4. Scroll to "Your Feedback" section
5. Select 5 stars and add comment: "Accurate reading!"
6. Click "Submit Feedback"
7. **Expected**: Feedback saved, you can update/delete it

### Test 3: Admin Dashboard
1. Open browser's private window (or logout first)
2. Login with: `rabbit@admin.com` / `admin123`
3. **Expected**: "Reader Portal" shows as "Admin Dashboard"
4. **Expected**: See all submissions with user details
5. Click on a submission to see full details
6. **Expected**: View cards, interpretation, and user feedback

### Test 4: Gemini Integration
1. Submit a reading as requester
2. Check the interpretation text
3. **Expected**: If GEMINI_API_KEY is set:
   - Detailed 300-500 word interpretation
   - Mentions each card and its meaning
4. **If API key missing**:
   - Fallback text with basic interpretation

---

## 🔑 Key Test Accounts

### Admin Account (Pre-Created):
- **Email**: `rabbit@admin.com`
- **Password**: `admin123`
- **Can**: View all submissions, see feedback, manage readings

### Create Requester Account:
1. Click "Login" button
2. Click "Sign up"
3. Enter email, password, name
4. Submit
5. **Can**: Submit readings, provide feedback, view history

---

## 🐛 Troubleshooting

### Port Already in Use:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Database Connection Error:
1. Ensure PostgreSQL is running
2. Check `DATABASE_URL` in `server/.env`
3. Run migrations again: `npm run prisma:migrate`

### "No API key provided" Error:
- This is expected if `GEMINI_API_KEY` is not set
- App uses fallback interpretation text
- To enable: Add key to `server/.env` and restart backend

### Can't Login:
1. Check browser DevTools > Application > Storage
2. Verify token is saved in localStorage
3. Try clearing storage and logging in again
4. Check backend is running: http://localhost:3000/api/health

### Can't See Feedback Stars:
- Check if Lucide icons are loading
- Refresh page (Ctrl+Shift+R)
- Check browser console for errors

---

## 📋 Verification Checklist

Before going to production:

- [ ] GEMINI_API_KEY is set in `server/.env`
- [ ] JWT_SECRET is changed from default
- [ ] DATABASE_URL points to production database
- [ ] Admin password changed (login & update profile)
- [ ] FRONTEND_URL set correctly in `server/.env`
- [ ] Both frontend and backend build successfully
- [ ] Test login/signup flow works
- [ ] Test feedback submission works
- [ ] Test admin dashboard loads submissions
- [ ] SSL/TLS certificates configured (if needed)

---

## 📚 Documentation

- **Full Features**: See `AUTH_FEATURES.md`
- **Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`
- **API Reference**: See section 4 in `AUTH_FEATURES.md`

---

## 💡 Pro Tips

1. **Development**:
   - Use `npm run prisma:studio` to view database GUI
   - Check `/api/health` to verify backend is running
   - Use browser DevTools Network tab to debug API calls

2. **Admin Account**:
   - Use `npm run prisma:studio` to edit admin password
   - First login: Change password immediately
   - Can create more admins by updating role field

3. **Testing Feedback**:
   - Create multiple test accounts
   - Each account can only provide one feedback per reading
   - Feedback updates on submit, not on create

4. **Gemini API**:
   - Rate limits: Free tier allows ~60 requests/minute
   - Response time: ~2-5 seconds per reading
   - Monitor usage at [Google AI Studio](https://makersuite.google.com/app/dashboard)

---

## 🆘 Getting Help

### Common Issues:

**"Cannot find module '@google/generative-ai'"**
- Solution: Run `cd server && npm install`

**"Prisma client not generated"**
- Solution: Run `npm run prisma:generate`

**Token not persisting**
- Solution: Check localStorage is not disabled
- Try private window to test

**Admin endpoint returns 403**
- Solution: Verify user's role is 'admin' in database

---

## 🎉 You're All Set!

Your Tarot Reading Portal now has:
- ✅ User authentication (signup/login)
- ✅ Role-based access control
- ✅ Feedback system with ratings
- ✅ AI-powered reading interpretations
- ✅ Admin dashboard for submissions
- ✅ Persistent reading history
- ✅ Secure JWT-based auth

**Start the app and enjoy!** 🔮✨
