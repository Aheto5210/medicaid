# AGENTS.md - Agentic Coding Guidelines

This file provides guidelines for agents working on the EWCComm25 Medicaid Dashboard codebase.

## Project Overview

- **Stack**: React (Vite) + Express + PostgreSQL
- **Structure**: Monorepo with `client/` and `server/` directories
- **Module System**: ES modules (`.js` files use `"type": "module"`)

---

## Build / Run Commands

### Root Commands
```bash
npm run dev:client   # Start client dev server (port 5173)
npm run dev:server   # Start server dev server (nodemon)
```

### Server Commands (in `server/`)
```bash
npm run dev          # Start with nodemon on port 3001
npm run start        # Start production server
npm run migrate      # Run database migrations
```

### Client Commands (in `client/`)
```bash
npm run dev          # Start Vite dev server (port 5173)
npm run build        # Production build
npm run preview      # Preview production build
```

### Running a Single Test
No test framework is currently configured. When adding tests, use:
- **Jest** for server-side JavaScript testing
- **Vitest** or **Jest** for React client testing
- Run individual tests with: `npm test -- --testPathPattern=filename`

---

## Code Style Guidelines

### General Principles
- Use **ES modules** (`import`/`export`) throughout
- Prefer **async/await** over raw Promises
- Use **const** by default, **let** only when reassignment is needed
- Avoid **var** entirely

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (server) | kebab-case | `auth-middleware.js` |
| Files (client) | PascalCase | `DashboardPage.jsx` |
| Variables/Functions | camelCase | `loadPeople`, `userData` |
| Components (React) | PascalCase | `DashboardPage`, `PeopleTable` |
| Database Tables | snake_case | `people`, `nhis_registrations` |
| Database Columns | snake_case | `first_name`, `registration_date` |
| API Routes | kebab-case | `/api/people`, `/api/nhis` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_PAGE_SIZE` |
| React Props | camelCase | `onSave`, `userData` |

### Import Order (Server & Client)

1. Node/built-in modules
2. External packages
3. Local modules (relative paths)

```javascript
// Server example
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { cleanedText } from '../utils/text.js';
```

### JavaScript Patterns

#### Server Routes
- Use Express Router pattern (`express.Router()`)
- Apply auth middleware at route level: `router.use(requireAuth)`
- Use permission middleware for authorization: `requirePermission('module', 'action')`
- Always return JSON responses with appropriate HTTP status codes

```javascript
router.get('/', requirePermission('module', 'view'), async (req, res) => {
  try {
    const result = await query('SELECT * FROM table', []);
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});
```

#### React Components
- Use functional components with hooks
- Use `useMemo` for expensive computations
- Use `useCallback` for functions passed as props
- Destructure props for clarity
- Co-locate styles with components when possible

```javascript
export default function PeoplePage({ people, onRefresh }) {
  const [search, setSearch] = useState('');

  const filteredPeople = useMemo(
    () => people.filter(p => p.first_name.includes(search)),
    [people, search]
  );

  return (/* JSX */);
}
```

### Error Handling

#### Server
- Use try/catch for all async database operations
- Log errors with `console.error(err)` before returning 500
- Return meaningful error messages: `{ message: 'Human readable error' }`
- Use appropriate HTTP status codes:
  - `400` - Bad request / validation error
  - `401` - Unauthorized
  - `403` - Forbidden (permission denied)
  - `404` - Not found
  - `409` - Conflict (duplicate)
  - `500` - Server error

```javascript
// Global error middleware (in index.js)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});
```

#### Client
- Handle API errors gracefully with user feedback
- Use toast notifications for transient errors
- Show loading states during async operations

### Database Patterns

- Use parameterized queries to prevent SQL injection
- Use `async/await` with proper error handling
- Use `LIMIT` for queries that could return many rows
- Use snake_case for all column names in queries

```javascript
const result = await query(
  'SELECT id, first_name FROM people WHERE program_year = $1 LIMIT 50',
  [year]
);
```

### React Component Structure

1. Imports (React, hooks, components, utilities)
2. Component definition
3. State declarations
4. Memoized values (useMemo, useCallback)
5. Effects (useEffect)
6. Event handlers
7. Render (return JSX)

### File Organization

```
server/src/
  config.js          # Configuration
  db.js              # Database connection
  index.js           # Express app entry
  middleware/
    auth.js          # Authentication & permissions
  routes/
    auth.js          # Auth endpoints
    people.js        # People CRUD
  utils/
    text.js          # Text utilities
    roles.js         # Role utilities

client/src/
  main.jsx           # Entry point
  App.jsx            # Root component
  api.js             # API utilities
  constants/
    options.js       # Constants
  components/
    layout/          # Layout components
    common/          # Shared components
    people/          # People-related
  pages/             # Page components
  utils/
    permissions.js   # Permission utilities
    theme.js         # Theme utilities
```

---

## Database

- PostgreSQL is used as the database
- Schema is in `db/schema.sql`
- Seed data in `db/seed.sql`
- Run migrations with: `npm run migrate` in server directory

---

## Environment Variables

### Server (`.env`)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/ewc_medicaid
JWT_ACCESS_SECRET=your-secret
JWT_REFRESH_SECRET=your-secret
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

### Client (`.env`)
```
VITE_API_URL=http://localhost:3001
```

---

## Notes

- No test framework is currently configured
- No linting (ESLint) is configured
- First admin user can be created when the users table is empty
- Role-based access is managed in `server/src/middleware/auth.js`
