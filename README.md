# Bidboard

Bidboard is a local full-stack auction marketplace. Accounts, sessions, listings, bids, and watchlists are stored in SQLite. The database starts empty; listings appear after an account publishes them.

## Requirements

- Node.js 20.19 or newer
- npm

## Development

```sh
npm install
npm run dev
```

Vite serves the website at `http://localhost:5173` and proxies `/api` to the API server on port 3000. The SQLite database is created at `data/bidboard.sqlite`.

## Production

```sh
npm run build
NODE_ENV=production npm start
```

The Node server serves the built site and API on port 3000. Set `PORT` to change the port and `DB_PATH` to choose a different SQLite file. Back up the SQLite file to preserve account data.

## Checks

```sh
npm test
npm audit
```

Passwords are hashed server-side and sessions use HTTP-only cookies. Email verification, password recovery by email, payment processing, and public hosting are not configured; do not use this local app to accept real payments.
