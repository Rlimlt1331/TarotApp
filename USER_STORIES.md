# Mystic Tarot Portal — User Stories & Acceptance Criteria

> **Audience:** Product, QA, and the external code reviewer.
> **Scope:** All implemented features as of the current codebase. Each story is written from the perspective of the person performing the action.

---

## 1. Authentication

### US-1.1 — Email Sign-Up

**As a** new visitor,  
**I want to** create an account with my name, email, and password,  
**so that** I can submit reading requests and track my history.

**Acceptance Criteria**

- [ ] Sign-up form requires name, email, and password.
- [ ] Successful submission returns a JWT and the modal closes.
- [ ] Duplicate email returns an error; the form remains open.
- [ ] Password is never returned in any API response.

---

### US-1.2 — Email Login

**As a** returning user,  
**I want to** log in with my email and password,  
**so that** I can access my account and reading history.

**Acceptance Criteria**

- [ ] Correct credentials return a JWT and close the modal.
- [ ] Wrong password returns a 401 error with a clear message.
- [ ] The auth endpoint is rate-limited to 5 attempts per 15-minute window per IP.

---

### US-1.3 — Telegram Passwordless Login

**As a** user with a Telegram account,  
**I want to** log in via Telegram without a password,  
**so that** I can access the portal quickly.

**Acceptance Criteria**

- [ ] Clicking "Continue with Telegram" shows a 3-step pending state with an "Open Telegram Bot" link and an "I've opened the bot" verify button.
- [ ] Clicking the bot deep-link and sending `/start` completes the login on the next verify poll.
- [ ] If the Telegram bot is not configured (env var absent), an amber warning card is shown and a fallback "Sign up or log in with email" link appears.
- [ ] If the user has not yet opened the bot, the verify button shows a toast error (does not crash).
- [ ] A "Don't have Telegram?" section with a download link and email fallback is visible during the pending state.
- [ ] The "Sign up with email instead" button resets the modal to the idle state.
- [ ] A request token that has expired or does not exist returns HTTP 410 from `GET /telegram/login-status`.

---

### US-1.4 — Role-Based Redirect

**As a** logged-in user,  
**I want** the app to redirect me to the correct portal based on my role,  
**so that** I land on the right page without extra navigation.

**Acceptance Criteria**

- [ ] Regular users (requester role) are redirected to `/request`.
- [ ] Admin and reader users are redirected to `/reader`.
- [ ] Navigating to `/reader` as a requester redirects to `/request`.
- [ ] All protected routes redirect to the request page (or show the auth modal) when unauthenticated.

---

## 2. Reading Request (Requester Portal)

### US-2.1 — Submit a Free Reading

**As a** first-time requester,  
**I want to** submit a reading question at no cost,  
**so that** I can try the service before purchasing gems.

**Acceptance Criteria**

- [ ] The request form shows a "First Reading Free" badge for users who have not yet used their free reading.
- [ ] The submit button reads "Submit Free Reading Request" when eligible.
- [ ] Submitting a valid form (horoscope, gender, question) creates a submission with `isFreeReading: true` and HTTP 201.
- [ ] After submission, `freeReadingUsed` is `true` in the gems balance response.
- [ ] The gem balance includes a `free_reading` transaction entry.

---

### US-2.2 — Submit a Paid Reading

**As a** returning requester with gems,  
**I want to** submit a reading using gems from my balance,  
**so that** I can continue receiving readings after my free one.

**Acceptance Criteria**

- [ ] A valid submission deducts the correct gem cost from the user's balance atomically.
- [ ] A reading cannot be submitted if the user has 0 gems and has used their free reading — the API returns HTTP 402 with a gem-related error message.
- [ ] The error response includes the current `gemBalance`.

---

### US-2.3 — Pending-Payment Submission

**As a** requester without gems,  
**I want to** queue a reading submission while my payment is being confirmed,  
**so that** I don't lose my place after transferring payment.

**Acceptance Criteria**

- [ ] Submitting with 0 gems (and free reading used) creates a submission with `pendingPayment: true`; gems are NOT deducted at this point.
- [ ] Only one pending-payment submission is allowed at a time; a second attempt returns HTTP 409.
- [ ] The My Readings page shows a "Pending payment confirmation" badge on the pending submission.
- [ ] When admin credits gems for the pending purchase, gems are deducted and `pendingPayment` is cleared.

---

### US-2.4 — Form Draft Persistence

**As a** requester who navigates away mid-form,  
**I want** my form answers to be saved temporarily,  
**so that** I don't have to re-enter my details when I come back.

**Acceptance Criteria**

- [ ] Horoscope, gender, category, and custom question are saved to `sessionStorage` as the user types.
- [ ] Navigating to another route and returning to `/request` restores the saved values.
- [ ] Draft is cleared after a successful submission.

---

## 3. Tarot Gems

### US-3.1 — Gem Balance in Navigation

**As a** logged-in requester,  
**I want to** see my gem balance in the navigation bar,  
**so that** I always know if I have enough gems for a reading.

**Acceptance Criteria**

- [ ] The nav bar shows a gem pill with the current balance.
- [ ] New users see "Free reading available" in the pill until their free reading is used.
- [ ] The pill is not shown for admin users.
- [ ] Clicking the pill opens the gem purchase modal.

---

### US-3.2 — Purchase Gems (Pack Selection)

**As a** requester who needs more gems,  
**I want to** buy a gem pack via PayNow,  
**so that** I can continue submitting reading requests.

**Acceptance Criteria**

- [ ] The gem purchase modal displays exactly 4 packs.
- [ ] One pack is marked "Most Popular".
- [ ] Each pack shows the SGD price, gem count, and a bonus description.
- [ ] Selecting a pack advances to the PayNow payment step.
- [ ] The PayNow step shows the correct QR code image and the SGD amount to transfer.
- [ ] Step 3 of the payment instructions says to use the name shown in the user's app profile as the payment reference.
- [ ] A support email note is shown below the instructions linking to tarotcafe.online@outlook.com.
- [ ] A "Back" button returns to the pack selection step.
- [ ] Clicking "Done — I've paid" sends a Telegram notification to the admin and closes the modal.
- [ ] `POST /gems/purchase-request` with a valid `packId` returns HTTP 200 with a `pendingId`.
- [ ] `POST /gems/payment-confirm` (authenticated) returns HTTP 200 after notifying the admin.
- [ ] An invalid `packId` returns HTTP 400.

---

### US-3.3 — Admin Credits Gems

**As an** admin,  
**I want to** confirm a PayNow payment and credit gems to the user,  
**so that** the user can proceed with their reading.

**Acceptance Criteria**

- [ ] `GET /gems/admin/pending` (admin only) returns two types of entries: users with an active purchase request (`hasPurchaseRequest: true`) and users whose submission has `pendingPayment: true` but who have not yet selected a pack (`hasPurchaseRequest: false`).
- [ ] Entries with `hasPurchaseRequest: true` include pack info; entries with `hasPurchaseRequest: false` have `pack: null` and show an "No pack selected yet" badge in the UI.
- [ ] `POST /gems/admin/credit` with a valid `userId`, `packId`, and optional `pendingId` increases the user's gem balance by the pack amount and clears the pending transaction.
- [ ] Non-admin access to admin endpoints returns HTTP 401 or 403.
- [ ] After crediting, `hasPendingPurchase` is `false` in the balance response.

---

### US-3.4 — 5-Star Rating Gem Bonus

**As a** requester who rates a completed reading 5 stars,  
**I want to** receive a gem bonus,  
**so that** I am rewarded for providing feedback.

**Acceptance Criteria**

- [ ] Submitting a 5-star rating on a completed reading returns `gemBonusAwarded: true` and a positive `bonusAmount`.
- [ ] Updating the rating again (re-submitting feedback) does not award the bonus a second time.

---

### US-3.5 — Gem Transaction History

**As a** requester,  
**I want to** view my gem transaction history,  
**so that** I can track my purchases, readings, and bonuses.

**Acceptance Criteria**

- [ ] The `/gem-history` route loads without errors.
- [ ] The page displays a "Gem History" heading.
- [ ] New users without transactions see an empty-state message.
- [ ] Users with transactions see a list of entries with type, amount, and date.

---

## 4. Admin — Reading Portal

### US-4.0 — Multi-Reader Management

**As an** admin,  
**I want to** add multiple readers and assign submissions to them,  
**so that** reading work can be distributed across a team.

**Acceptance Criteria**

- [ ] `GET /users/admin/readers` returns all users with the reader role.
- [ ] `POST /users/admin/readers` with name, email, and password creates a new reader account.
- [ ] If the email belongs to an existing requester, the account is promoted to reader (name and password updated); response includes `promoted: true`.
- [ ] If the email belongs to an existing admin or reader, the request is rejected with HTTP 400.
- [ ] `DELETE /users/admin/readers/:id` demotes the reader to requester and unassigns their pending (unread) submissions.
- [ ] `PUT /submissions/admin/:id/assign` (admin only) sets or clears `assignedReaderId` on a submission.
- [ ] Assigning a non-reader/non-admin user ID returns HTTP 400.
- [ ] Reader users can access `GET /submissions/admin/all` and see only unassigned submissions plus their own assigned submissions.
- [ ] Reader users cannot access admin-only endpoints (`/gems/admin/pending`, `/users/admin/readers`).
- [ ] The Readers tab and Payment Verification tab in the admin dashboard are only visible to admin users, not reader users.

---

### US-4.1 — View All Submissions

**As an** admin or reader,  
**I want to** see relevant submissions in the reader portal,  
**so that** I can process them.

**Acceptance Criteria**

- [ ] `GET /submissions/admin/all` returns all submissions with user info and `assignedReader` details.
- [ ] Admin sees all submissions; reader sees only unassigned or assigned-to-them submissions.
- [ ] Non-admin/non-reader users receive HTTP 401 or 403.
- [ ] The admin portal at `/reader` renders `AdminDashboard` directly (no intermediary `ReaderPortal` component).

---

### US-4.2 — Detect Cards from Image

**As an** admin,  
**I want to** upload a photo of the tarot spread and have the AI identify the cards,  
**so that** I can confirm which cards are in the spread.

**Acceptance Criteria**

- [ ] `POST /submissions/admin/:id/detect-cards` with a base64 `spreadImage` returns detected card names and orientations.
- [ ] Omitting `spreadImage` returns HTTP 400.
- [ ] Non-admin access returns HTTP 401 or 403.

---

### US-4.3 — Generate AI Reading

**As an** admin,  
**I want to** generate a tarot + horoscope + harmonised reading using AI,  
**so that** I can review it before saving it to the user.

**Acceptance Criteria**

- [ ] `POST /submissions/admin/:id/generate` with `confirmedCards` (array of `{name, orientation}`) returns `tarotReading`, `horoscopeReading`, and `harmonizedReading` strings.
- [ ] The two confirmed cards' orientations are preserved in `detectedCards`.
- [ ] Readings contain no markdown formatting (`**`, `*`, `#`, `-`) — all AI output is stripped to plain text.

---

### US-4.4 — Save Reading

**As an** admin,  
**I want to** save the finalised reading to the database,  
**so that** the requester can view their completed reading.

**Acceptance Criteria**

- [ ] `PUT /submissions/admin/:id` with reading text and detected cards returns HTTP 200 and the saved reading object.
- [ ] The reading is retrievable by the requester via `GET /submissions`.
- [ ] After save, Telegram notification is sent to the requester if they have Telegram linked.

---

## 5. My Readings

### US-5.1 — View Reading History

**As a** requester,  
**I want to** see all my submitted readings and their status,  
**so that** I can track progress and view completed readings.

**Acceptance Criteria**

- [ ] `GET /submissions` returns the authenticated user's submissions.
- [ ] Unauthenticated requests return HTTP 401 or 403.
- [ ] Each submission shows the question, category, date, and status (pending / completed / pending payment).
- [ ] Completed submissions show a card list and a "View Full Reading" button.
- [ ] The My Readings page does NOT show a Telegram Notifications card (that moved to Account Settings).

---

### US-5.2 — Submit and Update Feedback

**As a** requester with a completed reading,  
**I want to** rate my reading and leave a comment,  
**so that** I can share feedback and potentially earn a gem bonus.

**Acceptance Criteria**

- [ ] `POST /submissions/:id/feedback` with `rating` (1–5) and optional `comment` creates or updates feedback.
- [ ] Ratings above 5 return HTTP 400.
- [ ] `GET /submissions/:id/feedback` returns the saved rating and comment.
- [ ] `DELETE /submissions/:id/feedback` removes feedback; subsequent GET returns null.

---

## 6. Telegram Integration

### US-6.1 — Link Telegram Account

**As a** logged-in email user,  
**I want to** link my Telegram account from Account Settings,  
**so that** I can receive notifications and use Telegram login in the future.

**Acceptance Criteria**

- [ ] Account Settings shows a "Telegram Notifications" card.
- [ ] Unlinked users see a "Link Telegram" button.
- [ ] Clicking it shows the bot deep-link and an "I've verified" button.
- [ ] After opening the bot and sending `/start`, clicking verify shows a success toast.
- [ ] If not yet confirmed, the verify button shows an error toast (does not crash).
- [ ] `GET /telegram/status` returns `{ linked: false, notifyMode: null }` for unlinked users.

---

### US-6.2 — Telegram Notification Preference

**As a** Telegram-linked user,  
**I want to** choose how I receive reading notifications,  
**so that** I get updates in the format I prefer.

**Acceptance Criteria**

- [ ] The preference can be set to `notify` (Telegram sends a short alert) or `deliver` (Telegram sends the full reading inline).
- [ ] `PUT /telegram/preferences` with a valid `notifyMode` returns HTTP 200 and saves to the `user_preferences` table (not the `users` table).
- [ ] An invalid `notifyMode` value returns HTTP 400.
- [ ] The preference can be updated (upsert behaviour).
- [ ] `GET /telegram/status` returns the current `notifyMode`.

---

### US-6.3 — Reading Delivered via Telegram

**As a** requester in `deliver` mode,  
**I want to** receive my full reading in Telegram when it's ready,  
**so that** I don't have to open the portal.

**Acceptance Criteria**

- [ ] When a reading is saved, the service checks `telegramNotifyMode` from `user_preferences`.
- [ ] In `deliver` mode: a single Telegram message is sent containing the harmonised reading (plain text, no markdown).
- [ ] If the reading exceeds 3,500 characters it is truncated with "…" and a portal link appended.
- [ ] In `notify` mode: a short notification with a portal link is sent instead of the full text.
- [ ] If the user has no Telegram linked, no message is sent and the save still succeeds.

---

## 7. Account Settings (User Profile)

### US-7.1 — Update Display Name

**As a** logged-in user,  
**I want to** update my display name,  
**so that** my profile reflects my preferred name.

**Acceptance Criteria**

- [ ] `PUT /users/profile` with a non-empty `name` returns HTTP 200 and updates the DB.
- [ ] Empty or missing name returns HTTP 400.
- [ ] Unauthenticated requests return HTTP 401 or 403.

---

### US-7.2 — Account Settings Navigation

**As a** logged-in user,  
**I want to** open and close Account Settings from the navigation,  
**so that** I can manage my profile without leaving the app flow.

**Acceptance Criteria**

- [ ] The navigation dropdown contains an "Edit Profile" option.
- [ ] Clicking it opens Account Settings as a full-screen overlay.
- [ ] A back arrow in the header returns the user to the main app.
- [ ] Account Settings contains both the profile name form and the Telegram Notifications card.

---

### US-7.3 — Contact Support

**As a** logged-in user,  
**I want to** contact Tarot Cafe support from the navigation,  
**so that** I can get help without leaving the app.

**Acceptance Criteria**

- [ ] The navigation dropdown contains a "Contact Support" item with a mail icon.
- [ ] Clicking it opens the user's email client pre-addressed to tarotcafe.online@outlook.com with subject "Support Enquiry".
- [ ] The item is visible to all logged-in users (requester, reader, and admin).

---

## 8. Technical / Non-Functional

### US-8.1 — SPA Deep-Link Routing

**As a** user sharing or bookmarking a portal URL,  
**I want** direct navigation to any route to work,  
**so that** I don't see a 404 from the server.

**Acceptance Criteria**

- [ ] `/request`, `/my-readings`, `/gem-history`, and `/reader` all return HTTP 200 when accessed directly.
- [ ] The SPA client-side router handles the route correctly after load.

---

### US-8.2 — Auth Rate Limiting

**As the** platform operator,  
**I want** the auth endpoints protected against brute-force attempts,  
**so that** user accounts are not easily compromised.

**Acceptance Criteria**

- [ ] The `/api/auth` endpoint group is rate-limited to 5 requests per 15-minute window per IP.
- [ ] Exceeding the limit returns HTTP 429 with a human-readable error message.

---

### US-8.3 — Health Check

**As a** DevOps operator,  
**I want** a health endpoint to confirm the server is up,  
**so that** monitoring and load balancers can route traffic correctly.

**Acceptance Criteria**

- [ ] `GET /api/health` returns HTTP 200 with `{ status: "ok" }`.
