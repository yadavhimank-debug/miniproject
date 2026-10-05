import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

export function createDatabase(databasePath = path.resolve('data/bidboard.sqlite')) {
  if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  }

  const database = new Database(databasePath)
  database.pragma('foreign_keys = ON')
  if (databasePath !== ':memory:') database.pragma('journal_mode = WAL')

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auctions (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      starting_price INTEGER NOT NULL CHECK (starting_price > 0),
      current_price INTEGER NOT NULL CHECK (current_price > 0),
      bid_increment INTEGER NOT NULL CHECK (bid_increment > 0),
      image_url TEXT NOT NULL DEFAULT '',
      ends_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auction_id TEXT NOT NULL REFERENCES auctions(id),
      bidder_id TEXT NOT NULL REFERENCES users(id),
      amount INTEGER NOT NULL CHECK (amount > 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      auction_id TEXT NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, auction_id)
    );

    CREATE INDEX IF NOT EXISTS auctions_active_ends_at ON auctions(status, ends_at);
    CREATE INDEX IF NOT EXISTS auctions_seller ON auctions(seller_id, created_at);
    CREATE INDEX IF NOT EXISTS bids_auction_created ON bids(auction_id, id DESC);
    CREATE INDEX IF NOT EXISTS bids_bidder_created ON bids(bidder_id, id DESC);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
  `)

  return database
}