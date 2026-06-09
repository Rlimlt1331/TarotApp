import test from 'node:test';
import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';

const API_URL = 'http://localhost:3001/api';
const prisma = new PrismaClient();
let token = '';
let testUserId: number;

const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'password123';

test('Tarot App Regression Test Suite', async (t) => {
  
  // Cleanup hook
  t.after(async () => {
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } });
    }
    await prisma.$disconnect();
  });

  await t.test('1. Auth: User Signup', async () => {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: 'Test User'
      })
    });
    
    assert.strictEqual(res.status, 201, 'Should return 201 Created');
    const data = await res.json();
    assert.ok(data.token, 'Should return a JWT token');
    assert.ok(data.user, 'Should return user object');
    
    token = data.token;
    testUserId = data.user.id;
  });

  await t.test('2. Auth: User Login', async () => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      })
    });
    
    assert.strictEqual(res.status, 200, 'Should return 200 OK');
    const data = await res.json();
    assert.ok(data.token, 'Should return a JWT token on login');
    token = data.token; // Refresh token
  });

  await t.test('3. Existing Feature: Create Reading', async () => {
    const res = await fetch(`${API_URL}/readings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        cards: [
          { name: 'The Fool', position: 'Past' },
          { name: 'The Magician', position: 'Present' }
        ],
        title: 'My Regression Test Reading'
      })
    });

    assert.strictEqual(res.status, 201, 'Should return 201 Created');
    const data = await res.json();
    assert.strictEqual(data.title, 'My Regression Test Reading', 'Title should match');
    assert.ok(data.interpretation, 'Should have an interpretation generated');
    assert.strictEqual(data.cards.length, 2, 'Should save 2 cards');
  });

  await t.test('4. New Feature: Generate Advanced Reading Draft', async () => {
    const res = await fetch(`${API_URL}/readings/generate-draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        cards: ['The Sun', 'The Moon'],
        question: 'What is my regression test outcome?',
        horoscope: 'Aries'
      })
    });

    assert.strictEqual(res.status, 200, 'Should return 200 OK for draft generation');
    const data = await res.json();
    
    // Check for the expected keys returned by the new feature
    assert.ok(data.detectedCards, 'Should return detectedCards');
    assert.ok(Array.isArray(data.detectedCards), 'detectedCards should be an array');
    assert.ok(data.tarotReading, 'Should return tarotReading');
    assert.ok(data.horoscopeReading, 'Should return horoscopeReading');
    assert.ok(data.harmonizedReading, 'Should return harmonizedReading');
    
    // As Gemini API key might not be set in test environment, it might return the placeholders.
    // Either way, they must be truthy strings.
    assert.strictEqual(typeof data.tarotReading, 'string');
    assert.strictEqual(typeof data.horoscopeReading, 'string');
    assert.strictEqual(typeof data.harmonizedReading, 'string');
  });

});
