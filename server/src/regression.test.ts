import test from 'node:test';
import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';

const API_URL = 'http://localhost:3000/api';
const prisma = new PrismaClient();

let token = '';
let testUserId: number;
let testSubmissionId: number;
let adminToken = '';

const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'password123';

test('Tarot App Regression Test Suite', async (t) => {

  // ─── Cleanup ────────────────────────────────────────────────────────────────
  t.after(async () => {
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  // ─── 1. Auth ────────────────────────────────────────────────────────────────
  await t.test('1. Auth: User Signup', async () => {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, name: 'Test User' }),
    });

    assert.strictEqual(res.status, 201, 'Should return 201 Created');
    const data = await res.json() as any;
    assert.ok(data.token, 'Should return a JWT token');
    assert.ok(data.user, 'Should return user object');
    assert.strictEqual(data.user.email, TEST_EMAIL, 'Email should match');

    token = data.token;
    testUserId = data.user.id;
  });

  await t.test('2. Auth: User Login', async () => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });

    assert.strictEqual(res.status, 200, 'Should return 200 OK');
    const data = await res.json() as any;
    assert.ok(data.token, 'Should return a JWT token on login');
    token = data.token;
  });

  await t.test('3. Auth: Token Verification', async () => {
    const res = await fetch(`${API_URL}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.status, 200, 'Should return 200 for valid token');
    const data = await res.json() as any;
    assert.ok(data.user, 'Should return user in verify response');
  });

  await t.test('4. Auth: Reject Invalid Token', async () => {
    const res = await fetch(`${API_URL}/auth/verify`, {
      headers: { Authorization: 'Bearer invalid.token.here' },
    });
    assert.ok(res.status === 401 || res.status === 403, 'Should reject bad token');
  });

  // ─── 2. Submissions ─────────────────────────────────────────────────────────
  await t.test('5. Submission: Create Submission', async () => {
    const res = await fetch(`${API_URL}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        question: 'What does my future hold in my career?',
        category: 'career',
        horoscope: 'Aries',
        gender: 'prefer-not-to-say',
      }),
    });

    assert.strictEqual(res.status, 201, 'Should return 201 Created');
    const data = await res.json() as any;
    assert.ok(data.id, 'Should return an id');
    assert.strictEqual(data.question, 'What does my future hold in my career?', 'Question should match');
    assert.strictEqual(data.category, 'career', 'Category should match');
    assert.strictEqual(data.reading, null, 'Reading should be null until processed');

    testSubmissionId = data.id;
  });

  await t.test('6. Submission: Reject Submission Without Question', async () => {
    const res = await fetch(`${API_URL}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category: 'career' }),
    });
    assert.strictEqual(res.status, 400, 'Should return 400 for missing question');
  });

  await t.test('7. Submission: Get My Submissions', async () => {
    const res = await fetch(`${API_URL}/submissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.status, 200, 'Should return 200 OK');
    const data = await res.json() as any;
    assert.ok(Array.isArray(data), 'Should return an array');
    assert.ok(data.length >= 1, 'Should include the submission just created');

    const created = data.find((s: any) => s.id === testSubmissionId);
    assert.ok(created, 'Should find the created submission');
    assert.ok('reading' in created, 'Submission should include reading field');
  });

  await t.test('8. Submission: Require Auth for My Submissions', async () => {
    const res = await fetch(`${API_URL}/submissions`);
    assert.ok(res.status === 401 || res.status === 403, 'Should reject unauthenticated request');
  });

  // ─── 3. Stateless Draft Generation ─────────────────────────────────────────
  await t.test('9. Readings: Generate Draft (stateless)', async () => {
    const res = await fetch(`${API_URL}/readings/generate-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        cards: ['The Sun', 'The Moon'],
        question: 'What is my career path?',
        horoscope: 'Aries',
      }),
    });

    assert.strictEqual(res.status, 200, 'Should return 200 OK');
    const data = await res.json() as any;

    assert.ok(Array.isArray(data.detectedCards), 'detectedCards should be an array');
    assert.ok(data.detectedCards.length > 0, 'Should include at least one card');

    // Each card should be an object with name and orientation
    const firstCard = data.detectedCards[0];
    assert.ok(typeof firstCard === 'object', 'Card should be an object');
    assert.ok(typeof firstCard.name === 'string', 'Card should have a name string');
    assert.ok(typeof firstCard.orientation === 'string', 'Card should have an orientation string');
    assert.ok(['upright', 'reversed'].includes(firstCard.orientation), 'Orientation should be upright or reversed');

    assert.ok(typeof data.tarotReading === 'string' && data.tarotReading.length > 0, 'tarotReading should be a non-empty string');
    assert.ok(typeof data.horoscopeReading === 'string' && data.horoscopeReading.length > 0, 'horoscopeReading should be a non-empty string');
    assert.ok(typeof data.harmonizedReading === 'string' && data.harmonizedReading.length > 0, 'harmonizedReading should be a non-empty string');
  });

  await t.test('10. Readings: Generate Draft Requires Question and Horoscope', async () => {
    const res = await fetch(`${API_URL}/readings/generate-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ cards: ['The Sun'] }),
    });
    assert.strictEqual(res.status, 400, 'Should return 400 when question/horoscope are missing');
  });

  // ─── 4. Admin Flow ──────────────────────────────────────────────────────────
  await t.test('11. Admin: Login', async () => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rabbit@admin.com', password: 'admin123' }),
    });

    assert.strictEqual(res.status, 200, 'Admin should be able to log in');
    const data = await res.json() as any;
    assert.ok(data.token, 'Admin should receive a token');
    assert.strictEqual(data.user.role, 'admin', 'User role should be admin');
    adminToken = data.token;
  });

  await t.test('12. Admin: Get All Submissions', async () => {
    const res = await fetch(`${API_URL}/submissions/admin/all`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.status, 200, 'Admin should see all submissions');
    const data = await res.json() as any;
    assert.ok(Array.isArray(data), 'Should return an array');

    const testSub = data.find((s: any) => s.id === testSubmissionId);
    assert.ok(testSub, 'Should include the test submission');
    assert.ok(testSub.user, 'Each submission should include user info');
  });

  await t.test('13. Admin: Non-Admin Cannot Access All Submissions', async () => {
    const res = await fetch(`${API_URL}/submissions/admin/all`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.ok(res.status === 401 || res.status === 403, 'Non-admin should be rejected');
  });

  await t.test('14. Admin: Generate AI Reading for Submission', async () => {
    const res = await fetch(`${API_URL}/submissions/admin/${testSubmissionId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        cards: ['The Fool', 'The World'],
      }),
    });

    assert.strictEqual(res.status, 200, 'Should return 200 for generate');
    const data = await res.json() as any;

    assert.ok(Array.isArray(data.detectedCards), 'detectedCards should be an array');
    data.detectedCards.forEach((card: any) => {
      assert.ok(typeof card.name === 'string', 'Each card should have a name');
      assert.ok(typeof card.orientation === 'string', 'Each card should have orientation');
    });

    assert.ok(typeof data.tarotReading === 'string', 'Should include tarotReading');
    assert.ok(typeof data.horoscopeReading === 'string', 'Should include horoscopeReading');
    assert.ok(typeof data.harmonizedReading === 'string', 'Should include harmonizedReading');
  });

  await t.test('15. Admin: Save Reading to Database', async () => {
    const res = await fetch(`${API_URL}/submissions/admin/${testSubmissionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        tarotReading: 'The Fool represents new beginnings in your career journey.',
        astrologyReading: 'Aries energy aligns with your ambitions this season.',
        harmonisedReading: 'A combined reading pointing toward bold new opportunities.',
        detectedCards: [
          { name: 'The Fool', orientation: 'upright' },
          { name: 'The World', orientation: 'reversed' },
        ],
      }),
    });

    assert.strictEqual(res.status, 200, 'Should return 200 on save');
    const data = await res.json() as any;
    assert.ok(data.reading, 'Response should include reading object');
    assert.strictEqual(data.reading.tarotReading, 'The Fool represents new beginnings in your career journey.', 'Tarot reading should be saved');
    assert.strictEqual(data.reading.astrologyReading, 'Aries energy aligns with your ambitions this season.', 'Astrology reading should be saved');
    assert.ok(Array.isArray(data.reading.detectedCards), 'detectedCards should be present');
    assert.strictEqual(data.reading.detectedCards.length, 2, 'Both cards should be saved');

    // Verify orientation is stored
    const fool = data.reading.detectedCards.find((c: any) => c.name === 'The Fool');
    const world = data.reading.detectedCards.find((c: any) => c.name === 'The World');
    assert.ok(fool, 'The Fool should be saved');
    assert.strictEqual(fool.orientation, 'upright', 'The Fool should be upright');
    assert.ok(world, 'The World should be saved');
    assert.strictEqual(world.orientation, 'reversed', 'The World should be reversed');
  });

  await t.test('16. Submission: Verify Completed Status for Requester', async () => {
    const res = await fetch(`${API_URL}/submissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json() as any;
    const updated = data.find((s: any) => s.id === testSubmissionId);
    assert.ok(updated, 'Submission should still exist');
    assert.ok(updated.reading !== null, 'Submission should now have a reading');
    assert.strictEqual(updated.reading.harmonisedReading, 'A combined reading pointing toward bold new opportunities.', 'Harmonised reading should match');
  });

  // ─── 5. Feedback ────────────────────────────────────────────────────────────
  await t.test('17. Feedback: Submit Feedback', async () => {
    const res = await fetch(`${API_URL}/submissions/${testSubmissionId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating: 5, comment: 'Incredibly accurate reading!' }),
    });

    assert.ok([200, 201].includes(res.status), 'Should return success status');
    const data = await res.json() as any;
    assert.strictEqual(data.rating, 5, 'Rating should be 5');
    assert.strictEqual(data.comment, 'Incredibly accurate reading!', 'Comment should match');
  });

  await t.test('18. Feedback: Retrieve Feedback', async () => {
    const res = await fetch(`${API_URL}/submissions/${testSubmissionId}/feedback`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.status, 200, 'Should return 200');
    const data = await res.json() as any;
    assert.strictEqual(data.rating, 5, 'Stored rating should be 5');
  });

  await t.test('19. Feedback: Update Feedback', async () => {
    const res = await fetch(`${API_URL}/submissions/${testSubmissionId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating: 4, comment: 'Updated: very good!' }),
    });

    assert.ok([200, 201].includes(res.status), 'Should allow upsert');
    const data = await res.json() as any;
    assert.strictEqual(data.rating, 4, 'Rating should be updated to 4');
  });

  await t.test('20. Feedback: Reject Invalid Rating', async () => {
    const res = await fetch(`${API_URL}/submissions/${testSubmissionId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating: 6 }),
    });
    assert.strictEqual(res.status, 400, 'Rating above 5 should be rejected');
  });

  await t.test('21. Feedback: Delete Feedback', async () => {
    const res = await fetch(`${API_URL}/submissions/${testSubmissionId}/feedback`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 200, 'Should delete successfully');

    // Verify it's gone
    const getRes = await fetch(`${API_URL}/submissions/${testSubmissionId}/feedback`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await getRes.json() as any;
    assert.strictEqual(data, null, 'Feedback should be null after deletion');
  });

  // ─── 6. Users ───────────────────────────────────────────────────────────────
  await t.test('22. Users: Get Stats', async () => {
    const res = await fetch(`${API_URL}/users/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.status, 200, 'Should return 200');
    const data = await res.json() as any;
    assert.ok('totalReadings' in data, 'Should include totalReadings');
    assert.ok('recentReadings' in data, 'Should include recentReadings');
    assert.ok(data.totalReadings >= 1, 'Should count at least one submission');
  });

  await t.test('23. Health: Health Endpoint', async () => {
    const res = await fetch(`${API_URL}/health`);
    assert.strictEqual(res.status, 200, 'Health endpoint should return 200');
    const data = await res.json() as any;
    assert.strictEqual(data.status, 'ok', 'Status should be ok');
  });
});
