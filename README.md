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

## Scripts (suggested)
- `server`:
  - `npm run dev`
  - `npm start`
- `client`:
  - `npm run dev`
  - `npm run build`

## Notes
- First staff user can be created when there are no users in the database.
- Update role-based access in `server/src/middleware/auth.js` as needed.
