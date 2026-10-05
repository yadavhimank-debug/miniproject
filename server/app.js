import path from 'node:path'
import { randomBytes, randomUUID, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import cookieParser from 'cookie-parser'
import express from 'express'
import { rateLimit } from 'express-rate-limit'

const scrypt = promisify(scryptCallback)
const sessionCookieName = 'bidboard_session'
const sessionDurationMs = 1000 * 60 * 60 * 24 * 30
const passwordMinimumLength = 10
const categories = new Set(['DESIGN', 'TIMEPIECES', 'PHOTOGRAPHY', 'COLLECTIBLES'])

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt, 64)
  return `${salt}:${derivedKey.toString('hex')}`
}

async function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) return false
  const storedKey = Buffer.from(hash, 'hex')
  const candidateKey = await scrypt(password, salt, storedKey.length)
  return storedKey.length === candidateKey.length && timingSafeEqual(storedKey, candidateKey)
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    initials: user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join(''),
    createdAt: user.created_at,
  }
}

function readAuction(database, auctionId, userId = '') {
  return database.prepare(`
    SELECT auctions.*, users.name AS seller_name,
      (SELECT COUNT(*) FROM bids WHERE bids.auction_id = auctions.id) AS bid_count,
      EXISTS(
        SELECT 1 FROM watchlist
        WHERE watchlist.auction_id = auctions.id AND watchlist.user_id = ?
      ) AS watched
    FROM auctions
    JOIN users ON users.id = auctions.seller_id
    WHERE auctions.id = ?
  `).get(userId, auctionId)
}

function publicAuction(auction) {
  return {
    id: auction.id,
    title: auction.title,
    category: auction.category,
    seller: auction.seller_name,
    sellerId: auction.seller_id,
    startingPrice: auction.starting_price,
    price: auction.current_price,
    bidIncrement: auction.bid_increment,
    bids: auction.bid_count,
    endsAt: auction.ends_at,
    image: auction.image_url || '',
    watched: Boolean(auction.watched),
    status: auction.status === 'active' && auction.ends_at <= Date.now() ? 'ended' : auction.status,
    createdAt: auction.created_at,
  }
}

function issueSession(database, response, userId, rememberMe, isProduction) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashSessionToken(token)
  const expiresAt = Date.now() + sessionDurationMs

  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
  database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash, userId, expiresAt)

  response.cookie(sessionCookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    ...(rememberMe ? { maxAge: sessionDurationMs } : {}),
  })
}

function requireAuth(request, response, next) {
  if (!request.user) {
    response.status(401).json({ error: 'Sign in to continue.' })
    return
  }
  next()
}

export function createApp(database, {
  isProduction = process.env.NODE_ENV === 'production',
  serveWeb = isProduction,
  publicDirectory = path.resolve('dist'),
} = {}) {
  const app = express()

  app.disable('x-powered-by')
  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('X-Frame-Options', 'DENY')
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    next()
  })
  app.use(express.json({ limit: '20kb' }))
  app.use(cookieParser())
  app.use('/api', (request, response, next) => {
    response.setHeader('Cache-Control', 'no-store')
    next()
  })
  app.use('/api', (request, response, next) => {
    const token = request.cookies[sessionCookieName]
    if (token) {
      const tokenHash = hashSessionToken(token)
      const session = database.prepare(`
        SELECT users.* FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ? AND sessions.expires_at > ?
      `).get(tokenHash, Date.now())
      if (session) {
        request.user = publicUser(session)
        request.sessionTokenHash = tokenHash
      } else {
        database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
      }
    }
    next()
  })

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false,
  })

  app.get('/api/health', (request, response) => response.json({ status: 'ok' }))

  app.post('/api/auth/register', authLimiter, async (request, response) => {
    const name = String(request.body?.name || '').trim()
    const email = String(request.body?.email || '').trim().toLowerCase()
    const password = String(request.body?.password || '')

    if (name.length < 2 || name.length > 80) {
      throw new HttpError(400, 'Enter a name between 2 and 80 characters.')
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, 'Enter a valid email address.')
    }
    if (password.length < passwordMinimumLength || password.length > 128) {
      throw new HttpError(400, `Password must be between ${passwordMinimumLength} and 128 characters.`)
    }

    const userId = randomUUID()
    const passwordHash = await hashPassword(password)
    try {
      database.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)')
        .run(userId, name, email, passwordHash)
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new HttpError(409, 'An account with that email already exists.')
      }
      throw error
    }

    const user = database.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    issueSession(database, response, userId, true, isProduction)
    response.status(201).json({ user: publicUser(user), message: 'Your account is ready.' })
  })

  app.post('/api/auth/login', authLimiter, async (request, response) => {
    const email = String(request.body?.email || '').trim().toLowerCase()
    const password = String(request.body?.password || '')
    const user = database.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw new HttpError(401, 'Invalid email or password.')
    }

    issueSession(database, response, user.id, Boolean(request.body?.rememberMe), isProduction)
    response.json({ user: publicUser(user), message: `Welcome back, ${user.name.split(/\s+/)[0]}.` })
  })

  app.post('/api/auth/logout', (request, response) => {
    if (request.sessionTokenHash) {
      database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(request.sessionTokenHash)
    }
    response.clearCookie(sessionCookieName, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    })
    response.json({ message: 'You have been signed out.' })
  })

  app.get('/api/auth/me', (request, response) => response.json({ user: request.user || null }))

  app.put('/api/auth/password', requireAuth, async (request, response) => {
    const currentPassword = String(request.body?.currentPassword || '')
    const newPassword = String(request.body?.newPassword || '')
    const user = database.prepare('SELECT * FROM users WHERE id = ?').get(request.user.id)

    if (!currentPassword || !(await verifyPassword(currentPassword, user.password_hash))) {
      throw new HttpError(400, 'Current password is incorrect.')
    }
    if (newPassword.length < passwordMinimumLength || newPassword.length > 128) {
      throw new HttpError(400, `New password must be between ${passwordMinimumLength} and 128 characters.`)
    }

    database.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(await hashPassword(newPassword), request.user.id)
    database.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?')
      .run(request.user.id, request.sessionTokenHash)
    response.json({ message: 'Password changed successfully.' })
  })

  app.get('/api/auctions', (request, response) => {
    const auctions = database.prepare(`
      SELECT auctions.*, users.name AS seller_name,
        (SELECT COUNT(*) FROM bids WHERE bids.auction_id = auctions.id) AS bid_count,
        EXISTS(
          SELECT 1 FROM watchlist
          WHERE watchlist.auction_id = auctions.id AND watchlist.user_id = ?
        ) AS watched
      FROM auctions
      JOIN users ON users.id = auctions.seller_id
      WHERE auctions.status = 'active' AND auctions.ends_at > ?
      ORDER BY auctions.ends_at ASC
    `).all(request.user?.id || '', Date.now())
    response.json({ auctions: auctions.map(publicAuction) })
  })

  app.get('/api/auctions/:auctionId/bids', (request, response) => {
    const auction = database.prepare('SELECT id FROM auctions WHERE id = ?').get(request.params.auctionId)
    if (!auction) throw new HttpError(404, 'Auction not found.')
    const bids = database.prepare(`
      SELECT bids.id, bids.amount, bids.created_at, users.name AS bidder_name
      FROM bids
      JOIN users ON users.id = bids.bidder_id
      WHERE bids.auction_id = ?
      ORDER BY bids.id DESC
      LIMIT 50
    `).all(request.params.auctionId)
    response.json({ bids: bids.map((bid) => ({
      id: bid.id,
      bidder: bid.bidder_name,
      amount: bid.amount,
      time: bid.created_at,
    })) })
  })

  app.get('/api/me/listings', requireAuth, (request, response) => {
    const listings = database.prepare(`
      SELECT auctions.*, users.name AS seller_name,
        (SELECT COUNT(*) FROM bids WHERE bids.auction_id = auctions.id) AS bid_count,
        EXISTS(
          SELECT 1 FROM watchlist
          WHERE watchlist.auction_id = auctions.id AND watchlist.user_id = ?
        ) AS watched
      FROM auctions
      JOIN users ON users.id = auctions.seller_id
      WHERE auctions.seller_id = ?
      ORDER BY auctions.created_at DESC
    `).all(request.user.id, request.user.id)
    response.json({ listings: listings.map(publicAuction) })
  })

  app.get('/api/me/bids', requireAuth, (request, response) => {
    const bids = database.prepare(`
      SELECT bids.id, bids.auction_id, bids.amount, bids.created_at,
        auctions.title, auctions.current_price
      FROM bids
      JOIN auctions ON auctions.id = bids.auction_id
      WHERE bids.bidder_id = ?
      ORDER BY bids.id DESC
    `).all(request.user.id)
    response.json({ bids: bids.map((bid) => ({
      id: bid.id,
      auctionId: bid.auction_id,
      title: bid.title,
      amount: bid.amount,
      currentPrice: bid.current_price,
      time: bid.created_at,
    })) })
  })

  app.get('/api/me/notifications', requireAuth, (request, response) => {
    const notifications = database.prepare(`
      SELECT bids.id, bids.amount, bids.created_at, auctions.title,
        CASE WHEN bids.bidder_id = ? THEN 'placed' ELSE 'received' END AS kind
      FROM bids
      JOIN auctions ON auctions.id = bids.auction_id
      WHERE bids.bidder_id = ? OR auctions.seller_id = ?
      ORDER BY bids.id DESC
      LIMIT 30
    `).all(request.user.id, request.user.id, request.user.id)
    response.json({ notifications: notifications.map((item) => ({
      id: item.id,
      message: item.kind === 'placed'
        ? `Your bid of $${item.amount.toLocaleString()} was recorded on ${item.title}.`
        : `Your listing ${item.title} received a $${item.amount.toLocaleString()} bid.`,
      time: item.created_at,
    })) })
  })

  app.get('/api/me/watchlist', requireAuth, (request, response) => {
    const auctions = database.prepare(`
      SELECT auctions.*, users.name AS seller_name,
        (SELECT COUNT(*) FROM bids WHERE bids.auction_id = auctions.id) AS bid_count,
        1 AS watched
      FROM watchlist
      JOIN auctions ON auctions.id = watchlist.auction_id
      JOIN users ON users.id = auctions.seller_id
      WHERE watchlist.user_id = ? AND auctions.status = 'active' AND auctions.ends_at > ?
      ORDER BY watchlist.created_at DESC
    `).all(request.user.id, Date.now())
    response.json({ auctions: auctions.map(publicAuction) })
  })

  app.post('/api/auctions', requireAuth, (request, response) => {
    const title = String(request.body?.title || '').trim()
    const category = String(request.body?.category || '').trim().toUpperCase()
    const startingPrice = Number(request.body?.startingPrice)
    const bidIncrement = Number(request.body?.bidIncrement)
    const durationHours = Number(request.body?.durationHours || 72)
    const imageUrl = String(request.body?.imageUrl || '').trim()

    if (title.length < 3 || title.length > 120) throw new HttpError(400, 'Title must be between 3 and 120 characters.')
    if (!categories.has(category)) throw new HttpError(400, 'Choose a supported category.')
    if (!Number.isSafeInteger(startingPrice) || startingPrice < 1 || startingPrice > 100000000) {
      throw new HttpError(400, 'Starting price must be a whole number greater than zero.')
    }
    if (!Number.isSafeInteger(bidIncrement) || bidIncrement < 1 || bidIncrement > 10000000) {
      throw new HttpError(400, 'Bid increment must be a whole number greater than zero.')
    }
    if (!Number.isSafeInteger(durationHours) || durationHours < 1 || durationHours > 720) {
      throw new HttpError(400, 'Auction duration must be between 1 hour and 30 days.')
    }
    if (imageUrl) {
      try {
        if (new URL(imageUrl).protocol !== 'https:') throw new Error('Invalid protocol')
      } catch {
        throw new HttpError(400, 'Image URL must use HTTPS.')
      }
    }

    const id = randomUUID()
    const endsAt = Date.now() + durationHours * 60 * 60 * 1000
    database.prepare(`
      INSERT INTO auctions
        (id, seller_id, title, category, starting_price, current_price, bid_increment, ends_at, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, request.user.id, title, category, startingPrice, startingPrice, bidIncrement, endsAt, imageUrl)

    response.status(201).json({ auction: publicAuction(readAuction(database, id, request.user.id)) })
  })

  app.post('/api/auctions/:auctionId/watchlist', requireAuth, (request, response) => {
    const auction = database.prepare('SELECT id FROM auctions WHERE id = ? AND status = \'active\'')
      .get(request.params.auctionId)
    if (!auction) throw new HttpError(404, 'Auction not found.')
    database.prepare('INSERT OR IGNORE INTO watchlist (user_id, auction_id) VALUES (?, ?)')
      .run(request.user.id, auction.id)
    response.json({ watched: true })
  })

  app.delete('/api/auctions/:auctionId/watchlist', requireAuth, (request, response) => {
    database.prepare('DELETE FROM watchlist WHERE user_id = ? AND auction_id = ?')
      .run(request.user.id, request.params.auctionId)
    response.json({ watched: false })
  })

  app.post('/api/auctions/:auctionId/bids', requireAuth, (request, response) => {
    const amount = Number(request.body?.amount)
    if (!Number.isSafeInteger(amount) || amount < 1) throw new HttpError(400, 'Bid must be a whole dollar amount.')

    const placeBid = database.transaction(() => {
      const auction = database.prepare('SELECT * FROM auctions WHERE id = ?')
        .get(request.params.auctionId)
      if (!auction || auction.status !== 'active') throw new HttpError(404, 'Auction not found.')
      if (auction.ends_at <= Date.now()) throw new HttpError(409, 'This auction has ended.')
      if (auction.seller_id === request.user.id) throw new HttpError(403, 'You cannot bid on your own listing.')
      if (amount < auction.current_price + auction.bid_increment) {
        throw new HttpError(400, `The next bid must be at least $${(auction.current_price + auction.bid_increment).toLocaleString()}.`)
      }

      database.prepare('INSERT INTO bids (auction_id, bidder_id, amount) VALUES (?, ?, ?)')
        .run(auction.id, request.user.id, amount)
      database.prepare('UPDATE auctions SET current_price = ? WHERE id = ?')
        .run(amount, auction.id)
      return readAuction(database, auction.id, request.user.id)
    })

    const auction = placeBid.immediate()
    response.status(201).json({ auction: publicAuction(auction) })
  })

  app.delete('/api/auctions/:auctionId', requireAuth, (request, response) => {
    const cancelListing = database.transaction(() => {
      const auction = database.prepare('SELECT * FROM auctions WHERE id = ?')
        .get(request.params.auctionId)
      if (!auction) throw new HttpError(404, 'Auction not found.')
      if (auction.seller_id !== request.user.id) throw new HttpError(403, 'You can only cancel your own listings.')
      const bidCount = database.prepare('SELECT COUNT(*) AS count FROM bids WHERE auction_id = ?')
        .get(auction.id).count
      if (bidCount > 0) throw new HttpError(409, 'A listing with bids cannot be cancelled.')
      database.prepare("UPDATE auctions SET status = 'cancelled' WHERE id = ?").run(auction.id)
    })
    cancelListing()
    response.json({ message: 'Listing cancelled.' })
  })

  if (serveWeb) {
    app.use(express.static(publicDirectory, { index: false, maxAge: '1h' }))
    app.use((request, response, next) => {
      if (request.method !== 'GET' || request.path.startsWith('/api/')) return next()
      response.sendFile(path.join(publicDirectory, 'index.html'))
    })
  }

  app.use('/api', (request, response) => response.status(404).json({ error: 'API route not found.' }))
  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error)
    const status = error instanceof HttpError ? error.status : 500
    if (status >= 500) console.error(error)
    response.status(status).json({ error: status >= 500 ? 'The server could not complete that request.' : error.message })
  })

  return app
}