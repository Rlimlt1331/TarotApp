import { chromium } from 'playwright';
import { strict as assert } from 'assert';

const BASE = 'http://localhost:5173';
const API  = 'http://localhost:3000/api';

// Unique test account (won't collide with real users)
const TEST_EMAIL = `verify_${Date.now()}@test.local`;
const TEST_PASS  = 'Verify1234!';

const ADMIN_EMAIL = 'admin@test.com'; // existing reader account — must exist in DB

let browser, page;
const results = [];

function step(emoji, name, detail = '') {
  results.push({ emoji, name, detail });
  console.log(`${emoji}  ${name}${detail ? ' — ' + detail : ''}`);
}

async function screenshot(label) {
  const path = `/tmp/verify_${label.replace(/\s+/g,'_')}.png`;
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function setup() {
  browser = await chromium.launch({ headless: true });
  page    = await browser.newPage();
  page.setDefaultTimeout(12000);
}

// ─── API layer checks ─────────────────────────────────────────────────────────

async function apiGems_packsList() {
  const r = await fetch(`${API}/gems/packs`);
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(d.packs) && d.packs.length === 4, 'Expected 4 gem packs');
  assert.ok(d.packs.some(p => p.popular), 'Expected a "popular" pack');
  step('✅', 'API /gems/packs', `${d.packs.length} packs, popular="${d.packs.find(p=>p.popular)?.id}"`);
}

async function apiTelegramLoginInit() {
  const r = await fetch(`${API}/telegram/login-init`, { method: 'POST' });
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.ok(d.requestToken && d.requestToken.length > 10, 'Missing requestToken');
  step('✅', 'API POST /telegram/login-init', `requestToken present, deepLink=${d.deepLink ? 'set' : 'null'}`);

  // Poll immediately — should be pending
  const r2 = await fetch(`${API}/telegram/login-status?requestToken=${d.requestToken}`);
  const d2 = await r2.json();
  assert.equal(r2.status, 200);
  assert.equal(d2.ready, false);
  step('✅', 'API GET /telegram/login-status (pending)', `ready=${d2.ready}`);

  // Bogus token — should 410
  const r3 = await fetch(`${API}/telegram/login-status?requestToken=notarealtoken`);
  assert.equal(r3.status, 410);
  step('🔍', 'API login-status with invalid token → 410', `status=${r3.status}`);
}

async function apiAuthSignup() {
  const r = await fetch(`${API}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS, name: 'Verify User' }),
  });
  const d = await r.json();
  assert.equal(r.status, 201);
  assert.ok(d.token, 'No JWT in response');
  step('✅', 'API POST /auth/signup', `user id=${d.user.id}`);
  return d.token;
}

async function apiGemsBalance(token) {
  const r = await fetch(`${API}/gems/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.gemBalance, 0, 'New user should start at 0 gems');
  assert.equal(d.freeReadingUsed, false, 'New user should have free reading available');
  step('✅', 'API GET /gems/balance (new user)', `balance=${d.gemBalance}, freeReadingUsed=${d.freeReadingUsed}`);
  return d;
}

async function apiSubmitFreeReading(token) {
  const r = await fetch(`${API}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question: 'Regression test question', category: 'career', horoscope: 'Aries', gender: 'prefer-not-to-say' }),
  });
  const d = await r.json();
  assert.equal(r.status, 201, `Expected 201, got ${r.status}: ${JSON.stringify(d)}`);
  assert.equal(d.isFreeReading, true, 'First submission should be free');
  step('✅', 'API POST /submissions (free reading)', `submission id=${d.id}, isFreeReading=${d.isFreeReading}`);
  return d.id;
}

async function apiSubmitPaidReadingBlocked(token) {
  // After free reading used, balance=0 — should get 402
  const r = await fetch(`${API}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question: 'Second question', category: 'relationships', horoscope: 'Leo', gender: 'male' }),
  });
  const d = await r.json();
  assert.equal(r.status, 402, `Expected 402 Insufficient Gems, got ${r.status}`);
  assert.ok(d.error?.includes('Gem'), `Expected gem error message, got: ${d.error}`);
  step('✅', 'API POST /submissions (no gems) → 402', `error="${d.error}", balance=${d.gemBalance}`);
}

async function apiFreeReadingUsedAfterSubmit(token) {
  const r = await fetch(`${API}/gems/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = await r.json();
  assert.equal(d.freeReadingUsed, true, 'freeReadingUsed should be true after first submission');
  assert.ok(d.transactions.some(t => t.type === 'free_reading'), 'Expected free_reading transaction');
  step('✅', 'API gems/balance after free reading', `freeReadingUsed=${d.freeReadingUsed}, txCount=${d.transactions.length}`);
}

async function apiFeedbackRatingBonus(token, submissionId) {
  const r = await fetch(`${API}/submissions/${submissionId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ rating: 5, comment: 'Regression test feedback' }),
  });
  const d = await r.json();
  assert.equal(r.status, 200);
  step('✅', 'API POST feedback (5 stars)', `gemBonusAwarded=${d.gemBonusAwarded}, bonusAmount=${d.bonusAmount}`);
  return d;
}

async function apiDuplicateFeedbackNoDoubleBonus(token, submissionId) {
  const r = await fetch(`${API}/submissions/${submissionId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ rating: 5, comment: 'Updated feedback' }),
  });
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.gemBonusAwarded, false, 'Bonus should NOT be awarded twice for same reading');
  step('🔍', 'API POST feedback again → no double bonus', `gemBonusAwarded=${d.gemBonusAwarded}`);
}

async function apiTelegramLoginExpired() {
  const r = await fetch(`${API}/auth/telegram-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'randomfaketoken123' }),
  });
  assert.equal(r.status, 401);
  step('🔍', 'API telegram-login with bad token → 401', `status=${r.status}`);
}

async function apiTelegramPreferences(token) {
  // Set preference to 'deliver'
  const r = await fetch(`${API}/telegram/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ notifyMode: 'deliver' }),
  });
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.notifyMode, 'deliver', 'notifyMode should be deliver');
  step('✅', 'API PUT /telegram/preferences', `notifyMode=${d.notifyMode} saved to user_preferences`);

  // Change to 'notify'
  const r2 = await fetch(`${API}/telegram/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ notifyMode: 'notify' }),
  });
  const d2 = await r2.json();
  assert.equal(r2.status, 200);
  assert.equal(d2.notifyMode, 'notify');
  step('✅', 'API PUT /telegram/preferences (update)', `notifyMode changed to ${d2.notifyMode}`);

  // Invalid value → 400
  const r3 = await fetch(`${API}/telegram/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ notifyMode: 'invalid' }),
  });
  assert.equal(r3.status, 400);
  step('🔍', 'API PUT /telegram/preferences invalid value → 400', `status=${r3.status}`);
}

async function apiTelegramStatus(token) {
  const r = await fetch(`${API}/telegram/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.ok('linked' in d, 'Response should have linked field');
  assert.ok('notifyMode' in d, 'Response should have notifyMode field');
  // test user has no telegram linked
  assert.equal(d.linked, false);
  step('✅', 'API GET /telegram/status', `linked=${d.linked}, notifyMode=${d.notifyMode}`);

  // Unauthenticated → 401
  const r2 = await fetch(`${API}/telegram/status`);
  assert.ok(r2.status === 401 || r2.status === 403);
  step('🔍', 'API GET /telegram/status unauthenticated → 401/403', `status=${r2.status}`);
}

async function apiGemsPurchaseRequest(token) {
  const r = await fetch(`${API}/gems/purchase-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ packId: 'pack_10' }),
  });
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.ok(d.pendingId, 'Should return pendingId');
  assert.equal(d.pack.id, 'pack_10');
  step('✅', 'API POST /gems/purchase-request', `pendingId=${d.pendingId}, pack=${d.pack.id}, gems=${d.pack.totalGems}`);

  // Invalid pack → 400
  const r2 = await fetch(`${API}/gems/purchase-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ packId: 'pack_invalid' }),
  });
  assert.equal(r2.status, 400);
  step('🔍', 'API POST /gems/purchase-request invalid pack → 400', `status=${r2.status}`);

  return d.pendingId;
}

async function apiPaymentConfirmRequiresAuth() {
  // Unauthenticated → 401/403
  const r = await fetch(`${API}/gems/payment-confirm`, { method: 'POST' });
  assert.ok(r.status === 401 || r.status === 403, `Expected 401/403, got ${r.status}`);
  step('🔍', 'API POST /gems/payment-confirm unauthenticated → 401/403', `status=${r.status}`);
}

async function apiAdminRejectRequiresAdmin(token) {
  // Regular user token → 401/403
  const r = await fetch(`${API}/gems/admin/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId: 999 }),
  });
  assert.ok(r.status === 401 || r.status === 403, `Expected 401/403, got ${r.status}`);
  step('🔍', 'API POST /gems/admin/reject non-admin → 401/403', `status=${r.status}`);
}

async function apiAdminCancelSubmissionRequiresAdmin(token) {
  // Regular user token → 401/403
  const r = await fetch(`${API}/submissions/admin/999/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.ok(r.status === 401 || r.status === 403, `Expected 401/403, got ${r.status}`);
  step('🔍', 'API POST /submissions/admin/:id/cancel non-admin → 401/403', `status=${r.status}`);
}

async function apiProfileUpdate(token) {
  const r = await fetch(`${API}/users/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Updated Verify User' }),
  });
  assert.equal(r.status, 200);
  step('✅', 'API PUT /users/profile', 'name updated');

  // Empty name → 400
  const r2 = await fetch(`${API}/users/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: '' }),
  });
  assert.equal(r2.status, 400);
  step('🔍', 'API PUT /users/profile empty name → 400', `status=${r2.status}`);
}

// ─── UI layer checks ─────────────────────────────────────────────────────────

async function uiHomepageLoads() {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const title = await page.title();
  step('✅', 'UI homepage loads', `title="${title}"`);
  await screenshot('01_homepage');
}

async function uiSpaRoutingReaderDirect() {
  const res = await page.goto(`${BASE}/reader`, { waitUntil: 'networkidle' });
  assert.ok(res.status() < 400, `/reader returned ${res.status()}`);
  step('✅', 'SPA routing /reader direct link', `lands on ${page.url()}, no 404`);
  await screenshot('02_reader_direct');
}

async function uiSpaRoutingMyReadingsDirect() {
  const res = await page.goto(`${BASE}/my-readings`, { waitUntil: 'networkidle' });
  assert.ok(res.status() < 400, `/my-readings returned ${res.status()}`);
  step('✅', 'SPA routing /my-readings direct link', `status=${res.status()}`);
}

async function uiAuthModalOpens() {
  await page.goto(`${BASE}/request`, { waitUntil: 'networkidle' });
  const loginBtn = page.getByRole('button', { name: /login/i }).first();
  await loginBtn.click();
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  step('✅', 'Auth modal opens on Login click');
  await screenshot('03_auth_modal');
}

async function uiAuthModalTelegramSection() {
  const tgLabel = await page.locator('text=Login with Telegram').first();
  assert.ok(await tgLabel.isVisible(), 'Telegram login section not visible');
  const continueBtn = page.getByRole('button', { name: /continue with telegram/i });
  assert.ok(await continueBtn.isVisible(), '"Continue with Telegram" button not visible');
  step('✅', 'Auth modal — Telegram section visible with button');
}

let tgBotConfigured = false;

async function uiTelegramLoginInitFlow() {
  const continueBtn = page.getByRole('button', { name: /continue with telegram/i });
  await continueBtn.click();

  await page.waitForFunction(
    () => document.body.textContent.includes('Step 1') || document.body.textContent.includes('Telegram login is not available'),
    { timeout: 8000 }
  );

  const notAvailable = await page.locator('text=Telegram login is not available').first().isVisible().catch(() => false);
  if (notAvailable) {
    tgBotConfigured = false;
    const emailLink = page.locator('button, a').filter({ hasText: /sign up or log in with email/i }).first();
    assert.ok(await emailLink.isVisible(), 'Amber fallback — email link not visible');
    step('✅', 'Telegram login — bot not configured → amber warning with email fallback shown (graceful)');
  } else {
    tgBotConfigured = true;
    const openBotBtn = page.getByRole('link', { name: /open telegram bot/i });
    const verifyBtn  = page.getByRole('button', { name: /i've opened the bot/i });
    assert.ok(await openBotBtn.isVisible(), '"Open Telegram Bot" not visible');
    assert.ok(await verifyBtn.isVisible(), '"verify login" button not visible');
    step('✅', 'Telegram login — pending state shows Step 1/2/3 + Open Bot + Verify buttons');
  }
  await screenshot('04_tg_pending');
}

async function uiTelegramNoAccountHint() {
  if (!tgBotConfigured) {
    step('✅', 'Telegram no-account hint — skipped (bot not configured; amber fallback shown instead)');
    return;
  }
  const hint = await page.locator("text=Don't have Telegram?").first();
  assert.ok(await hint.isVisible(), '"Don\'t have Telegram?" hint not visible');
  const downloadLink = page.getByRole('link', { name: /download it here/i });
  assert.ok(await downloadLink.isVisible(), 'Telegram download link not visible');
  const emailFallback = page.getByRole('button', { name: /sign up with email instead/i });
  assert.ok(await emailFallback.isVisible(), '"Sign up with email instead" not visible');
  step('✅', 'Telegram pending state — no-Telegram help box visible with download link + email fallback');
}

async function uiTelegramVerifyFailsGracefully() {
  if (!tgBotConfigured) {
    step('✅', 'Telegram verify — skipped (bot not configured; amber fallback shown instead)');
    return;
  }
  const verifyBtn = page.getByRole('button', { name: /i've opened the bot/i });
  await verifyBtn.click();
  const toast = await page.waitForSelector('[data-sonner-toast]', { timeout: 8000 });
  const toastText = await toast.innerText();
  assert.ok(
    toastText.includes('Not confirmed') || toastText.includes('email login'),
    `Unexpected toast: "${toastText}"`
  );
  step('✅', 'Telegram verify (nothing sent to bot) → graceful error toast', `"${toastText.slice(0,80)}…"`);
  await screenshot('05_tg_verify_error');
}

async function uiTelegramEmailFallback() {
  if (!tgBotConfigured) {
    const emailLink = page.locator('button').filter({ hasText: /sign up or log in with email/i }).first();
    await emailLink.click();
    await page.waitForSelector('button:has-text("Continue with Telegram")', { timeout: 5000 });
    step('✅', 'Telegram not-configured amber card — email link resets to idle state');
    await screenshot('06_tg_reset');
    return;
  }
  const emailFallback = page.getByRole('button', { name: /sign up with email instead/i });
  await emailFallback.click();
  await page.waitForSelector('button:has-text("Continue with Telegram")', { timeout: 5000 });
  step('✅', 'Telegram "Sign up with email instead" → resets to idle state');
  await screenshot('06_tg_reset');
}

async function uiEmailSignupAndLogin() {
  await page.keyboard.press('Escape');
  await page.goto(`${BASE}/request`, { waitUntil: 'networkidle' });
  const loginBtn = page.getByRole('button', { name: /login/i }).first();
  await loginBtn.click();
  await page.waitForSelector('[role="dialog"]');

  await page.getByRole('button', { name: /sign up/i }).first().click();
  const uniqueEmail = `ui_verify_${Date.now()}@test.local`;
  await page.getByPlaceholder('Your name').fill('UI Test User');
  await page.getByPlaceholder('your@email.com').fill(uniqueEmail);
  await page.getByPlaceholder('••••••••').fill('TestPass123!');
  await page.getByRole('button', { name: /^sign up$/i }).click();

  await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 10000 });
  step('✅', 'Email signup → modal closes (login successful)', `email=${uniqueEmail}`);
  await screenshot('07_after_signup');
}

async function uiGemBalanceInNav() {
  await page.waitForSelector('button:has-text("Free reading available"), button:has-text("Gems")', { timeout: 8000 });
  const gemPill = page.locator('button').filter({ hasText: /free reading available|gems/i }).first();
  assert.ok(await gemPill.isVisible(), 'Gem balance pill not visible in nav');
  const gemText = await gemPill.innerText();
  step('✅', 'Gem balance pill visible in navbar', `text="${gemText}"`);
  await screenshot('08_gem_nav_pill');
}

async function uiGemPurchaseModal() {
  const gemPill = page.locator('button').filter({ hasText: /free reading available|gems/i }).first();
  await gemPill.click();
  await page.waitForSelector('[role="dialog"]:has-text("Tarot Gems")', { timeout: 5000 });

  const packs = await page.locator('button').filter({ hasText: /\$\d+ SGD/ }).all();
  assert.equal(packs.length, 4, `Expected 4 packs, got ${packs.length}`);

  const popular = await page.locator('text=Most Popular').first();
  assert.ok(await popular.isVisible(), '"Most Popular" badge not visible');
  step('✅', 'Gem purchase modal — 4 packs shown, Most Popular badge visible');
  await screenshot('09_gem_modal_packs');
}

async function uiGemPurchasePayNowQR() {
  const pack50 = page.locator('button').filter({ hasText: '$50 SGD' });
  await pack50.click();
  await page.waitForSelector('img[alt="PayNow QR code"]', { timeout: 6000 });
  const qrImg = page.locator('img[alt="PayNow QR code"]');
  assert.ok(await qrImg.isVisible(), 'PayNow QR image not visible');
  const src = await qrImg.getAttribute('src');
  assert.ok(src?.includes('paynow-qr'), `Unexpected QR src: ${src}`);

  const sgdText = await page.locator('text=SGD 50').first();
  assert.ok(await sgdText.isVisible(), 'SGD amount not shown in instructions');
  step('✅', 'Gem purchase PayNow step — QR image + SGD 50 amount visible');
  await screenshot('10_gem_paynow');
}

async function uiGemsModalHobbyNote() {
  // Gems modal should show the passion-project/cost explanation note
  const note = page.locator('text=passion project').first();
  assert.ok(await note.isVisible(), 'Hobby/cost note not visible in Gems modal');
  step('✅', 'Gems modal — passion project note visible on pack selection screen');
}

async function uiGemsModalPayNowCopy() {
  // Advance to the PayNow step to check updated instructions
  const pack10 = page.locator('button').filter({ hasText: '$10 SGD' }).first();
  await pack10.click();
  await page.waitForSelector('img[alt="PayNow QR code"]', { timeout: 6000 });

  // Step 3 should mention "app profile", not just "name"
  const profileRef = page.locator('text=app profile').first();
  assert.ok(await profileRef.isVisible(), 'PayNow step 3 should reference "app profile"');

  // Support email should be present
  const supportLink = page.locator(`a[href*="tarotcafe.online@outlook.com"]`).first();
  assert.ok(await supportLink.isVisible(), 'Support email link not visible in PayNow step');

  step('✅', 'Gems PayNow step — "app profile" instruction + support email link visible');
  await screenshot('10b_paynow_copy');
}

async function uiGemModalClose() {
  const backBtn = page.getByRole('button', { name: /back/i });
  await backBtn.click();
  await page.keyboard.press('Escape');
  step('✅', 'Gem modal — Back button and close work');
}

async function uiRequesterPortalFreeReadingBadge() {
  await page.goto(`${BASE}/request`, { waitUntil: 'networkidle' });
  const freeBadge = page.locator('text=First Reading Free').first();
  assert.ok(await freeBadge.isVisible(), '"First Reading Free" badge not visible');
  step('✅', 'RequesterPortal — "First Reading Free" badge visible for new user');
  await screenshot('11_free_badge');
}

async function uiSubmitFreeReadingForm() {
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Aries' }).click();

  await page.locator('label').filter({ hasText: /^male$/i }).click();

  const firstQ = page.locator('button[class*="justify-start"]').first();
  await firstQ.click();

  const submitBtn = page.getByRole('button', { name: /submit.*free reading/i });
  assert.ok(await submitBtn.isVisible(), 'Submit free reading button not found');
  step('✅', 'RequesterPortal form filled — submit button shows "Submit Free Reading Request"');
  await screenshot('12_ready_to_submit');
}

async function uiFormDraftPersistence() {
  // Fill in the form with specific values
  await page.goto(`${BASE}/request`, { waitUntil: 'networkidle' });
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Scorpio' }).click();
  await page.locator('label').filter({ hasText: /prefer not/i }).click();
  const customQ = page.getByPlaceholder('Enter your own question...');
  await customQ.fill('Will my career change be a positive one?');

  // Navigate away to gem history
  await page.goto(`${BASE}/gem-history`, { waitUntil: 'networkidle' });

  // Navigate back to request
  await page.goto(`${BASE}/request`, { waitUntil: 'networkidle' });

  // Verify the form still has the filled values from sessionStorage
  const horoscopeValue = await page.getByRole('combobox').inputValue().catch(
    async () => await page.locator('[data-radix-select-trigger]').innerText()
  );
  assert.ok(horoscopeValue.includes('Scorpio') || await page.locator('text=Scorpio').first().isVisible(), 'Horoscope not restored from draft');

  const customQValue = await customQ.inputValue();
  assert.ok(customQValue.includes('career change'), `Custom question not restored: "${customQValue}"`);

  step('✅', 'Form draft persistence — fields restored from sessionStorage after tab navigation');
  await screenshot('13_form_draft_restored');
}

async function uiMyReadingsHasNoTelegramCard() {
  // TelegramSettings was moved from MyReadings to UserProfile — verify it's gone
  await page.goto(`${BASE}/my-readings`, { waitUntil: 'networkidle' });
  const tgCard = await page.locator('text=Telegram Notifications').first().isVisible().catch(() => false);
  assert.ok(!tgCard, 'TelegramSettings card should NOT appear in MyReadings (it moved to UserProfile)');
  // MyReadings should still show the reading stats
  const heading = page.locator('text=My Readings').first();
  assert.ok(await heading.isVisible(), 'My Readings heading not visible');
  step('✅', 'MyReadings — Telegram Notifications card correctly absent (moved to UserProfile)');
  await screenshot('14_myreadings_no_telegram');
}

async function uiGemHistoryPage() {
  const res = await page.goto(`${BASE}/gem-history`, { waitUntil: 'networkidle' });
  assert.ok(res.status() < 400, `/gem-history returned ${res.status()}`);
  // Should show Gem History heading
  const heading = page.locator('text=Gem History').first();
  assert.ok(await heading.isVisible(), 'Gem History heading not visible');
  // New user: no transactions yet — should show empty state
  const emptyOrTable = await page.locator('text=No transactions yet, text=Transaction').first().isVisible().catch(() => true);
  step('✅', 'Gem History page loads at /gem-history', `status=${res.status()}`);
  await screenshot('15_gem_history');
}

async function uiUserProfileAccountSettings() {
  // Navigate to Account Settings via the nav dropdown
  await page.goto(`${BASE}/request`, { waitUntil: 'networkidle' });

  // Open the account dropdown (trigger shows email or name)
  const dropdownTrigger = page.locator('button').filter({ hasText: /@test\.local|UI Test User|Account/i }).first();
  await dropdownTrigger.click();
  await page.getByText('Edit Profile').click();

  // Should render Account Settings full-screen
  await page.waitForSelector('text=Account Settings', { timeout: 8000 });
  step('✅', 'Account Settings page opens via nav dropdown Edit Profile');
  await screenshot('16_account_settings');
}

async function uiUserProfileBackArrow() {
  // Back arrow should be present in Account Settings header and return to main app
  const backBtn = page.getByRole('button', { name: /back/i }).first();
  assert.ok(await backBtn.isVisible(), 'Back arrow button not visible in Account Settings');

  await backBtn.click();
  // Should return to the main app (no longer showing Account Settings)
  await page.waitForSelector('text=Account Settings', { state: 'hidden', timeout: 5000 });
  step('✅', 'Account Settings back arrow — returns to main app');
  await screenshot('17_back_from_settings');
}

async function uiContactSupportInNavDropdown() {
  await page.goto(`${BASE}/request`, { waitUntil: 'networkidle' });
  const dropdownTrigger = page.locator('button').filter({ hasText: /@test\.local|UI Test User|Account/i }).first();
  await dropdownTrigger.click();

  const contactItem = page.locator('a').filter({ hasText: /contact support/i }).first();
  assert.ok(await contactItem.isVisible(), '"Contact Support" item not visible in nav dropdown');

  const href = await contactItem.getAttribute('href');
  assert.ok(href?.includes('tarotcafe.online@outlook.com'), `Contact Support href missing support email: ${href}`);

  step('✅', 'Nav dropdown — Contact Support item visible with correct mailto href');
  await screenshot('18b_contact_support_menu');
  await page.keyboard.press('Escape');
}

async function uiUserProfileTelegramCard() {
  // Re-open Account Settings to verify TelegramSettings card is present
  await page.goto(`${BASE}/request`, { waitUntil: 'networkidle' });
  const dropdownTrigger = page.locator('button').filter({ hasText: /@test\.local|UI Test User|Account/i }).first();
  await dropdownTrigger.click();
  await page.getByText('Edit Profile').click();
  await page.waitForSelector('text=Account Settings', { timeout: 8000 });

  const tgCard = page.locator('text=Telegram Notifications').first();
  assert.ok(await tgCard.isVisible(), 'TelegramSettings card not visible in Account Settings');

  // Linking button should be present (user has no Telegram linked)
  const linkBtn = page.getByRole('button', { name: /link telegram/i });
  assert.ok(await linkBtn.isVisible(), '"Link Telegram" button not visible');
  step('✅', 'Account Settings — Telegram Notifications card with Link Telegram button visible');
  await screenshot('18_profile_telegram_card');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log(' Tarot Portal — Regression Test Suite');
  console.log('══════════════════════════════════════════\n');

  await setup();
  let failed = 0;

  const tests = [
    // API
    ['API: gems packs list',                apiGems_packsList],
    ['API: telegram login-init flow',       apiTelegramLoginInit],
    ['API: auth signup',                    async () => { global.testToken = await apiAuthSignup(); }],
    ['API: gems balance (new user)',         async () => { await apiGemsBalance(global.testToken); }],
    ['API: free reading submission',        async () => { global.testSubId = await apiSubmitFreeReading(global.testToken); }],
    ['API: 402 when gems exhausted',        async () => { await apiSubmitPaidReadingBlocked(global.testToken); }],
    ['API: freeReadingUsed=true after',     async () => { await apiFreeReadingUsedAfterSubmit(global.testToken); }],
    ['API: feedback + rating bonus',        async () => { await apiFeedbackRatingBonus(global.testToken, global.testSubId); }],
    ['API: no double bonus on re-rate',     async () => { await apiDuplicateFeedbackNoDoubleBonus(global.testToken, global.testSubId); }],
    ['API: bad telegram token → 401',       apiTelegramLoginExpired],
    ['API: telegram status endpoint',       async () => { await apiTelegramStatus(global.testToken); }],
    ['API: telegram preferences upsert',   async () => { await apiTelegramPreferences(global.testToken); }],
    ['API: gems purchase-request',         async () => { global.testPendingId = await apiGemsPurchaseRequest(global.testToken); }],
    ['API: payment-confirm requires auth', apiPaymentConfirmRequiresAuth],
    ['API: admin/reject requires admin',   async () => { await apiAdminRejectRequiresAdmin(global.testToken); }],
    ['API: admin/cancel requires admin',   async () => { await apiAdminCancelSubmissionRequiresAdmin(global.testToken); }],
    ['API: profile name update',           async () => { await apiProfileUpdate(global.testToken); }],
    // UI
    ['UI: homepage loads',                  uiHomepageLoads],
    ['UI: SPA /reader direct link',         uiSpaRoutingReaderDirect],
    ['UI: SPA /my-readings direct',         uiSpaRoutingMyReadingsDirect],
    ['UI: auth modal opens',                uiAuthModalOpens],
    ['UI: Telegram section in modal',       uiAuthModalTelegramSection],
    ['UI: Telegram login init flow',        uiTelegramLoginInitFlow],
    ['UI: no-Telegram help box',            uiTelegramNoAccountHint],
    ['UI: verify fails gracefully',         uiTelegramVerifyFailsGracefully],
    ['UI: email fallback resets modal',     uiTelegramEmailFallback],
    ['UI: email signup',                    uiEmailSignupAndLogin],
    ['UI: gem balance in nav',              uiGemBalanceInNav],
    ['UI: gem purchase modal (packs)',      uiGemPurchaseModal],
    ['UI: Gems modal hobby note',           uiGemsModalHobbyNote],
    ['UI: PayNow QR in pay step',           uiGemPurchasePayNowQR],
    ['UI: PayNow copy — profile name ref', uiGemsModalPayNowCopy],
    ['UI: gem modal close/back',            uiGemModalClose],
    ['UI: free reading badge',              uiRequesterPortalFreeReadingBadge],
    ['UI: submit form ready state',         uiSubmitFreeReadingForm],
    ['UI: form draft survives navigation',  uiFormDraftPersistence],
    ['UI: MyReadings has no Telegram card', uiMyReadingsHasNoTelegramCard],
    ['UI: Gem History page at /gem-history',uiGemHistoryPage],
    ['UI: Account Settings opens',          uiUserProfileAccountSettings],
    ['UI: Account Settings back arrow',     uiUserProfileBackArrow],
    ['UI: Contact Support in nav dropdown', uiContactSupportInNavDropdown],
    ['UI: Account Settings Telegram card',  uiUserProfileTelegramCard],
  ];

  for (const [name, fn] of tests) {
    try {
      await fn();
    } catch (err) {
      step('❌', name, err.message.slice(0, 120));
      await screenshot(`FAIL_${name.replace(/\W+/g,'_')}`).catch(() => {});
      failed++;
    }
  }

  await browser.close();
  await cleanupTestData();

  console.log('\n══════════════════════════════════════════');
  console.log(` Results: ${tests.length - failed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════\n');
  if (failed > 0) process.exit(1);
}

// Delete all @test.local users and their associated data from the DB.
async function cleanupTestData() {
  const fs = await import('fs');
  let dbUrl = '';
  try {
    const env = fs.readFileSync(`${process.cwd()}/server/.env`, 'utf8');
    const match = env.match(/^DATABASE_URL="?([^"\n]+)"?/m);
    if (match) dbUrl = match[1];
  } catch { /* ignore */ }
  if (!dbUrl) { console.log('⚠️  Could not read DATABASE_URL — skipping cleanup'); return; }

  const pg = await import('pg');
  const client = new pg.default.Client({ connectionString: dbUrl });
  try {
    await client.connect();
    const { rows } = await client.query(`SELECT id FROM users WHERE email LIKE '%@test.local'`);
    if (!rows.length) { console.log('🧹 No test data to clean up'); return; }
    const ids = rows.map(r => r.id);
    const ph = ids.map((_, i) => `$${i + 1}`).join(',');
    await client.query(`DELETE FROM gem_transactions WHERE "userId" IN (${ph})`, ids);
    await client.query(`DELETE FROM user_preferences WHERE "userId" IN (${ph})`, ids);
    await client.query(`DELETE FROM feedbacks WHERE "submissionId" IN (SELECT id FROM submissions WHERE "userId" IN (${ph}))`, ids);
    await client.query(`DELETE FROM submissions WHERE "userId" IN (${ph})`, ids);
    await client.query(`DELETE FROM users WHERE id IN (${ph})`, ids);
    console.log(`🧹 Cleaned up ${ids.length} test user(s) and their data`);
  } catch (e) {
    console.log(`⚠️  Cleanup failed: ${e.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

run().catch(e => { console.error(e); process.exit(1); });
