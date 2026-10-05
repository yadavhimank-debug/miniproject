export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(result.error || 'The request could not be completed.', response.status)
  return result
}

export const api = {
  currentUser: () => request('/api/auth/me'),
  register: (body) => request('/api/auth/register', { method: 'POST', body }),
  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  changePassword: (body) => request('/api/auth/password', { method: 'PUT', body }),
  auctions: () => request('/api/auctions'),
  auctionBids: (auctionId) => request(`/api/auctions/${encodeURIComponent(auctionId)}/bids`),
  createAuction: (body) => request('/api/auctions', { method: 'POST', body }),
  placeBid: (auctionId, amount) => request(`/api/auctions/${encodeURIComponent(auctionId)}/bids`, {
    method: 'POST',
    body: { amount },
  }),
  watch: (auctionId, watched) => request(`/api/auctions/${encodeURIComponent(auctionId)}/watchlist`, {
    method: watched ? 'POST' : 'DELETE',
  }),
  cancelAuction: (auctionId) => request(`/api/auctions/${encodeURIComponent(auctionId)}`, { method: 'DELETE' }),
  myListings: () => request('/api/me/listings'),
  myBids: () => request('/api/me/bids'),
  myNotifications: () => request('/api/me/notifications'),
  myWatchlist: () => request('/api/me/watchlist'),
}