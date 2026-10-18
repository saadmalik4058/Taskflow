# TaskFlow API

A REST API for managing projects and tasks, built with Node.js, Express 5 and MongoDB.
It provides token-based authentication, per-user data isolation, input validation,
rate limiting and a full integration test suite.

---

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (CommonJS) |
| Web framework | Express 5 |
| Database | MongoDB with Mongoose 9 |
| Validation | Zod 4 |
| Auth | JSON Web Tokens (`jsonwebtoken`) + `bcrypt` password hashing |
| Security | `helmet`, `cors`, `express-rate-limit` |
| Testing | Jest + Supertest + `mongodb-memory-server` |

---

## Requirements

- **Node.js 18 or newer** (developed on Node 24)
- **MongoDB** running locally, or a connection string to a hosted cluster

You do **not** need MongoDB installed to run the tests — the test suite starts its
own throwaway in-memory database.

---

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file from the template
cp .env.example .env        # Windows: copy .env.example .env

# 3. Open .env and set MONGO_URI and JWT_SECRET
#    Generate a strong secret with:
#    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. Start the development server (auto-restarts on file changes)
npm run dev
```

The API is then available at `http://localhost:3000`.

---

## Available scripts

| Script | What it does |
|---|---|
| `npm start` | Runs the server once (`node src/server.js`). Used in production. |
| `npm run dev` | Runs the server with `nodemon`, restarting on changes. |
| `npm test` | Runs the full Jest test suite once. |
| `npm run test:watch` | Runs Jest in watch mode. |

---

## Environment variables

Copy `.env.example` to `.env`. Only two variables are genuinely required.

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_URI` | **yes** | – | MongoDB connection string. |
| `JWT_SECRET` | **yes** | – | Secret used to sign tokens. Changing it invalidates all existing tokens. |
| `PORT` | no | `3000` | Port the API listens on. |
| `NODE_ENV` | no | `development` | `development`, `test` or `production`. |
| `CLIENT_URLS` | no | Local dev origins | Comma-separated CORS allow-list, e.g. `https://taskflow.vercel.app`. Use `*` to allow all (testing only). |
| `RATE_LIMIT_WINDOW_MS` | no | `900000` | Rate-limit window in milliseconds (15 minutes). |
| `RATE_LIMIT_MAX` | no | `500` | Max requests per window, all routes. |
| `AUTH_RATE_LIMIT_MAX` | no | `20` | Max **failed** requests per window for `/register` and `/login`. Successful logins cost nothing. |

`.env` is git-ignored. `.env.example` is the committed, secret-free template.

---

## API reference

**Base URL:** `http://localhost:3000`

### Authentication

Protected endpoints expect a Bearer token:

```
Authorization: Bearer <token>
```

Get a token from `POST /login`. Tokens expire after **1 hour**. The payload is
`{ id, username, role }`.

Roles are `user` and `admin`. A new account is always `user` — the `role` field is
stripped from `POST /register`, so nobody can promote themselves.

### Response format

Endpoints return JSON. List endpoints return their own wrapper rather than a
generic envelope; for example `GET /projects` returns `{ "projects": [...] }` and
`GET /tasks` returns pagination fields alongside `tasks`.

### Errors

Every failed request includes a human-readable `message`:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "password", "message": "Password must be at least 8 characters long" }
  ]
}
```

Validation failures (400) and unexpected errors carry `success: false` and, for
validation, a per-field `errors` array. Business errors returned directly by a
controller (401, 403, 404 such as `"Project not found"`) contain `message` only.

| Status | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Validation failed / bad input |
| 401 | Missing, invalid or expired token |
| 403 | Authenticated but not allowed |
| 404 | Resource not found |
| 413 | Request body too large |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |

### Endpoints

**Auth**

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | – | Create an account. |
| `POST` | `/login` | – | Exchange credentials for a token. |
| `GET` | `/profile` | user | Return the decoded token payload. |
| `GET` | `/users` | **admin** | List all users (passwords excluded). |

**Projects**

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/projects` | user | Create a project. |
| `GET` | `/projects` | user | List your projects. |
| `GET` | `/projects/:id` | owner | Get one project. |
| `PUT` | `/projects/:id` | owner | Update `name` and/or `description`. |
| `DELETE` | `/projects/:id` | owner | Delete a project **and all of its tasks**. |

**Tasks**

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/tasks` | owner of `project` | Create a task. |
| `GET` | `/tasks` | user | List your tasks (filter, search, sort, paginate). |
| `GET` | `/tasks/:id` | owner | Get one task. |
| `PUT` | `/tasks/:id` | owner | Update a task. |
| `DELETE` | `/tasks/:id` | owner | Delete a task. |

#### Query parameters for `GET /tasks`

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `status` | enum | – | `pending`, `in-progress`, `completed` |
| `priority` | enum | – | `low`, `medium`, `high` |
| `search` | string | – | Case-insensitive match on title and description. Regex characters are treated as plain text. |
| `page` | integer | `1` | Must be 1 or greater. |
| `limit` | integer | `10` | 1–100. |
| `sortBy` | enum | `createdAt` | `createdAt`, `updatedAt`, `title`, `dueDate`, `priority` |
| `order` | enum | `desc` | `asc` or `desc` |

#### Field notes

- Task `status` defaults to `pending`; `priority` defaults to `medium`.
- `assignedTo` accepts a user id, or `null` on update to **unassign**.
- A task cannot be moved to a different project after creation.
- Unknown fields are silently stripped (mass-assignment protection), so a client
  can never set `createdBy` or `role`.

### Examples

**Register**

```http
POST /register
Content-Type: application/json

{ "username": "saad", "email": "saad@example.com", "password": "password123" }
```

```json
{
  "message": "User registered successfully",
  "user": { "id": "6650...", "username": "saad", "email": "saad@example.com", "role": "user" }
}
```

**Login**

```http
POST /login
Content-Type: application/json

{ "email": "saad@example.com", "password": "password123" }
```

```json
{ "message": "Login successful", "token": "eyJhbGciOi..." }
```

**Create a project**

```http
POST /projects
Authorization: Bearer <token>
Content-Type: application/json

{ "name": "Website redesign", "description": "Q3 work" }
```

**Create a task**

```http
POST /tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Design the landing page",
  "project": "<project id>",
  "priority": "high",
  "dueDate": "2026-11-30"
}
```

**List tasks**

```http
GET /tasks?status=pending&search=landing&sortBy=dueDate&order=asc&page=1&limit=10
Authorization: Bearer <token>
```

```json
{
  "totalTasks": 1,
  "currentPage": 1,
  "totalPages": 1,
  "pageSize": 10,
  "tasks": [ { "_id": "...", "title": "Design the landing page", "status": "pending" } ]
}
```

---

## Testing

```bash
npm test
```

83 integration tests cover authentication, authorization, ownership, project and
task CRUD, validation, pagination and cascade deletion.

The suite uses `mongodb-memory-server`, which starts a real MongoDB instance on a
random port with a temporary data directory. Two consequences worth knowing:

- Your development database is never touched, and no local MongoDB is required.
- Every test file gets a clean database, so tests never interfere with each other.

Rate limiters are disabled automatically when `NODE_ENV=test`, because a suite
that deliberately sends dozens of failing requests would otherwise trip the
20-attempt auth limit. The limiters themselves are verified manually.

---

## Project structure

```
src/
  app.js                  Express app (middleware + route wiring), exported for tests
  server.js               Entry point: loads .env, connects to MongoDB, listens
  config/
    cors.js               CORS allow-list, driven by CLIENT_URLS
    database.js           Mongoose connection
  controllers/            Request handlers (no try/catch - Express 5 forwards errors)
  middleware/
    auth.js               Verifies the Bearer token, attaches req.user
    authorize.js          Role check, e.g. authorize("admin")
    validate.js           Runs a Zod schema against body / params / query
    errorHandler.js       notFound (404) and the final error handler
    rateLimiters.js       generalLimiter + authLimiter
  models/                 Mongoose schemas (User, Project, Task)
  routes/                 Route definitions
  utils/generateToken.js  Signs a JWT for a user
  validators/             Zod schemas and shared field rules
tests/
  setupEnv.js             Test-only environment variables
  setupDb.js              In-memory MongoDB lifecycle
  helpers/index.js        register / login / createProject / createTask helpers
  *.test.js               One file per area
```

---

## Security notes

- Passwords are hashed with `bcrypt` (cost 10) and never returned by any endpoint.
- `POST /register` strips `role`, so accounts cannot self-promote to admin.
- Login returns the same message for an unknown email and a wrong password, which
  prevents account enumeration.
- `helmet` sets protective headers and removes `X-Powered-By`.
- Search input is regex-escaped, so a query cannot inject a pattern.
- Rate limiting is applied globally and more strictly to authentication routes.
- Ownership is checked on every project and task operation, so authenticated users
  cannot read or modify each other's data.

---

## Known limitations

- `GET /tasks` returns only tasks you **created**. A task assigned to you by
  someone else is not listed (and reading it directly returns 403). This is a
  data-model decision that is still open.
- `GET /projects` and `GET /users` return all rows with no pagination.
- `GET /profile` echoes the token payload rather than reading the user from the
  database, so it can be stale until the token expires.
- There is no refresh token or logout endpoint; tokens simply expire after 1 hour.
- Roles live inside the token, so changing a user's role does not affect tokens
  that were already issued.
