# Deployment Checklist - Tarot Reading Portal

## Pre-Deployment Verification

### 🔧 Code Quality
- [x] Frontend builds without errors
- [x] Backend builds without errors
- [x] No TypeScript compilation errors
- [x] All imports resolve correctly
- [x] No console errors in development

### 📦 Dependencies
- [x] @google/generative-ai installed
- [x] prisma installed and schema updated
- [x] react-router-dom v7 configured
- [x] All UI components available (dialog, button, input, etc.)

### 🗄️ Database
- [x] Schema includes role enum
- [x] Feedback model created
- [x] Migration applied successfully
- [x] Admin account seeded
- [x] Unique constraint on (readingId, userId) set

### 🔐 Security
- [x] Passwords hashed with bcryptjs
- [x] JWT_SECRET configured
- [x] JWT expiration set to 7 days
- [x] Admin middleware created
- [x] CORS configured for frontend URL
- [x] Protected routes implemented
- [x] Admin routes implemented

### 🎨 Frontend Components
- [x] AuthContext provides user state
- [x] AuthModal handles signup/login
- [x] ProtectedRoutes guard authenticated pages
- [x] AdminRoute guards admin pages
- [x] Navigation shows conditional items by role
- [x] ReadingFeedback component built
- [x] AdminDashboard component built
- [x] ReaderPortal uses AdminDashboard for admins

### 🔌 Backend Endpoints
- [x] POST /api/auth/signup (with role)
- [x] POST /api/auth/login (with role)
- [x] GET /api/auth/verify (with role)
- [x] POST /api/readings (with Gemini integration)
- [x] GET /api/readings (with feedbacks)
- [x] GET /api/readings/:id (with feedbacks)
- [x] PUT /api/readings/:id
- [x] DELETE /api/readings/:id
- [x] POST /api/readings/:id/feedback
- [x] GET /api/readings/:id/feedback
- [x] DELETE /api/readings/:id/feedback
- [x] GET /api/readings/admin/submissions

### 📝 Documentation
- [x] QUICK_START.md created
- [x] AUTH_FEATURES.md created
- [x] IMPLEMENTATION_SUMMARY.md created
- [x] API endpoints documented
- [x] Setup instructions provided
- [x] Troubleshooting guide included

---

## Pre-Launch Checklist

### Environment Variables
- [ ] `GEMINI_API_KEY` set in `server/.env`
- [ ] `JWT_SECRET` changed from default
- [ ] `DATABASE_URL` points to production database
- [ ] `FRONTEND_URL` set correctly in `server/.env`
- [ ] `VITE_API_URL` set in `.env.local`
- [ ] All variables reviewed and secured

### Database Setup
- [ ] Production database created
- [ ] Migrations run: `npm run prisma:migrate`
- [ ] Admin account seeded: `npm run prisma:seed`
- [ ] Admin password changed from default
- [ ] Database backups configured

### Testing
- [ ] Guest can browse readings
- [ ] Guest can select cards
- [ ] Guest is prompted to signup when submitting
- [ ] Requester can signup with email/password
- [ ] Requester can login with credentials
- [ ] Requester can view "My Readings"
- [ ] Requester can provide star rating feedback
- [ ] Requester can add feedback comments
- [ ] Requester can update feedback
- [ ] Requester can delete feedback
- [ ] Requester cannot access admin features
- [ ] Admin can login with rabbit@admin.com
- [ ] Admin sees "Admin Dashboard" instead of "Reader Portal"
- [ ] Admin can view all user submissions
- [ ] Admin can click on submissions to view details
- [ ] Admin can see user feedback and ratings
- [ ] Readings have Gemini interpretations (or fallback text)
- [ ] Token persists across page reloads
- [ ] Logout clears token and redirects
- [ ] Protected routes redirect to login when needed

### Performance
- [ ] Frontend bundle size optimized (<500KB gzipped)
- [ ] Backend API responds in <500ms
- [ ] Gemini API calls have reasonable timeout
- [ ] Database queries are indexed
- [ ] No N+1 query problems

### Deployment
- [ ] Docker image built (if using containers)
- [ ] Environment variables in CI/CD secrets
- [ ] Database connection pooling configured
- [ ] API rate limiting enabled
- [ ] Error logging configured
- [ ] Health check endpoint tested
- [ ] SSL/TLS certificates configured
- [ ] CORS headers verified

### Production Hardening
- [ ] JWT secret is strong (>32 characters)
- [ ] Admin password changed immediately after seed
- [ ] Sensitive logs don't contain tokens/passwords
- [ ] Error messages don't expose system details
- [ ] Database doesn't allow SQL injection
- [ ] XSS protection enabled (React by default)
- [ ] CSRF protection configured
- [ ] Rate limiting on auth endpoints
- [ ] Input validation on all endpoints

---

## Post-Launch Verification

- [ ] Health check endpoint responds
- [ ] Login flow works end-to-end
- [ ] Feedback system saves to database
- [ ] Admin dashboard loads submissions
- [ ] Gemini API generates readings
- [ ] Error handling works gracefully
- [ ] All logs are clean (no warnings)
- [ ] Monitoring/alerts configured
- [ ] Backup procedures verified

---

## Rollback Plan

If issues arise:

1. **Database Issue**
   - Revert to last migration backup
   - Run: `npm run prisma:migrate:resolve --rolled-back <migration_name>`

2. **Code Issue**
   - Revert to previous git commit
   - Rebuild and redeploy

3. **Admin Access Lost**
   - Access database directly and update admin user role
   - Or reseed the database if in test environment

4. **API Issues**
   - Check GEMINI_API_KEY is valid
   - Verify DATABASE_URL connection
   - Check JWT_SECRET hasn't changed
   - Review error logs for specifics

---

## Maintenance Tasks

### Weekly
- [ ] Check API error logs
- [ ] Monitor database size/performance
- [ ] Review user feedback for patterns
- [ ] Check Gemini API quota usage

### Monthly
- [ ] Update dependencies
- [ ] Review security advisories
- [ ] Backup database
- [ ] Test backup restoration
- [ ] Review user feedback trends

### Quarterly
- [ ] Security audit
- [ ] Performance optimization
- [ ] Update documentation
- [ ] Review and clean logs

---

## Support Information

### Documentation Locations
- Feature Docs: `AUTH_FEATURES.md`
- Setup Guide: `QUICK_START.md`
- Technical Details: `IMPLEMENTATION_SUMMARY.md`
- This File: `DEPLOYMENT_CHECKLIST.md`

### Key Files to Monitor
- `server/.env` - Environment secrets
- `server/prisma/schema.prisma` - Database schema
- `src/app/context/AuthContext.tsx` - Auth logic
- `server/src/services/geminiService.ts` - AI integration

### Common Issues & Solutions

**"Invalid token" error**
- Verify JWT_SECRET matches between sessions
- Check token expiration (7 days)

**"Permission denied" on admin endpoints**
- Verify user role is 'admin' in database
- Check verifyAdmin middleware is applied

**Feedback not saving**
- Verify Feedback table exists in database
- Check unique constraint on (readingId, userId)

**Gemini API failing**
- Verify GEMINI_API_KEY is valid
- Check API quota hasn't been exceeded
- Review error logs for rate limiting

---

## Sign-Off

- [ ] Technical Lead: ____________________ Date: ______
- [ ] QA Lead: ____________________ Date: ______
- [ ] DevOps/Deployment: ____________________ Date: ______
- [ ] Product Owner: ____________________ Date: ______

---

**Last Updated**: Today
**Version**: 1.0
**Status**: Ready for Launch ✅
