# Telegram Integration

This document covers how the Mystic Tarot Portal uses Telegram — for passwordless login, account linking, reading notifications, and reader alerts.

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Yes | Authenticates **outbound** API calls from the server to Telegram (e.g. sending messages). Format: `123456789:ABC-DEF...` |
| `TELEGRAM_BOT_USERNAME` | Yes | Your bot's username (without `@`). Used to construct deep-link URLs sent to the frontend. |
| `TELEGRAM_WEBHOOK_SECRET` | **Strongly recommended** | A random secret you choose. Telegram echoes it back in every webhook POST so the server can verify the request is genuine. See [Webhook Security](#webhook-security). |
| `FRONTEND_URL` | Yes | The portal's public URL (e.g. `https://tarot.example.com`). Embedded in magic login links sent via Telegram. |
| `TELEGRAM_READER_CHAT_ID` | Yes | The reader's personal Telegram chat ID. New reading alerts are sent here. |

---

## Bot Token vs Webhook Secret — Why Both?

These two credentials protect **opposite directions** of communication.

```
┌─────────────────────┐            ┌─────────────────┐
│      SERVER         │            │    TELEGRAM      │
│                     │            │                  │
│  TELEGRAM_BOT_TOKEN ─────────►  │  Telegram API    │
│  (proves server     │  sendMsg   │  (accepts only   │
│   identity to TG)   │            │   valid tokens)  │
│                     │            │                  │
│  /api/telegram/  ◄──────────── │  Webhook POST    │
│  webhook            │  delivers  │  (how does the   │
│  TELEGRAM_WEBHOOK_  │  updates   │   server know    │
│  SECRET             │            │   this is real?) │
│  (proves TG's       │            │                  │
│   identity to us)   │            │                  │
└─────────────────────┘            └─────────────────┘
```

- **`TELEGRAM_BOT_TOKEN`** — used when the server calls `https://api.telegram.org/bot<TOKEN>/sendMessage`. Telegram validates the token and accepts or rejects your request. This does **not** protect your webhook endpoint.

- **`TELEGRAM_WEBHOOK_SECRET`** — a random string you pick and register with Telegram once (using `setWebhook`). From that point on, Telegram includes it in the `X-Telegram-Bot-Api-Secret-Token` header on every webhook POST. The server checks this header and rejects any request where it is missing or wrong.

**Without the webhook secret**, anyone who discovers your webhook URL can POST fake Telegram messages to it. The bot token alone provides zero protection here — it only proves your server's identity when calling Telegram, not the other way around.

---

## Webhook Security

The check is already coded in `server/src/routes/telegram.ts`:

```ts
router.post('/webhook', async (req, res) => {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) {
    const incoming = req.headers['x-telegram-bot-api-secret-token'];
    if (incoming !== webhookSecret) {
      res.status(403).json({ ok: false });
      return;
    }
  }
  // ... handler continues
});
```

The guard only activates when `TELEGRAM_WEBHOOK_SECRET` is set. **If the env var is missing, the check is skipped and the endpoint is unprotected.**

### One-time Setup Steps

1. **Generate a secret** (any random string, max 256 chars, alphanumeric + `_-`):
   ```bash
   openssl rand -hex 32
   ```

2. **Add it to your server environment** (Northflank → Environment → add `TELEGRAM_WEBHOOK_SECRET`).

3. **Register your webhook URL with Telegram**, passing the secret via `secret_token`:
   ```bash
   curl -s "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -d "url=https://your-server.northflank.app/api/telegram/webhook" \
     -d "secret_token=<YOUR_WEBHOOK_SECRET>"
   ```
   Telegram responds: `{"ok":true,"result":true,"description":"Webhook was set"}`

4. **Restart the server** so it picks up the new env var. The endpoint now rejects any POST that doesn't carry the matching header.

---

## User Flows

### Flow 1 — Telegram-First Login (no portal account needed)

A user who only has Telegram and has never signed up via email.

```
1. User clicks "Login with Telegram" in the portal
2. Frontend calls POST /api/telegram/login-init
   ← { requestToken, deepLink: "https://t.me/BOT?start=loginreq_TOKEN" }
3. Portal shows a button linking to that deep link
   (and begins polling GET /api/telegram/login-status?requestToken=TOKEN)
4. User taps the deep link → Telegram opens the bot
5. Bot receives message: /start loginreq_TOKEN
6. Server looks up the requestToken in memory
7. If the user doesn't exist yet → creates a User row (name from Telegram, no email/password)
                                  → sets userPreferences.telegramNotifyMode = 'notify'
8. Issues a 10-minute magic login token, stores it on the User row
9. Sends the user a Telegram message with a link back to the portal
10. Server updates the in-memory loginRequest with the loginToken
11. Portal poll returns { ready: true, loginToken: "..." }
12. Frontend calls POST /api/auth/telegram-login with { token: loginToken }
    ← { user, token: JWT }
13. User is now logged in; JWT is stored in AuthContext
```

### Flow 2 — Link Telegram to an Existing Portal Account

A user who signed up with email/password and wants to add Telegram notifications.

```
1. User is logged in; goes to Account Settings → Telegram section
2. Frontend calls POST /api/telegram/link-token (requires auth)
   ← { token, deepLink: "https://t.me/BOT?start=LINK_TOKEN" }
3. Portal shows the deep link as a button
4. User taps → Telegram opens the bot
5. Bot receives: /start LINK_TOKEN
6. Server finds the User by telegramLinkToken
7. Updates User: telegramChatId = chatId, telegramLinkToken = null
8. Upserts userPreferences: telegramNotifyMode = 'notify' (default)
9. Sends confirmation message via Telegram
10. Portal's status poll (GET /api/telegram/status) now returns linked: true
```

### Flow 3 — Plain /start in the Bot

A user who opens the bot directly without a portal-generated link.

```
If the Telegram chat ID already has a linked account:
  → Issues a new magic login token
  → Sends a "Welcome back" message with a login link (valid 10 min)

If the chat ID has no linked account:
  → Creates a new User row with name from Telegram
  → Sets userPreferences.telegramNotifyMode = 'notify'
  → Issues a magic login token
  → Sends a "Welcome" message with a login link
```

---

## Notification Modes

Stored in `user_preferences.telegramNotifyMode`. Set to `'notify'` by default when any Telegram flow first creates or links an account. The user can change it in Account Settings.

| Mode | What happens when a reading is ready |
|---|---|
| `notify` | Telegram sends: "Your reading is ready" + a link to the portal |
| `deliver` | Telegram sends: the full harmonised reading text directly in the message |

The mode is read at the time the admin submits a reading (`PUT /api/submissions/admin/:id`). The notification is fired from `telegramService.notifyRequesterReadingReady`.

---

## Reader Notifications

When a new submission is created (and it's not pending payment), the reader receives a Telegram alert:

```
🔮 New Reading Request

👤 From: Jane Doe (jane@example.com)
🌟 Category: Love
♈ Horoscope: Scorpio
❓ Question: Will I find what I'm looking for?

📋 Open Reader Portal →
```

This uses `TELEGRAM_READER_CHAT_ID` and `telegramService.notifyReaderNewSubmission`.

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/telegram/webhook` | None (public) | Receives Telegram bot updates. Protected by webhook secret. |
| `POST` | `/api/telegram/login-init` | None | Starts an unauthenticated login flow. Returns a requestToken and deep link. |
| `GET` | `/api/telegram/login-status` | None | Polls whether the bot has confirmed a login request. |
| `POST` | `/api/telegram/link-token` | JWT | Generates a one-time link token for connecting Telegram to an existing account. |
| `GET` | `/api/telegram/status` | JWT | Returns whether Telegram is linked and the current notification mode. |
| `PUT` | `/api/telegram/preferences` | JWT | Updates `telegramNotifyMode` (`notify` or `deliver`). |
| `DELETE` | `/api/telegram/unlink` | JWT | Clears `telegramChatId` and resets `telegramNotifyMode` to null. |

---

## Data Model

```
User
  telegramChatId         String?   — Telegram chat ID when linked
  telegramLinkToken      String?   — One-time token for account linking (Flow 2)
  telegramLoginToken     String?   — Magic login token (Flow 1 & 3), single-use
  telegramLoginTokenExpiry DateTime? — Expiry for the magic login token

UserPreferences (user_preferences table)
  telegramNotifyMode     String?   — 'notify' | 'deliver' | null
```

---

## Checklist Before Going Live

- [ ] `TELEGRAM_BOT_TOKEN` set in server env
- [ ] `TELEGRAM_BOT_USERNAME` set in server env (and frontend env if needed)
- [ ] `TELEGRAM_READER_CHAT_ID` set to the reader's chat ID
- [ ] `FRONTEND_URL` set to the production domain
- [ ] `TELEGRAM_WEBHOOK_SECRET` generated and set in server env
- [ ] Webhook registered with Telegram using `setWebhook` with the secret_token parameter
- [ ] Webhook registration confirmed (Telegram returns `"ok":true`)
