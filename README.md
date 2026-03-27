# EWCComm25 Medicaid Dashboard

A full-stack dashboard for the EWCComm25 annual Medicaid program. It supports staff authentication, beneficiary registration, onboarding, bio data capture, and analytics.

## Stack
- React (Vite)
- Express
- PostgreSQL

## Project Structure
- `client` React UI
- `server` Express API
- `db` SQL schema and seed

## Local Setup
1. Create a Postgres database (example uses `ewc_medicaid`).
2. Apply the schema and seed files:
   - `db/schema.sql`
   - `db/seed.sql`
3. Copy `.env.example` to `.env` in both `client` and `server`.
4. Install dependencies and start dev servers.

## Deployment Prep
- Deploy the `server` app first and point it to a managed PostgreSQL database.
- Set production env vars for the server:
  - `NODE_ENV=production`
  - `DATABASE_URL`
  - `DATABASE_SSL=true` for most managed cloud databases
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
  - `CORS_ORIGIN=https://your-frontend-domain.com`
- Build the `client` with `VITE_API_URL` pointing to the deployed backend, for example:
  - `VITE_API_URL=https://api.your-domain.com`
- The frontend, future desktop app, and any admin clients should all talk to the same hosted API.

## Scripts (suggested)
- `server`:
  - `npm run dev`
  - `npm start`
  - `npm run migrate`
- `client`:
  - `npm run dev`
  - `npm run build`

## Notes
- First staff user can be created when there are no users in the database.
- Update role-based access in `server/src/middleware/auth.js` as needed.
- Production startup now requires explicit server secrets and CORS configuration.
