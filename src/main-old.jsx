import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import {
  authenticateUser,
  calculatePasswordStrength,
  changePassword,
  clearUserSession,
  generateVerificationCode,
  getRemainingTime,
  getStoredUser,
  getUsersFromStorage,
  registerUser,
  resetPassword,
  saveUserSession,
  verifyEmail,
} from './auth'

const initialAuctions = [
  {
    id: 1,
    category: 'DESIGN',
    title: 'Eames Lounge Chair',
    seller: 'Northstar Objects',
    price: 3850,
    bids: 24,
    watched: true,
    endsAt: Date.now() + 1000 * 60 * 138,
    image: 'https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 2,
    category: 'TIMEPIECES',
    title: 'Seiko 6139 Chronograph',
    seller: 'Second Hand Studio',
    price: 1240,
    bids: 17,
    watched: false,
    endsAt: Date.now() + 1000 * 60 * 342,
    image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 3,
    category: 'PHOTOGRAPHY',
    title: 'Untitled, Kyoto 1978',
    seller: 'Aperture Archive',
    price: 2100,
    bids: 9,
    watched: false,
    endsAt: Date.now() + 1000 * 60 * 60 * 28,
    image: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=900&q=85',
  },
]

const initialBids = [
  ['09:42:18', 'M. Chen', 3850],
  ['09:41:56', 'A. Rao', 3750],
  ['09:40:07', 'S. Williams', 3650],
  ['09:37:44', 'K. Ito', 3550],
]

const formatCountdown = (endTime) => {
  const remaining = getRemainingTime(endTime)
  if (remaining.totalSeconds <= 0) return 'ENDED'

  return `${String(remaining.hours).padStart(2, '0')}h ${String(remaining.minutes).padStart(2, '0')}m ${String(remaining.seconds).padStart(2, '0')}s`
}

const formatCompactCountdown = (endTime) => {
  const remaining = getRemainingTime(endTime)
  if (remaining.totalSeconds <= 0) return 'Ended'

  return `${String(remaining.hours).padStart(2, '0')}h ${String(remaining.minutes).padStart(2, '0')}m`
}

function App() {
  const [user, setUser] = useState(() => getStoredUser())
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' })
  const [verificationForm, setVerificationForm] = useState({ email: '', code: '' })
  const [resetForm, setResetForm] = useState({ email: '', newPassword: '' })
  const [authMode, setAuthMode] = useState('login')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState({ login: false, register: false, reset: false })
  const [loginError, setLoginError] = useState('')
  const [registerError, setRegisterError] = useState('')
  const [resetError, setResetError] = useState('')
  const [verificationError, setVerificationError] = useState('')
  const [activeNav, setActiveNav] = useState('Discover')
  const [auctions, setAuctions] = useState(initialAuctions)
  const [selectedId, setSelectedId] = useState(initialAuctions[0].id)
  const [currentBid, setCurrentBid] = useState(initialAuctions[0].price)
  const [bidHistory, setBidHistory] = useState(initialBids)
  const [watching, setWatching] = useState(initialAuctions[0].watched)
  const [role, setRole] = useState('Bidder')
  const [showListing, setShowListing] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [currentPage, setCurrentPage] = useState('discover')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterPriceRange, setFilterPriceRange] = useState([0, 10000])
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: 'None', color: '#5d5952' })
  const [settingsForm, setSettingsForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [settingsError, setSettingsError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [userBids, setUserBids] = useState([])
  const [notifications, setNotifications] = useState([])
  const [userListings, setUserListings] = useState([])
  const [listingForm, setListingForm] = useState({ title: '', startPrice: '', bidIncrement: '', category: 'Design' })
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!notice) return undefined

    const timer = window.setTimeout(() => setNotice(''), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  const selected = auctions.find((auction) => auction.id === selectedId) ?? auctions[0]
  const selectedRemaining = getRemainingTime(selected.endsAt)

  useEffect(() => {
    setCurrentBid((previousBid) => {
      if (previousBid > 0) return previousBid
      return selected.price
    })
    setWatching(selected.watched)
  }, [selected])

  const handleLoginSubmit = (event) => {
    event.preventDefault()

    const result = authenticateUser(loginForm, getUsersFromStorage())

    if (!result.success) {
      setLoginError(result.message)
      setNotice(result.message)
      return
    }

    setUser(result.user)
    setLoginError('')
    setLoginForm({ email: '', password: '' })
    saveUserSession(result.user, rememberMe)
    setNotice(result.message)
  }

  const handleRegisterSubmit = (event) => {
    event.preventDefault()

    const result = registerUser(registerForm, getUsersFromStorage())

    if (!result.success) {
      setRegisterError(result.message)
      setNotice(result.message)
      return
    }

    const savedUsers = result.users || getUsersFromStorage()
    window.localStorage.setItem('bidboard-users', JSON.stringify(savedUsers))

    const loginResult = authenticateUser({
      email: registerForm.email,
      password: registerForm.password,
    }, savedUsers)

    setUser(loginResult.user)
    setRegisterError('')
    setRegisterForm({ name: '', email: '', password: '' })
    setVerificationForm({ email: registerForm.email, code: savedUsers.find((user) => user.email === registerForm.email.toLowerCase())?.verificationCode || generateVerificationCode() })
    setAuthMode('verify')
    saveUserSession(loginResult.user, rememberMe)
    setNotice('Account created. Please verify your email code to continue.')
  }

  const handleVerificationSubmit = (event) => {
    event.preventDefault()

    const result = verifyEmail(verificationForm, getUsersFromStorage())

    if (!result.success) {
      setVerificationError(result.message)
      setNotice(result.message)
      return
    }

    if (result.users) {
      window.localStorage.setItem('bidboard-users', JSON.stringify(result.users))
    }

    const refreshedUser = getStoredUser()
    setUser(refreshedUser)
    setVerificationError('')
    setVerificationForm({ email: '', code: '' })
    setAuthMode('login')
    setNotice(result.message)
  }

  const handleResetSubmit = (event) => {
    event.preventDefault()

    const existingUsers = getUsersFromStorage()
    const result = resetPassword(resetForm, existingUsers)

    if (!result.success) {
      setResetError(result.message)
      setNotice(result.message)
      return
    }

    if (result.users) {
      window.localStorage.setItem('bidboard-users', JSON.stringify(result.users))
    }

    setResetError('')
    setResetForm({ email: '', newPassword: '' })
    setAuthMode('login')
    setNotice(result.message)
  }

  const handleLogout = () => {
    setUser(null)
    clearUserSession()
    setShowProfileMenu(false)
    setCurrentPage('discover')
    setNotice('You have been signed out.')
  }

  const handleSettingsSubmit = (event) => {
    event.preventDefault()

    if (settingsForm.newPassword !== settingsForm.confirmPassword) {
      setSettingsError('Passwords do not match.')
      return
    }

    const result = changePassword({
      email: user.email,
      currentPassword: settingsForm.currentPassword,
      newPassword: settingsForm.newPassword,
    }, getUsersFromStorage())

    if (!result.success) {
      setSettingsError(result.message)
      setNotice(result.message)
      return
    }

    if (result.users) {
      window.localStorage.setItem('bidboard-users', JSON.stringify(result.users))
    }

    setSettingsError('')
    setSettingsForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setNotice(result.message)
  }

  const handleRegisterPasswordChange = (newPassword) => {
    setRegisterForm((current) => ({ ...current, password: newPassword }))
    setPasswordStrength(calculatePasswordStrength(newPassword))
  }

  const placeBid = (amount) => {
    if (!user) return

    const nextBid = Number(amount)
    setCurrentBid(nextBid)
    setBidHistory((history) => [
      [new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), 'You', nextBid],
      ...history,
    ].slice(0, 4))

    const bidEntry = {
      id: selected.id,
      title: selected.title,
      amount: nextBid,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }
    setUserBids((prev) => [bidEntry, ...prev])

    const notification = {
      id: Date.now(),
      message: `You placed a bid of $${nextBid.toLocaleString()} on ${selected.title}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setNotifications((prev) => [notification, ...prev].slice(0, 5))

    setNotice(`Bid placed at $${nextBid.toLocaleString()}`)
  }

  const handleCreateListing = (event) => {
    event.preventDefault()

    if (!listingForm.title || !listingForm.startPrice) {
      setNotice('Please fill in all listing details.')
      return
    }

    const newListing = {
      id: Date.now(),
      title: listingForm.title,
      startPrice: Number(listingForm.startPrice),
      bidIncrement: Number(listingForm.bidIncrement) || 50,
      category: listingForm.category,
      createdAt: new Date().toLocaleDateString(),
      status: 'Draft',
    }

    setUserListings((prev) => [newListing, ...prev])
    setListingForm({ title: '', startPrice: '', bidIncrement: '', category: 'Design' })
    setShowListing(false)
    setNotice('Listing created successfully!')
  }

  const selectAuction = (auction) => {
    setSelectedId(auction.id)
    setCurrentBid(auction.price)
    setWatching(auction.watched)
    setNotice(`${auction.title} is now in focus`)
  }

  if (!user) {
    return (
      <div className="auth-shell">
        <div className="auth-panel">
          <div className="auth-copy">
            <span className="auth-badge">BIDBOARD</span>
            <h1>Welcome back to the live auction floor.</h1>
            <p>Track rare objects, place bids in real time, and manage listings from one secure workspace.</p>
            <ul>
              <li>Instant bidding</li>
              <li>Verified sellers</li>
              <li>Live countdowns</li>
            </ul>
          </div>

          <div className="auth-card">
            <div className="auth-toggle">
              <button
                type="button"
                className={authMode === 'login' ? 'mode-button active' : 'mode-button'}
                onClick={() => setAuthMode('login')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={authMode === 'register' ? 'mode-button active' : 'mode-button'}
                onClick={() => setAuthMode('register')}
              >
                Register
              </button>
            </div>

            {authMode === 'login' ? (
              <>
                <div className="auth-heading">
                  <h2>Sign in</h2>
                  <span>Private access</span>
                </div>

                <form onSubmit={handleLoginSubmit} className="auth-form">
                  <label>
                    Email
                    <input
                      type="email"
                      value={loginForm.email}
                      onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="admin@bidboard.com"
                      required
                    />
                  </label>

                  <label>
                    Password
                    <div className="password-row">
                      <input
                        type={showPassword.login ? 'text' : 'password'}
                        value={loginForm.password}
                        onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                        placeholder="Enter your password"
                        required
                      />
                      <button type="button" className="inline-toggle" onClick={() => setShowPassword((current) => ({ ...current, login: !current.login }))}>
                        {showPassword.login ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </label>

                  <label className="remember-row">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                    />
                    Remember me
                  </label>

                  <button type="button" className="text-link" onClick={() => { setAuthMode('reset'); setLoginError(''); setResetError('') }}>
                    Forgot password?
                  </button>

                  {loginError && <p className="auth-error">{loginError}</p>}

                  <button type="submit" className="login-button">Sign in to Bidboard</button>
                </form>

                <p className="demo-credentials">
                  Demo credentials: admin@bidboard.com / Bidboard@2026
                </p>
              </>
            ) : authMode === 'register' ? (
              <>
                <div className="auth-heading">
                  <h2>Create account</h2>
                  <span>New bidder</span>
                </div>

                <form onSubmit={handleRegisterSubmit} className="auth-form">
                  <label>
                    Full name
                    <input
                      type="text"
                      value={registerForm.name}
                      onChange={(event) => setRegisterForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Jane Doe"
                      required
                    />
                  </label>

                  <label>
                    Email
                    <input
                      type="email"
                      value={registerForm.email}
                      onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="you@example.com"
                      required
                    />
                  </label>

                  <label>
                    Password
                    <div className="password-row">
                      <input
                        type={showPassword.register ? 'text' : 'password'}
                        value={registerForm.password}
                        onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                        placeholder="Create a password"
                        minLength={6}
                        required
                      />
                      <button type="button" className="inline-toggle" onClick={() => setShowPassword((current) => ({ ...current, register: !current.register }))}>
                        {showPassword.register ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </label>

                  {registerError && <p className="auth-error">{registerError}</p>}

                  <button type="submit" className="login-button">Create account</button>
                </form>
              </>
            ) : authMode === 'verify' ? (
              <>
                <div className="auth-heading">
                  <h2>Verify email</h2>
                  <span>Secure entry</span>
                </div>

                <form onSubmit={handleVerificationSubmit} className="auth-form">
                  <label>
                    Email
                    <input
                      type="email"
                      value={verificationForm.email}
                      onChange={(event) => setVerificationForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="name@example.com"
                      required
                    />
                  </label>

                  <label>
                    Verification code
                    <input
                      type="text"
                      value={verificationForm.code}
                      onChange={(event) => setVerificationForm((current) => ({ ...current, code: event.target.value }))}
                      placeholder="Enter 6-digit code"
                      required
                    />
                  </label>

                  {verificationError && <p className="auth-error">{verificationError}</p>}

                  <button type="submit" className="login-button">Verify my email</button>
                  <button type="button" className="secondary-button" onClick={() => setAuthMode('login')}>
                    Skip for now
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="auth-heading">
                  <h2>Reset password</h2>
                  <span>Account recovery</span>
                </div>

                <form onSubmit={handleResetSubmit} className="auth-form">
                  <label>
                    Email
                    <input
                      type="email"
                      value={resetForm.email}
                      onChange={(event) => setResetForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="name@example.com"
                      required
                    />
                  </label>

                  <label>
                    New password
                    <div className="password-row">
                      <input
                        type={showPassword.reset ? 'text' : 'password'}
                        value={resetForm.newPassword}
                        onChange={(event) => setResetForm((current) => ({ ...current, newPassword: event.target.value }))}
                        placeholder="Choose a new password"
                        minLength={6}
                        required
                      />
                      <button type="button" className="inline-toggle" onClick={() => setShowPassword((current) => ({ ...current, reset: !current.reset }))}>
                        {showPassword.reset ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </label>

                  {resetError && <p className="auth-error">{resetError}</p>}

                  <button type="submit" className="login-button">Update password</button>
                  <button type="button" className="secondary-button" onClick={() => setAuthMode('login')}>
                    Back to sign in
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">B</span><span>bidboard</span></div>
        <div className="profile-switch">
          <span className="avatar">{user.initials || 'HY'}</span>
          <span className="profile-copy"><strong>{user.name}</strong><small>{role} account</small></span>
          <select value={role} onChange={(event) => setRole(event.target.value)} aria-label="Select user role">
            <option>Bidder</option><option>Seller</option><option>Admin</option>
          </select>
        </div>
        <nav className="primary-nav" aria-label="Primary navigation">
          {['Discover', 'Watchlist', 'My bids', 'Sell an item'].map((item) => (
            <button className={activeNav === item ? 'nav-item active' : 'nav-item'} key={item} onClick={() => { setActiveNav(item); if (item === 'Sell an item') setShowListing(true) }}>
              <span className="nav-icon">{item === 'Discover' ? '◈' : item === 'Watchlist' ? '♡' : item === 'My bids' ? '↗' : '+'}</span>{item}
              {item === 'Watchlist' && <span className="nav-count">1</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom"><span className="online-dot"></span><span>Live system</span><span className="latency">24ms</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="crumb">MARKETPLACE <span>/</span> {activeNav.toUpperCase()}</div>
          <div className="header-actions">
            <button className="icon-button" aria-label="Search">⌕</button>
            <button className="icon-button" aria-label="Notifications">♧<i></i></button>
            <div className="profile-menu-container">
              <button className="account-button" onClick={() => setShowProfileMenu(!showProfileMenu)} type="button">
                <span className="avatar small">{user.initials || 'HY'}</span> {user.name.split(' ')[0].toUpperCase()} <span className="chevron">⌄</span>
              </button>
              {showProfileMenu && (
                <div className="profile-dropdown">
                  <button className="dropdown-item" onClick={() => { setNotice('Settings coming soon'); setShowProfileMenu(false) }}>Settings</button>
                  <button className="dropdown-item" onClick={() => { setNotice('Profile view coming soon'); setShowProfileMenu(false) }}>Profile</button>
                  <button className="dropdown-item divider" onClick={() => { handleLogout(); setShowProfileMenu(false) }}>Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="page-intro">
          <div>
            <p className="eyebrow">{new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()} <span className="live-pill"><b></b> LIVE AUCTIONS</span></p>
            <h1>Find something<br /><em>worth keeping.</em></h1>
          </div>
          <button className="outline-button" onClick={() => setShowListing(true)}>+ List an item</button>
        </section>

        <section className="feature-grid">
          <div className="featured-panel">
            <div className="image-wrap"><img src={selected.image} alt={selected.title} /><div className="image-label">FEATURED LOT <span>01 / 03</span></div><button className={watching ? 'watch-button watched' : 'watch-button'} onClick={() => setWatching(!watching)} aria-label="Toggle watchlist">{watching ? '♥' : '♡'}</button></div>
            <div className="featured-details">
              <div className="lot-meta"><span>{selected.category}</span><span>LOT 001</span></div>
              <h2>{selected.title}</h2>
              <p className="seller">Presented by <strong>{selected.seller}</strong></p>
              <div className="bid-summary">
                <div>
                  <small>CURRENT BID</small>
                  <strong>${currentBid.toLocaleString()}</strong>
                  <span className="bid-up">↑ 8.3%</span>
                </div>
                <div className="time-left">
                  <small>TIME REMAINING</small>
                  <strong>{formatCountdown(selected.endsAt)}</strong>
                  <span>Ends at {new Date(selected.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} GMT</span>
                </div>
              </div>
              <div className="bid-controls">
                <button className="bid-button" onClick={() => placeBid(currentBid + 100)}>Place bid <span>${(currentBid + 100).toLocaleString()}</span></button>
                <button className="increment-button" onClick={() => placeBid(currentBid + 250)}>+$250</button>
              </div>
              <p className="bid-note">By bidding, you agree to Bidboard's <u>terms of sale</u>.</p>
            </div>
          </div>

          <aside className="activity-panel">
            <div className="panel-heading"><div><p className="eyebrow">LIVE FEED</p><h3>Bid activity</h3></div><span className="pulse-label"><b></b> SYNCED</span></div>
            <div className="activity-list">{bidHistory.map(([time, bidder, amount], index) => <div className={index === 0 ? 'activity-row latest' : 'activity-row'} key={`${time}-${bidder}-${index}`}><span className="activity-time">{time}</span><span className="activity-avatar">{bidder === 'You' ? 'HY' : bidder.split(' ').map((word) => word[0]).join('')}</span><span className="activity-name">{bidder}{index === 0 && <small>Leading bidder</small>}</span><strong>${amount.toLocaleString()}</strong></div>)}</div>
            <button className="all-bids" onClick={() => setNotice('Full bid history is available in My bids')}>View full history <span>→</span></button>
          </aside>
        </section>

        <section className="catalog-section">
          <div className="section-heading"><div><p className="eyebrow">CURATED FOR YOU</p><h2>Ending soon</h2></div><button className="text-button" onClick={() => setNotice('Showing all active auctions')}>View all <span>→</span></button></div>
          <div className="auction-grid">{auctions.map((auction) => <button className={selected.id === auction.id ? 'auction-card selected' : 'auction-card'} key={auction.id} onClick={() => selectAuction(auction)}><div className="card-image"><img src={auction.image} alt={auction.title} /><span className="card-time">{formatCompactCountdown(auction.endsAt)}</span></div><div className="card-info"><div className="lot-meta"><span>{auction.category}</span><span>{auction.bids} bids</span></div><h3>{auction.title}</h3><p>{auction.seller}</p><strong>${auction.price.toLocaleString()}</strong></div></button>)}</div>
        </section>

        <footer className="footer"><span>© 2026 BIDBOARD</span><span>Secure auctions <b>•</b> Real-time bidding <b>•</b> Verified sellers</span><span>v1.0.4</span></footer>
      </main>

      {showListing && <div className="modal-backdrop" onClick={() => setShowListing(false)}><div className="listing-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowListing(false)}>×</button><p className="eyebrow">SELLER CONSOLE</p><h2>List a new item.</h2><p className="modal-copy">Set the details for your next live auction.</p><label>Item title<input placeholder="e.g. Leica M6 camera" /></label><div className="input-row"><label>Starting price<input placeholder="$ 0.00" /></label><label>Bid increment<input placeholder="$ 50" /></label></div><label>Category<select><option>Design</option><option>Timepieces</option><option>Photography</option><option>Collectibles</option></select></label><button className="bid-button full" onClick={() => { setShowListing(false); setNotice('Draft listing saved successfully') }}>Save draft <span>→</span></button></div></div>}
      {notice && <div className="toast"><span>✓</span>{notice}</div>}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
