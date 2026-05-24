# Tarot Reading Portal - API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

All endpoints except `/auth/signup` and `/auth/login` require a Bearer token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Endpoints

### Authentication

#### Sign Up
Create a new user account.

**Request**
```
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe" (optional)
}
```

**Response** (201)
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Account created successfully"
}
```

**Errors**
- 400: Email and password are required
- 400: User already exists
- 500: Signup failed

---

#### Login
Authenticate and receive JWT token.

**Request**
```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response** (200)
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Login successful"
}
```

**Errors**
- 400: Email and password are required
- 401: Invalid credentials
- 500: Login failed

---

#### Verify Token
Check if token is valid and get user info.

**Request**
```
GET /auth/verify
Authorization: Bearer <token>
```

**Response** (200)
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  },
  "valid": true
}
```

**Errors**
- 401: No token provided
- 401: Invalid token

---

### Readings

#### Create Reading
Create a new tarot reading.

**Request**
```
POST /readings
Authorization: Bearer <token>
Content-Type: application/json

{
  "cards": [
    {
      "name": "The Fool",
      "position": "Past",
      "meaning": "New beginnings"
    },
    {
      "name": "The Magician",
      "position": "Present",
      "meaning": "Manifestation"
    }
  ],
  "interpretation": "A new journey is beginning with great potential",
  "title": "Career Reading" (optional)
}
```

**Response** (201)
```json
{
  "id": 1,
  "userId": 1,
  "title": "Career Reading",
  "interpretation": "A new journey is beginning with great potential",
  "cards": [
    {
      "id": 1,
      "readingId": 1,
      "name": "The Fool",
      "position": "Past",
      "meaning": "New beginnings",
      "createdAt": "2026-05-24T23:40:00Z"
    },
    {
      "id": 2,
      "readingId": 1,
      "name": "The Magician",
      "position": "Present",
      "meaning": "Manifestation",
      "createdAt": "2026-05-24T23:40:00Z"
    }
  ],
  "createdAt": "2026-05-24T23:40:00Z",
  "updatedAt": "2026-05-24T23:40:00Z"
}
```

**Errors**
- 400: Cards array is required
- 401: No token provided
- 500: Failed to create reading

---

#### Get All Readings
Retrieve all readings for the authenticated user.

**Request**
```
GET /readings
Authorization: Bearer <token>
```

**Response** (200)
```json
[
  {
    "id": 1,
    "userId": 1,
    "title": "Career Reading",
    "interpretation": "A new journey is beginning with great potential",
    "cards": [...],
    "createdAt": "2026-05-24T23:40:00Z",
    "updatedAt": "2026-05-24T23:40:00Z"
  },
  {
    "id": 2,
    "userId": 1,
    "title": "Love Reading",
    "interpretation": "...",
    "cards": [...],
    "createdAt": "2026-05-24T23:35:00Z",
    "updatedAt": "2026-05-24T23:35:00Z"
  }
]
```

**Errors**
- 401: No token provided
- 500: Failed to fetch readings

---

#### Get Single Reading
Retrieve a specific reading by ID.

**Request**
```
GET /readings/:id
Authorization: Bearer <token>
```

**Response** (200)
```json
{
  "id": 1,
  "userId": 1,
  "title": "Career Reading",
  "interpretation": "A new journey is beginning with great potential",
  "cards": [...],
  "createdAt": "2026-05-24T23:40:00Z",
  "updatedAt": "2026-05-24T23:40:00Z"
}
```

**Errors**
- 401: No token provided
- 403: Unauthorized (reading belongs to another user)
- 404: Reading not found
- 500: Failed to fetch reading

---

#### Update Reading
Update an existing reading.

**Request**
```
PUT /readings/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Career Reading",
  "interpretation": "Updated interpretation..."
}
```

**Response** (200)
```json
{
  "id": 1,
  "userId": 1,
  "title": "Updated Career Reading",
  "interpretation": "Updated interpretation...",
  "cards": [...],
  "createdAt": "2026-05-24T23:40:00Z",
  "updatedAt": "2026-05-24T23:45:00Z"
}
```

**Errors**
- 401: No token provided
- 403: Unauthorized
- 404: Reading not found
- 500: Failed to update reading

---

#### Delete Reading
Delete a reading.

**Request**
```
DELETE /readings/:id
Authorization: Bearer <token>
```

**Response** (200)
```json
{
  "message": "Reading deleted successfully"
}
```

**Errors**
- 401: No token provided
- 403: Unauthorized
- 404: Reading not found
- 500: Failed to delete reading

---

### Users

#### Get Profile
Retrieve user profile information.

**Request**
```
GET /users/profile
Authorization: Bearer <token>
```

**Response** (200)
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2026-05-24T23:00:00Z",
  "preferences": {
    "id": 1,
    "userId": 1,
    "theme": "dark",
    "language": "en",
    "createdAt": "2026-05-24T23:00:00Z",
    "updatedAt": "2026-05-24T23:00:00Z"
  }
}
```

**Errors**
- 401: No token provided
- 404: User not found
- 500: Failed to fetch profile

---

#### Update Profile
Update user profile information.

**Request**
```
PUT /users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jane Doe"
}
```

**Response** (200)
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "Jane Doe",
  "createdAt": "2026-05-24T23:00:00Z"
}
```

**Errors**
- 401: No token provided
- 500: Failed to update profile

---

#### Get Preferences
Retrieve user preferences.

**Request**
```
GET /users/preferences
Authorization: Bearer <token>
```

**Response** (200)
```json
{
  "id": 1,
  "userId": 1,
  "theme": "dark",
  "language": "en",
  "createdAt": "2026-05-24T23:00:00Z",
  "updatedAt": "2026-05-24T23:00:00Z"
}
```

**Errors**
- 401: No token provided
- 500: Failed to fetch preferences

---

#### Update Preferences
Update user preferences.

**Request**
```
PUT /users/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "theme": "light",
  "language": "es"
}
```

**Response** (200)
```json
{
  "id": 1,
  "userId": 1,
  "theme": "light",
  "language": "es",
  "createdAt": "2026-05-24T23:00:00Z",
  "updatedAt": "2026-05-24T23:05:00Z"
}
```

**Errors**
- 401: No token provided
- 500: Failed to update preferences

---

#### Get Statistics
Retrieve user statistics.

**Request**
```
GET /users/stats
Authorization: Bearer <token>
```

**Response** (200)
```json
{
  "totalReadings": 5,
  "recentReadings": [
    {
      "id": 5,
      "title": "Latest Reading",
      "createdAt": "2026-05-24T23:40:00Z"
    },
    {
      "id": 4,
      "title": "Previous Reading",
      "createdAt": "2026-05-24T23:35:00Z"
    }
  ]
}
```

**Errors**
- 401: No token provided
- 500: Failed to fetch statistics

---

## Error Response Format

All errors follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad request (missing/invalid data)
- 401: Unauthorized (missing/invalid token)
- 403: Forbidden (permission denied)
- 404: Not found
- 500: Server error

---

## Example Client Usage

### JavaScript/TypeScript

```typescript
// Login
const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { token } = await loginResponse.json();

// Create reading
const readingResponse = await fetch('http://localhost:3000/api/readings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    cards: [
      { name: 'The Fool', position: 'Past', meaning: 'New beginnings' },
      { name: 'The Magician', position: 'Present', meaning: 'Manifestation' }
    ],
    interpretation: 'Your reading interpretation',
    title: 'My Reading'
  })
});

const reading = await readingResponse.json();
console.log(reading);
```

### Using the API Client (in this project)

```typescript
import { apiClient } from '@/lib/api-client';

// Login
const { token, user } = await apiClient.login('user@example.com', 'password123');

// Create reading
const reading = await apiClient.createReading(
  [
    { name: 'The Fool', position: 'Past', meaning: 'New beginnings' },
    { name: 'The Magician', position: 'Present', meaning: 'Manifestation' }
  ],
  'Your interpretation',
  'My Reading'
);

// Get user profile
const profile = await apiClient.getProfile();
```

---

## Rate Limiting

Currently, there is no rate limiting implemented. This should be added for production.

---

## CORS

CORS is configured to allow requests from `FRONTEND_URL` environment variable. Update this when deploying to production.

---

Last updated: 2026-05-24
