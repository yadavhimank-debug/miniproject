import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createDatabase } from './database.js'

let database
let app

beforeEach(() => {
  database = createDatabase(':memory:')
  app = createApp(database, { isProduction: false })
})

afterEach(() => {
  database.close()
})

async function register(agent, name, email) {
  return agent.post('/api/auth/register').send({
    name,
    email,
    password: 'StrongPass123!',
  })
}

describe('account API', () => {
  it('starts without sample auctions and stores password hashes behind a session', async () => {
    const agent = request.agent(app)
    expect((await agent.get('/api/auctions')).body.auctions).toEqual([])
    expect((await request(app).get('/api/auth/me')).body.user).toBeNull()

    const result = await register(agent, 'Jordan Lee', 'jordan@example.test')
    expect(result.status).toBe(201)
    expect(result.body.user.email).toBe('jordan@example.test')
    expect(result.body.user.password).toBeUndefined()
    expect(result.headers['set-cookie'].join(';')).toMatch(/HttpOnly/i)

    const storedUser = database.prepare('SELECT password_hash FROM users WHERE email = ?').get('jordan@example.test')
    expect(storedUser.password_hash).not.toBe('StrongPass123!')
    expect((await agent.get('/api/auth/me')).body.user.name).toBe('Jordan Lee')
  })

  it('rejects duplicate emails regardless of case', async () => {
    const agent = request.agent(app)
    await register(agent, 'Jordan Lee', 'jordan@example.test')

    const duplicate = await register(agent, 'Another Name', 'JORDAN@example.test')
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.error).toMatch(/already exists/i)
  })
})

describe('auction ownership and bids', () => {
  it('requires an account to publish a listing', async () => {
    const result = await request(app).post('/api/auctions').send({
      title: 'Handmade vase',
      category: 'Design',
      startingPrice: 100,
      bidIncrement: 10,
    })
    expect(result.status).toBe(401)
  })

  it('allows another account to bid at the required increment and isolates account data', async () => {
    const seller = request.agent(app)
    const bidder = request.agent(app)
    const observer = request.agent(app)
    await register(seller, 'Seller One', 'seller@example.test')
    await register(bidder, 'Bidder Two', 'bidder@example.test')
    await register(observer, 'Observer Three', 'observer@example.test')

    const created = await seller.post('/api/auctions').send({
      title: 'Handmade vase',
      category: 'Design',
      startingPrice: 100,
      bidIncrement: 10,
      durationHours: 24,
    })
    expect(created.status).toBe(201)

    const selfBid = await seller.post(`/api/auctions/${created.body.auction.id}/bids`).send({ amount: 110 })
    expect(selfBid.status).toBe(403)

    const tooSmall = await bidder.post(`/api/auctions/${created.body.auction.id}/bids`).send({ amount: 109 })
    expect(tooSmall.status).toBe(400)

    const bid = await bidder.post(`/api/auctions/${created.body.auction.id}/bids`).send({ amount: 110 })
    expect(bid.status).toBe(201)
    expect(bid.body.auction.price).toBe(110)
    expect((await bidder.get('/api/me/bids')).body.bids).toHaveLength(1)
    expect((await seller.get('/api/me/listings')).body.listings).toHaveLength(1)
    expect((await observer.get('/api/me/listings')).body.listings).toHaveLength(0)
    expect((await seller.get('/api/me/notifications')).body.notifications[0].message).toMatch(/received a \$110 bid/)
  })

  it('keeps watchlists private and prevents cancelling a listing with bids', async () => {
    const seller = request.agent(app)
    const bidder = request.agent(app)
    const observer = request.agent(app)
    await register(seller, 'Seller One', 'seller@example.test')
    await register(bidder, 'Bidder Two', 'bidder@example.test')
    await register(observer, 'Observer Three', 'observer@example.test')

    const created = await seller.post('/api/auctions').send({
      title: 'Handmade vase',
      category: 'Design',
      startingPrice: 100,
      bidIncrement: 10,
    })
    const auctionId = created.body.auction.id

    await bidder.post(`/api/auctions/${auctionId}/watchlist`)
    expect((await bidder.get('/api/me/watchlist')).body.auctions).toHaveLength(1)
    expect((await observer.get('/api/me/watchlist')).body.auctions).toHaveLength(0)

    await bidder.post(`/api/auctions/${auctionId}/bids`).send({ amount: 110 })
    const cancel = await seller.delete(`/api/auctions/${auctionId}`)
    expect(cancel.status).toBe(409)
  })
})