# Tarot Reading Portal - Authentication & Enhanced Features

## 🎉 New Features Implemented

### 1. **User Authentication System**
- Email/password signup and login
- JWT token-based authentication
- Role-based access control (Requester vs Admin)
- Auth state persistence (localStorage)
- Protected routes

#### Login Flow:
1. Guest users can browse the app without logging in
2. When submitting a reading, users are prompted to sign up/login
3. After authentication, readings are saved to "My Readings"
4. Login token is stored in localStorage and auto-verified on app load

#### Default Admin Account:
- **Email**: `rabbit@admin.com`
- **Password**: `admin123` (change on first login)
- **Role**: Admin

### 2. **Role-Based Access Control**

#### **Requester Role**
- Can browse and request tarot readings
- Can access "My Readings" page
- Can provide feedback (ratings + comments) on their readings
- Cannot access the Reader/Admin portal

#### **Admin Role**
- Access to "Admin Dashboard" instead of "Reader Portal"
- View all submitted readings with user details
- View aggregated user feedback and ratings
- Monitor reading accuracy feedback

### 3. **Reading History & Feedback System**

#### My Readings Page (Requesters):
- View all their past readings with timestamps
- See cards used and AI-generated interpretation
- Provide accuracy feedback:
  - **Star Rating**: 1-5 stars
  - **Comments**: Detailed feedback about reading accuracy
- View/edit/delete their own feedback
- Each reading is persistent in the database

#### Admin Dashboard:
- View all submissions from requesters
- See user information (name, email)
- View card selections and interpretations
- See all feedback from users
- Click on any reading to view details

### 4. **AI-Powered Reading Interpretations**

#### Gemini Integration:
- Uses Google Generative AI (Gemini) to create detailed tarot interpretations
- Generates comprehensive 300-500 word readings based on:
  - Card names
  - Card positions
  - Card meanings
- Fallback placeholder text if API key is not configured
- Async processing for smooth UX

#### Environment Setup:
```bash
# Add to server/.env
GEMINI_API_KEY=your_gemini_api_key
```

---

## 🛠️ Technical Implementation

### Database Changes

#### New Models:
```prisma
enum UserRole {
  requester
  admin
}

// Added to User model:
role UserRole @default(requester)

// New Feedback model:
model Feedback {
  id        Int     @id @default(autoincrement())
  readingId Int
  reading   Reading @relation(fields: [readingId], references: [id], onDelete: Cascade)
  userId    Int
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  rating    Int     // 1-5 star rating
  comment   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([readingId, userId])
}
```

### Backend Endpoints

#### Authentication:
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/verify` - Verify token (now includes role)

#### Readings:
- `POST /api/readings` - Create reading (now with Gemini interpretation)
- `GET /api/readings` - Get user's readings
- `GET /api/readings/:id` - Get single reading
- `PUT /api/readings/:id` - Update reading
- `DELETE /api/readings/:id` - Delete reading

#### Feedback (New):
- `POST /api/readings/:id/feedback` - Create/update feedback
- `GET /api/readings/:id/feedback` - Get feedback for reading
- `DELETE /api/readings/:id/feedback` - Delete feedback

#### Admin (New):
- `GET /api/readings/admin/submissions` - Get all submissions (admin only)

### Frontend Components

#### New Components:
- **AuthContext** (`src/app/context/AuthContext.tsx`): Auth state management
- **AuthModal** (`src/app/components/AuthModal.tsx`): Login/signup modal
- **ProtectedRoutes** (`src/app/components/ProtectedRoutes.tsx`): PrivateRoute & AdminRoute guards
- **ReadingFeedback** (`src/app/components/ReadingFeedback.tsx`): Feedback UI with star rating
- **AdminDashboard** (`src/app/components/AdminDashboard.tsx`): Admin submission viewer

#### Updated Components:
- **Navigation** (`src/app/components/Navigation.tsx`):
  - Shows login button for guests
  - Shows user menu for authenticated users
  - Conditionally shows "My Readings" tab
  - Conditionally shows "Reader Portal" tab for admins
  - Logout functionality

- **App** (`src/app/App.tsx`):
  - Wrapped with AuthProvider
  - Protected routes with PrivateRoute/AdminRoute
  - Route guards redirect non-authenticated to login

- **ReaderPortal** (`src/app/components/ReaderPortal.tsx`):
  - Checks user role
  - Shows AdminDashboard for admin users
  - Shows traditional reader portal for others

---

## 🚀 Getting Started

### 1. Environment Setup

**Backend (`server/.env`):**
```
DATABASE_URL=postgresql://user:password@host:5432/db
JWT_SECRET=your_super_secret_key
GEMINI_API_KEY=your_gemini_api_key  # Required for AI interpretations
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
```

**Frontend (`.env.local`):**
```
VITE_API_URL=http://localhost:3000/api
```

### 2. Database Setup

```bash
cd server
npm install
npm run prisma:migrate
npm run prisma:seed
```

### 3. Start the App

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
# Backend runs on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
npm run dev
# Frontend runs on http://localhost:5173
```

### 4. Testing the Features

#### As a Guest:
1. Navigate to http://localhost:5173
2. Go to "Request Reading"
3. Select cards and submit
4. System prompts "Login" - click and create account
5. Reading is saved

#### As a Requester:
1. Login with your credentials
2. Go to "My Readings"
3. View past readings
4. Click on a reading to see details
5. Provide star rating and feedback
6. View/edit feedback

#### As an Admin:
1. Login with `rabbit@admin.com` / `admin123`
2. Navigate to "Reader Portal" (becomes "Admin Dashboard")
3. View all user submissions
4. Click on submissions to see details
5. View user feedback and ratings

---

## 🔒 Security Features

- Passwords hashed with bcryptjs (10 salt rounds)
- JWT tokens expire in 7 days
- Protected routes require valid token
- Admin endpoints require admin role
- Feedback is isolated per user/reading combo
- CORS configured for frontend URL

---

## 📊 Database Schema

### Users Table:
- Stores email, hashed password, name, role
- One-to-many with readings and feedbacks

### Readings Table:
- Stores userId, title, AI-generated interpretation
- One-to-many with cards and feedbacks
- Links to user who submitted

### Cards Table:
- Stores card name, position, meaning
- Links to reading

### Feedbacks Table:
- Stores userId, readingId, rating (1-5), comment
- Unique constraint on (readingId, userId) pair
- Allows only one feedback per user per reading

---

## 🎯 Next Steps / Future Enhancements

1. **Password Reset**: Add forgot password functionality
2. **Email Verification**: Verify email on signup
3. **Reading Statistics**: Show accuracy trends for users
4. **Admin Reports**: Generate reports on feedback patterns
5. **Payment Integration**: Monetize premium readings
6. **Social Sharing**: Allow users to share readings
7. **Reading Categories**: Organize readings by type
8. **Advanced Search**: Filter readings by date, rating, etc.

---

## 🐛 Troubleshooting

### Can't login as admin:
- Verify `rabbit@admin.com` exists in database: `npm run prisma:studio`
- Check database is up and migrations ran

### Readings don't get Gemini interpretation:
- Verify `GEMINI_API_KEY` is set in `server/.env`
- Check Gemini API quota/permissions
- App falls back to placeholder text if API fails

### "No token provided" error:
- Ensure token is saved in localStorage after login
- Check browser DevTools > Application > Storage
- Try logging out and back in

### Routes not protected:
- Verify AuthProvider wraps app in `App.tsx`
- Check PrivateRoute/AdminRoute components are used correctly
- Verify role is being set correctly in auth responses

---

## 📚 API Reference

All endpoints except login/signup require:
```
Authorization: Bearer {token}
```

### Response Format:

**Success (200/201):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "User Name",
  "role": "requester",
  "token": "eyJ..."
}
```

**Error (400/401/403/500):**
```json
{
  "error": "Error message explaining what went wrong"
}
```

---

## 🎓 Learning Resources

- [JWT Authentication](https://jwt.io/)
- [Prisma ORM](https://www.prisma.io/docs/)
- [Google Generative AI](https://ai.google.dev/)
- [React Context API](https://react.dev/reference/react/useContext)
- [React Router v7](https://reactrouter.com/start/library)
