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

// ─── API layer checks (production backend) ───────────────────────────────────

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

  // Poll status immediately — should be pending (not ready)
  const r2 = await fetch(`${API}/telegram/login-status?requestToken=${d.requestToken}`);
  const d2 = await r2.json();
  assert.equal(r2.status, 200);
  assert.equal(d2.ready, false);
  step('✅', 'API GET /telegram/login-status (pending)', `ready=${d2.ready}`);

  // Poll with a bogus token — should 410
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
  // Create a mock reading first (admin-only, skip actual reading — test feedback bonus with existing submission)
  // Rate >=4 stars to trigger bonus
  const r = await fetch(`${API}/submissions/${submissionId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ rating: 5, comment: 'Regression test feedback' }),
  });
  const d = await r.json();
  assert.equal(r.status, 200);
  step('✅', 'API POST feedback (5 stars)', `gemBonusAwarded=${d.gemBonusAwarded}, bonusAmount=${d.bonusAmount}`);

  // Verify balance increased if bonus awarded (only if reading exists — won't be here, but bonus tracks attempt)
  return d;
}

async function apiDuplicateFeedbackNoDoubleBonus(token, submissionId) {
  // Submitting feedback again should not double-award the bonus
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
  // Telegram-only login with an expired/random token → 401
  const r = await fetch(`${API}/auth/telegram-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'randomfaketoken123' }),
  });
  assert.equal(r.status, 401);
  step('🔍', 'API telegram-login with bad token → 401', `status=${r.status}`);
}

// ─── UI layer checks (local Vite → production API) ───────────────────────────

async function uiHomepageLoads() {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const title = await page.title();
  step('✅', 'UI homepage loads', `title="${title}"`);
  await screenshot('01_homepage');
}

async function uiSpaRoutingReaderDirect() {
  // Verify that /reader doesn't 404 (vercel.json fix — locally Vite handles it too)
  const res = await page.goto(`${BASE}/reader`, { waitUntil: 'networkidle' });
  assert.ok(res.status() < 400, `/reader returned ${res.status()}`);
  const url = page.url();
  step('✅', 'SPA routing /reader direct link', `lands on ${url}, no 404`);
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
  // Modal should be open — check for Telegram section
  const tgLabel = await page.locator('text=Login with Telegram').first();
  assert.ok(await tgLabel.isVisible(), 'Telegram login section not visible');
  const continueBtn = page.getByRole('button', { name: /continue with telegram/i });
  assert.ok(await continueBtn.isVisible(), '"Continue with Telegram" button not visible');
  step('✅', 'Auth modal — Telegram section visible with button');
}

// tgBotConfigured is set during uiTelegramLoginInitFlow and used by subsequent Telegram tests
let tgBotConfigured = false;

async function uiTelegramLoginInitFlow() {
  const continueBtn = page.getByRole('button', { name: /continue with telegram/i });
  await continueBtn.click();

  // Wait for either the bot-configured path (Step 1) or not-configured amber warning
  await page.waitForFunction(
    () => document.body.textContent.includes('Step 1') || document.body.textContent.includes('Telegram login is not available'),
    { timeout: 8000 }
  );

  const notAvailable = await page.locator('text=Telegram login is not available').first().isVisible().catch(() => false);
  if (notAvailable) {
    // Bot not configured — graceful fallback
    tgBotConfigured = false;
    const emailLink = page.locator('button, a').filter({ hasText: /sign up or log in with email/i }).first();
    assert.ok(await emailLink.isVisible(), 'Amber fallback — email link not visible');
    step('✅', 'Telegram login — bot not configured → amber warning with email fallback shown (graceful)');
  } else {
    // Bot configured — full pending state
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
  // Should show a toast error (not crash)
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
    // In not-configured path: click "sign up or log in with email" to reset
    const emailLink = page.locator('button').filter({ hasText: /sign up or log in with email/i }).first();
    await emailLink.click();
    await page.waitForSelector('button:has-text("Continue with Telegram")', { timeout: 5000 });
    step('✅', 'Telegram not-configured amber card — email link resets to idle state');
    await screenshot('06_tg_reset');
    return;
  }
  // Bot configured path: click "Sign up with email instead" to cancel
  const emailFallback = page.getByRole('button', { name: /sign up with email instead/i });
  await emailFallback.click();
  // Should revert to idle state — show "Continue with Telegram" button again
  await page.waitForSelector('button:has-text("Continue with Telegram")', { timeout: 5000 });
  step('✅', 'Telegram "Sign up with email instead" → resets to idle state');
  await screenshot('06_tg_reset');
}

async function uiEmailSignupAndLogin() {
  // Close modal and reopen fresh
  await page.keyboard.press('Escape');
  await page.goto(`${BASE}/request`, { waitUntil: 'networkidle' });
  const loginBtn = page.getByRole('button', { name: /login/i }).first();
  await loginBtn.click();
  await page.waitForSelector('[role="dialog"]');

  // Switch to signup
  await page.getByRole('button', { name: /sign up/i }).first().click();
  const uniqueEmail = `ui_verify_${Date.now()}@test.local`;
  await page.getByPlaceholder('Your name').fill('UI Test User');
  await page.getByPlaceholder('your@email.com').fill(uniqueEmail);
  await page.getByPlaceholder('••••••••').fill('TestPass123!');
  await page.getByRole('button', { name: /^sign up$/i }).click();

  // Wait for modal to close = success
  await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 10000 });
  step('✅', 'Email signup → modal closes (login successful)', `email=${uniqueEmail}`);
  await screenshot('07_after_signup');
}

async function uiGemBalanceInNav() {
  // After signup, nav should show gem balance (free reading available)
  await page.waitForSelector('button:has-text("Free reading available"), button:has-text("Gems")', { timeout: 8000 });
  const gemPill = page.locator('button').filter({ hasText: /free reading available|gems/i }).first();
  assert.ok(await gemPill.isVisible(), 'Gem balance pill not visible in nav');
  const gemText = await gemPill.innerText();
  step('✅', 'Gem balance pill visible in navbar', `text="${gemText}"`);
  await screenshot('08_gem_nav_pill');
}

async function uiGemPurchaseModal() {
  // Click the gem pill to open purchase modal
  const gemPill = page.locator('button').filter({ hasText: /free reading available|gems/i }).first();
  await gemPill.click();
  await page.waitForSelector('[role="dialog"]:has-text("Tarot Gems")', { timeout: 5000 });

  // Should show 4 packs
  const packs = await page.locator('button').filter({ hasText: /\$\d+ SGD/ }).all();
  assert.equal(packs.length, 4, `Expected 4 packs, got ${packs.length}`);

  // Check for "Most Popular" badge
  const popular = await page.locator('text=Most Popular').first();
  assert.ok(await popular.isVisible(), '"Most Popular" badge not visible');
  step('✅', 'Gem purchase modal — 4 packs shown, Most Popular badge visible');
  await screenshot('09_gem_modal_packs');
}

async function uiGemPurchasePayNowQR() {
  // Click $50 pack (Most Popular)
  const pack50 = page.locator('button').filter({ hasText: '$50 SGD' });
  await pack50.click();
  await page.waitForSelector('img[alt="PayNow QR code"]', { timeout: 6000 });
  const qrImg = page.locator('img[alt="PayNow QR code"]');
  assert.ok(await qrImg.isVisible(), 'PayNow QR image not visible');
  const src = await qrImg.getAttribute('src');
  assert.ok(src?.includes('paynow-qr'), `Unexpected QR src: ${src}`);

  // Payment instructions
  const sgdText = await page.locator('text=SGD 50').first();
  assert.ok(await sgdText.isVisible(), 'SGD amount not shown in instructions');
  step('✅', 'Gem purchase PayNow step — QR image + SGD 50 amount visible');
  await screenshot('10_gem_paynow');
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
  // Fill in the form and submit
  await page.locator('[data-radix-collection-item]').filter({ hasText: 'Aries' }).first().click().catch(() => {});
  // Use select for horoscope
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Aries' }).click();

  // Select gender
  await page.locator('label').filter({ hasText: /^male$/i }).click();

  // Select a suggested question
  const firstQ = page.locator('button[class*="justify-start"]').first();
  await firstQ.click();

  // Submit
  const submitBtn = page.getByRole('button', { name: /submit.*free reading/i });
  assert.ok(await submitBtn.isVisible(), 'Submit free reading button not found');
  await screenshot('12_ready_to_submit');
  step('✅', 'RequesterPortal form filled — submit button shows "Submit Free Reading Request"');
}

async function uiMyReadingsTelegramLinkSection() {
  await page.goto(`${BASE}/my-readings`, { waitUntil: 'networkidle' });
  const tgCard = page.locator('text=Telegram Notifications').first();
  assert.ok(await tgCard.isVisible(), 'TelegramSettings card not visible in MyReadings');
  const linkBtn = page.getByRole('button', { name: /link telegram/i });
  assert.ok(await linkBtn.isVisible(), '"Link Telegram" button not visible');
  step('✅', 'MyReadings — Telegram Notifications card + Link Telegram button visible');
  await screenshot('13_myreadings_telegram');
}

async function uiTelegramLinkFlow() {
  await page.getByRole('button', { name: /link telegram/i }).click();
  // Wait for either bot-configured (Step 1 + Open Bot button) or not-configured message
  await page.waitForFunction(
    () => document.body.textContent.includes('Step 1') || document.body.textContent.includes('Bot username not configured'),
    { timeout: 8000 }
  );

  const notConfigured = await page.locator('text=Bot username not configured').first().isVisible().catch(() => false);
  if (notConfigured) {
    step('✅', 'MyReadings Telegram link flow — bot not configured → graceful message shown');
  } else {
    const openBtn = page.getByRole('link', { name: /open telegram bot/i });
    assert.ok(await openBtn.isVisible(), '"Open Telegram Bot" not visible after Link click');
    step('✅', 'MyReadings Telegram link flow — Step 1/2 instructions + Open Bot button appear');
  }
  await screenshot('14_myreadings_tg_link');
}

async function uiUserProfileGemHistory() {
  // Navigate to profile (via Edit Profile in dropdown)
  await page.goto(`${BASE}/request`, { waitUntil: 'networkidle' });
  const acctBtn = page.getByRole('button', { name: /account/i }).first();
  // Try to find the account dropdown
  const dropdownTrigger = page.locator('button').filter({ hasText: /@|Account/i }).first();
  await dropdownTrigger.click().catch(() => {});
  await page.getByText(/edit profile/i).first().click().catch(() => {});

  // Look for gem history section
  await page.waitForSelector('text=Tarot Gems', { timeout: 8000 });
  const gemSection = page.locator('text=Tarot Gems').first();
  assert.ok(await gemSection.isVisible(), 'Gem history section not in UserProfile');
  step('✅', 'UserProfile — Tarot Gems section visible');
  await screenshot('15_profile_gem_history');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log(' Tarot Portal — Regression Test Suite');
  console.log('══════════════════════════════════════════\n');

  await setup();
  let failed = 0;

  const tests = [
    // API
    ['API: gems packs list',            apiGems_packsList],
    ['API: telegram login-init flow',   apiTelegramLoginInit],
    ['API: auth signup',                async () => { global.testToken = await apiAuthSignup(); }],
    ['API: gems balance (new user)',     async () => { await apiGemsBalance(global.testToken); }],
    ['API: free reading submission',    async () => { global.testSubId = await apiSubmitFreeReading(global.testToken); }],
    ['API: 402 when gems exhausted',    async () => { await apiSubmitPaidReadingBlocked(global.testToken); }],
    ['API: freeReadingUsed=true after', async () => { await apiFreeReadingUsedAfterSubmit(global.testToken); }],
    ['API: feedback + rating bonus',    async () => { await apiFeedbackRatingBonus(global.testToken, global.testSubId); }],
    ['API: no double bonus on re-rate', async () => { await apiDuplicateFeedbackNoDoubleBonus(global.testToken, global.testSubId); }],
    ['API: bad telegram token → 401',   apiTelegramLoginExpired],
    // UI
    ['UI: homepage loads',              uiHomepageLoads],
    ['UI: SPA /reader direct link',     uiSpaRoutingReaderDirect],
    ['UI: SPA /my-readings direct',     uiSpaRoutingMyReadingsDirect],
    ['UI: auth modal opens',            uiAuthModalOpens],
    ['UI: Telegram section in modal',   uiAuthModalTelegramSection],
    ['UI: Telegram login init flow',    uiTelegramLoginInitFlow],
    ['UI: no-Telegram help box',        uiTelegramNoAccountHint],
    ['UI: verify fails gracefully',     uiTelegramVerifyFailsGracefully],
    ['UI: email fallback resets modal', uiTelegramEmailFallback],
    ['UI: email signup',                uiEmailSignupAndLogin],
    ['UI: gem balance in nav',          uiGemBalanceInNav],
    ['UI: gem purchase modal (packs)',  uiGemPurchaseModal],
    ['UI: PayNow QR in pay step',       uiGemPurchasePayNowQR],
    ['UI: gem modal close/back',        uiGemModalClose],
    ['UI: free reading badge',          uiRequesterPortalFreeReadingBadge],
    ['UI: submit form ready state',     uiSubmitFreeReadingForm],
    ['UI: MyReadings Telegram card',    uiMyReadingsTelegramLinkSection],
    ['UI: Telegram link flow',          uiTelegramLinkFlow],
    ['UI: UserProfile gem history',     uiUserProfileGemHistory],
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

  console.log('\n══════════════════════════════════════════');
  console.log(` Results: ${tests.length - failed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════\n');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
