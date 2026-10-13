# Task Tracking App

Screenshot tracking app for WorkTimeTracker EXE. Receives screenshots from the desktop agent and shows them in an admin panel. Does not connect to ERPNext.

## Tech Stack

- Next.js 14 (App Router)
- PostgreSQL (pg client, no Prisma)
- bcryptjs for password hashing
- jsonwebtoken for admin auth

## Features

- Admin login (email + password)
- Screenshot upload API (from EXE)
- Screenshot list with filters (employee, project, date)
- Click to view full screenshot
- Pagination

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - long random string for JWT signing
- `ADMIN_EMAIL` - admin email (default: milan.crayon@gmail.com)
- `ADMIN_PASSWORD` - strong password for initial admin

### 3. Initialize database

```bash
npm run db:init
```

This creates tables (admins, screenshots) and creates the admin user if not exists.

### 4. Run

Development:
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

## API Endpoints

### POST /api/auth/login

Login as admin.

Request:
```json
{
  "email": "milan.crayon@gmail.com",
  "password": "your-password"
}
```

Response:
```json
{
  "token": "jwt-token",
  "email": "milan.crayon@gmail.com"
}
```

### POST /api/screenshots

Upload a screenshot (from EXE, no auth required).

Request:
```json
{
  "employee_id": "HR-EMP-00002",
  "employee_name": "Jalpa",
  "project_id": "PROJ-0008",
  "project_name": "Rashmicabs",
  "task_id": "RCAB-00003",
  "captured_at": "2026-10-13T13:16:30Z",
  "image_base64": "data:image/png;base64,iVBOR..."
}
```

Response: 201 with saved screenshot.

### GET /api/screenshots

List screenshots (requires JWT auth via Authorization header or cookie).

Query params:
- `employee` - filter by employee name or ID
- `project` - filter by project name or ID
- `date_from` - YYYY-MM-DD
- `date_to` - YYYY-MM-DD
- `page` - page number (default 1)
- `limit` - items per page (default 20)

Response:
```json
{
  "screenshots": [...],
  "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

## Deploy on Coolify

1. Create a new service in Coolify (Dockerfile based)
2. Point to this repo / directory
3. Add a PostgreSQL service in Coolify (or use external DB)
4. Set environment variables:
   - `DATABASE_URL` - from Coolify PostgreSQL service
   - `JWT_SECRET` - generate a random string
   - `ADMIN_EMAIL` - milan.crayon@gmail.com
   - `ADMIN_PASSWORD` - strong password
5. Domain: taskapp.woodwolfdigital.com (or taskappbe.woodwolfdigital.com for API only)
6. After deploy, run `npm run db:init` once (via Coolify terminal or as a one-time job) to create tables and admin user
7. Port: 3000

## Database Schema

### admins
- id SERIAL PRIMARY KEY
- email VARCHAR(255) UNIQUE
- password_hash VARCHAR(255)
- created_at TIMESTAMP

### screenshots
- id UUID PRIMARY KEY
- employee_id VARCHAR(100)
- employee_name VARCHAR(255)
- project_id VARCHAR(100)
- project_name VARCHAR(255)
- task_id VARCHAR(100)
- captured_at TIMESTAMP
- image_url VARCHAR(500)
- created_at TIMESTAMP
