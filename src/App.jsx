import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import { api } from './api'
import { calculatePasswordStrength, getRemainingTime } from './auth-utils'

const categories = ['DESIGN', 'TIMEPIECES', 'PHOTOGRAPHY', 'COLLECTIBLES']
const formatPrice = (amount) => `$${Number(amount || 0).toLocaleString()}`
const formatDate = (value) => new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'))

function formatCountdown(endsAt) {
  const remaining = getRemainingTime(endsAt)
  if (remaining.totalSeconds <= 0) return 'ENDED'
  return `${String(remaining.hours).padStart(2, '0')}h ${String(remaining.minutes).padStart(2, '0')}m ${String(remaining.seconds).padStart(2, '0')}s`
}

function formatShortCountdown(endsAt) {
  const remaining = getRemainingTime(endsAt)
  if (remaining.totalSeconds <= 0) return 'Ended'
  return `${String(remaining.hours).padStart(2, '0')}h ${String(remaining.minutes).padStart(2, '0')}m`
}

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [accountDataLoading, setAccountDataLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' })
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: 'None', color: '#5d5952' })
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState({ login: false, register: false, current: false })
  const [auctions, setAuctions] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [bidHistory, setBidHistory] = useState([])
  const [userBids, setUserBids] = useState([])
  const [userListings, setUserListings] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showListing, setShowListing] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [currentPage, setCurrentPage] = useState('discover')
  const [activeNav, setActiveNav] = useState('Discover')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterPrice, setFilterPrice] = useState(100000000)
  const [listingForm, setListingForm] = useState({
    title: '',
    category: 'Design',
    startPrice: '',
    bidIncrement: '50',
    durationHours: '72',
    imageUrl: '',
  })
  const [settingsForm, setSettingsForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [settingsError, setSettingsError] = useState('')
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let current = true
    api.currentUser()
      .then(({ user: account }) => {
        if (current) {
          setAccountDataLoading(Boolean(account))
          setUser(account)
        }
      })
      .catch((error) => {
        if (current && error.status !== 401) setAuthError(error.message)
      })
      .finally(() => { if (current) setAuthLoading(false) })
    return () => { current = false }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  const fetchAccountData = () => Promise.all([
      api.auctions(),
      api.myBids(),
      api.myListings(),
      api.myNotifications(),
  ])

  const applyAccountData = ([auctionResult, bidResult, listingResult, notificationResult]) => {
    setAuctions(auctionResult.auctions)
    setSelectedId((currentId) => auctionResult.auctions.some((auction) => auction.id === currentId)
      ? currentId
      : auctionResult.auctions[0]?.id ?? null)
    setUserBids(bidResult.bids)
    setUserListings(listingResult.listings)
    setNotifications(notificationResult.notifications)
    setAccountDataLoading(false)
  }

  const refreshAccountData = async () => applyAccountData(await fetchAccountData())

  useEffect(() => {
    if (!user) {
      setAccountDataLoading(false)
      setAuctions([])
      setSelectedId(null)
      setBidHistory([])
      setUserBids([])
      setUserListings([])
      setNotifications([])
      return undefined
    }

    let current = true
    setAccountDataLoading(true)
    fetchAccountData()
      .then((data) => { if (current) applyAccountData(data) })
      .catch((error) => {
        if (current) {
          setAccountDataLoading(false)
          setNotice(error.message)
        }
      })
    return () => { current = false }
  }, [user?.id])

  const filteredAuctions = auctions.filter((auction) => {
    const searchableText = `${auction.title} ${auction.seller} ${auction.category}`.toLowerCase()
    return searchableText.includes(searchQuery.trim().toLowerCase())
      && (filterCategory === 'All' || auction.category === filterCategory)
      && auction.price <= filterPrice
  })
  const selected = filteredAuctions.find((auction) => auction.id === selectedId)
    ?? filteredAuctions[0]
    ?? null
  const currentBid = selected?.price ?? 0

  useEffect(() => {
    if (!user || !selected) {
      setBidHistory([])
      return undefined
    }
    let current = true
    api.auctionBids(selected.id)
      .then(({ bids }) => { if (current) setBidHistory(bids) })
      .catch((error) => { if (current) setNotice(error.message) })
    return () => { current = false }
  }, [selected?.id, user?.id])

  useEffect(() => {
    if (!user) return undefined
    const interval = window.setInterval(() => {
      fetchAccountData().then(applyAccountData).catch((error) => setNotice(error.message))
      if (selected) {
        api.auctionBids(selected.id).then(({ bids }) => setBidHistory(bids)).catch((error) => setNotice(error.message))
      }
    }, 10000)
    return () => window.clearInterval(interval)
  }, [selected?.id, user?.id])

  const handleLogin = async (event) => {
    event.preventDefault()
    setAuthError('')
    try {
      const result = await api.login({ ...loginForm, rememberMe })
      setAccountDataLoading(true)
      setUser(result.user)
      setCurrentPage('discover')
      setActiveNav('Discover')
      setLoginForm({ email: '', password: '' })
      setNotice(result.message)
    } catch (error) {
      setAuthError(error.message)
    }
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    setAuthError('')
    try {
      const result = await api.register(registerForm)
      setAccountDataLoading(true)
      setUser(result.user)
      setCurrentPage('discover')
      setActiveNav('Discover')
      setRegisterForm({ name: '', email: '', password: '' })
      setPasswordStrength({ score: 0, label: 'None', color: '#5d5952' })
      setNotice(result.message)
    } catch (error) {
      setAuthError(error.message)
    }
  }

  const handleLogout = async () => {
    try {
      await api.logout()
    } catch (error) {
      setNotice(error.message)
    }
    setUser(null)
    setAuthMode('login')
    setAuthError('')
    setCurrentPage('discover')
    setActiveNav('Discover')
    setShowProfileMenu(false)
    setShowNotifications(false)
  }

  const handlePlaceBid = async (amount) => {
    if (!selected) return
    try {
      const { auction } = await api.placeBid(selected.id, amount)
      setAuctions((items) => items.map((item) => item.id === auction.id ? auction : item))
      const [historyResult, bidsResult, notificationResult] = await Promise.all([
        api.auctionBids(auction.id),
        api.myBids(),
        api.myNotifications(),
      ])
      setBidHistory(historyResult.bids)
      setUserBids(bidsResult.bids)
      setNotifications(notificationResult.notifications)
      setNotice(`Bid placed at ${formatPrice(amount)}`)
    } catch (error) {
      setNotice(error.message)
    }
  }

  const handleWatch = async () => {
    if (!selected) return
    const watched = !selected.watched
    try {
      await api.watch(selected.id, watched)
      setAuctions((items) => items.map((item) => item.id === selected.id ? { ...item, watched } : item))
    } catch (error) {
      setNotice(error.message)
    }
  }

  const handleCreateListing = async (event) => {
    event.preventDefault()
    try {
      const { auction } = await api.createAuction({
        title: listingForm.title.trim(),
        category: listingForm.category,
        startingPrice: Number(listingForm.startPrice),
        bidIncrement: Number(listingForm.bidIncrement),
        durationHours: Number(listingForm.durationHours),
        imageUrl: listingForm.imageUrl.trim(),
      })
      setAuctions((items) => [auction, ...items])
      setUserListings((items) => [auction, ...items])
      setSelectedId(auction.id)
      setListingForm({ title: '', category: 'Design', startPrice: '', bidIncrement: '50', durationHours: '72', imageUrl: '' })
      setShowListing(false)
      setCurrentPage('sell-an-item')
      setActiveNav('Sell an item')
      setNotice('Your auction is now published.')
    } catch (error) {
      setNotice(error.message)
    }
  }

  const handleCancelListing = async (auctionId) => {
    try {
      await api.cancelAuction(auctionId)
      await refreshAccountData()
      setNotice('Listing cancelled.')
    } catch (error) {
      setNotice(error.message)
    }
  }

  const handleChangePassword = async (event) => {
    event.preventDefault()
    if (settingsForm.newPassword !== settingsForm.confirmPassword) {
      setSettingsError('Passwords do not match.')
      return
    }
    try {
      const result = await api.changePassword({
        currentPassword: settingsForm.currentPassword,
        newPassword: settingsForm.newPassword,
      })
      setSettingsError('')
      setSettingsForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setNotice(result.message)
    } catch (error) {
      setSettingsError(error.message)
    }
  }

  const selectAuction = (auction) => {
    setSelectedId(auction.id)
    setCurrentPage('discover')
    setActiveNav('Discover')
  }

  if (authLoading) return <div className="auth-shell"><p>Loading account…</p></div>
  if (user && accountDataLoading) return <div className="auth-shell"><p>Loading your marketplace…</p></div>

  if (!user) {
    return (
      <div className="auth-shell">
        <div className="auth-panel">
          <div className="auth-copy">
            <span className="auth-badge">BIDBOARD</span>
            <h1>A considered marketplace for remarkable objects.</h1>
            <p>Create an account to publish listings and place bids. Your account and marketplace activity are stored in a local SQLite database.</p>
            <ul><li>Account-owned listings</li><li>Persistent auction records</li><li>No payment processing</li></ul>
          </div>
          <div className="auth-card">
            <div className="auth-toggle">
              <button type="button" className={authMode === 'login' ? 'mode-button active' : 'mode-button'} onClick={() => setAuthMode('login')}>Sign in</button>
              <button type="button" className={authMode === 'register' ? 'mode-button active' : 'mode-button'} onClick={() => setAuthMode('register')}>Register</button>
            </div>
            {authMode === 'login' ? (
              <>
                <div className="auth-heading"><h2>Sign in</h2><span>Account access</span></div>
                <form onSubmit={handleLogin} className="auth-form">
                  <label>Email<input type="email" value={loginForm.email} onChange={(event) => setLoginForm((form) => ({ ...form, email: event.target.value }))} autoComplete="email" required /></label>
                  <label>Password<div className="password-row"><input type={showPassword.login ? 'text' : 'password'} value={loginForm.password} onChange={(event) => setLoginForm((form) => ({ ...form, password: event.target.value }))} autoComplete="current-password" required /><button type="button" className="inline-toggle" onClick={() => setShowPassword((state) => ({ ...state, login: !state.login }))}>{showPassword.login ? 'Hide' : 'Show'}</button></div></label>
                  <label className="remember-row"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />Remember me</label>
                  {authError && <p className="auth-error" role="alert">{authError}</p>}
                  <button type="submit" className="login-button">Sign in to Bidboard</button>
                </form>
              </>
            ) : (
              <>
                <div className="auth-heading"><h2>Create account</h2><span>New account</span></div>
                <form onSubmit={handleRegister} className="auth-form">
                  <label>Full name<input type="text" value={registerForm.name} onChange={(event) => setRegisterForm((form) => ({ ...form, name: event.target.value }))} autoComplete="name" minLength={2} maxLength={80} required /></label>
                  <label>Email<input type="email" value={registerForm.email} onChange={(event) => setRegisterForm((form) => ({ ...form, email: event.target.value }))} autoComplete="email" required /></label>
                  <label>Password<div className="password-row"><input type={showPassword.register ? 'text' : 'password'} value={registerForm.password} onChange={(event) => { setRegisterForm((form) => ({ ...form, password: event.target.value })); setPasswordStrength(calculatePasswordStrength(event.target.value)) }} autoComplete="new-password" minLength={10} maxLength={128} required /><button type="button" className="inline-toggle" onClick={() => setShowPassword((state) => ({ ...state, register: !state.register }))}>{showPassword.register ? 'Hide' : 'Show'}</button></div><div className="password-strength"><div className="strength-bar"><div className="strength-fill" style={{ width: `${(passwordStrength.score / 5) * 100}%`, backgroundColor: passwordStrength.color }} /></div><span className="strength-label" style={{ color: passwordStrength.color }}>{passwordStrength.label}</span></div></label>
                  {authError && <p className="auth-error" role="alert">{authError}</p>}
                  <p className="demo-credentials">Email verification and password recovery need an email service, which is not configured.</p>
                  <button type="submit" className="login-button">Create account</button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  const navigate = (page, label) => {
    setCurrentPage(page)
    setActiveNav(label)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">B</span><span>bidboard</span></div>
        <div className="profile-switch"><span className="avatar">{user.initials || 'U'}</span><span className="profile-copy"><strong>{user.name}</strong><small>Account</small></span></div>
        <nav className="primary-nav" aria-label="Primary navigation">
          {['Discover', 'Watchlist', 'My bids', 'Sell an item'].map((label) => {
            const page = label.toLowerCase().replaceAll(' ', '-')
            return <button className={activeNav === label ? 'nav-item active' : 'nav-item'} key={label} onClick={() => { navigate(page, label); if (label === 'Sell an item') setShowListing(true) }}><span className="nav-icon">{label === 'Discover' ? '◈' : label === 'Watchlist' ? '♡' : label === 'My bids' ? '↗' : '+'}</span>{label}{label === 'Watchlist' && <span className="nav-count">{auctions.filter((auction) => auction.watched).length}</span>}{label === 'My bids' && userBids.length > 0 && <span className="nav-count">{userBids.length}</span>}</button>
          })}
        </nav>
        <div className="sidebar-bottom"><span className="online-dot"></span><span>SQLite marketplace</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="crumb">MARKETPLACE <span>/</span> {activeNav.toUpperCase()}</div>
          <div className="header-actions">
            <input type="search" className="search-box" placeholder="Search auctions..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            <div className="profile-menu-container">
              <button className="icon-button" aria-label="Notifications" aria-expanded={showNotifications} onClick={() => { setShowNotifications((open) => !open); setShowProfileMenu(false) }}>♧{notifications.length > 0 && <i>{notifications.length}</i>}</button>
              {showNotifications && <div className="profile-dropdown notification-dropdown"><h3>Notifications</h3>{notifications.length ? <div className="notifications-list">{notifications.map((item) => <div className="notification-item" key={item.id}><span className="notif-message">{item.message}</span><span className="notif-time">{new Date(item.time).toLocaleString()}</span></div>)}</div> : <p className="empty-state">No account activity yet.</p>}</div>}
            </div>
            <div className="profile-menu-container">
              <button className="account-button" type="button" onClick={() => { setShowProfileMenu((open) => !open); setShowNotifications(false) }}><span className="avatar small">{user.initials || 'U'}</span>{user.name.split(' ')[0].toUpperCase()}<span className="chevron">⌄</span></button>
              {showProfileMenu && <div className="profile-dropdown"><button className="dropdown-item" onClick={() => { navigate('profile', 'Profile'); setShowProfileMenu(false) }}>Profile</button><button className="dropdown-item" onClick={() => { navigate('settings', 'Settings'); setShowProfileMenu(false) }}>Settings</button><button className="dropdown-item divider" onClick={handleLogout}>Sign out</button></div>}
            </div>
          </div>
        </header>

        {currentPage === 'settings' ? (
          <section className="page-panel"><div className="page-header"><h2>Account Settings</h2><p>Change your account password</p></div><div className="settings-form-wrapper"><form onSubmit={handleChangePassword} className="settings-form"><h3>Change Password</h3><label>Current password<div className="password-row"><input type={showPassword.current ? 'text' : 'password'} value={settingsForm.currentPassword} onChange={(event) => setSettingsForm((form) => ({ ...form, currentPassword: event.target.value }))} autoComplete="current-password" required /><button type="button" className="inline-toggle" onClick={() => setShowPassword((state) => ({ ...state, current: !state.current }))}>{showPassword.current ? 'Hide' : 'Show'}</button></div></label><label>New password<input type="password" value={settingsForm.newPassword} onChange={(event) => setSettingsForm((form) => ({ ...form, newPassword: event.target.value }))} autoComplete="new-password" minLength={10} required /></label><label>Confirm new password<input type="password" value={settingsForm.confirmPassword} onChange={(event) => setSettingsForm((form) => ({ ...form, confirmPassword: event.target.value }))} autoComplete="new-password" minLength={10} required /></label>{settingsError && <p className="auth-error" role="alert">{settingsError}</p>}<button type="submit" className="login-button">Update password</button></form></div></section>
        ) : currentPage === 'profile' ? (
          <section className="page-panel"><div className="page-header"><h2>My Profile</h2><p>Account information and activity</p></div><div className="profile-info"><div className="info-card"><div className="info-header"><span className="avatar large">{user.initials || 'U'}</span><div><h3>{user.name}</h3><p>{user.email}</p></div></div><div className="info-details"><div className="detail-row"><span className="label">Account</span><span className="value">Active</span></div><div className="detail-row"><span className="label">Bids</span><span className="value">{userBids.length}</span></div><div className="detail-row"><span className="label">Listings</span><span className="value">{userListings.length}</span></div></div></div></div></section>
        ) : currentPage === 'watchlist' ? (
          <section className="page-panel"><div className="page-header"><h2>Watchlist</h2><p>Lots saved to your account</p></div>{filteredAuctions.some((auction) => auction.watched) ? <div className="auction-grid">{filteredAuctions.filter((auction) => auction.watched).map((auction) => <button className="auction-card" key={auction.id} onClick={() => selectAuction(auction)}><div className="card-image">{auction.image && <img src={auction.image} alt={auction.title} />}<span className="card-time">{formatShortCountdown(auction.endsAt)}</span></div><div className="card-info"><div className="lot-meta"><span>{auction.category}</span><span>{auction.bids} bids</span></div><h3>{auction.title}</h3><p>{auction.seller}</p><strong>{formatPrice(auction.price)}</strong></div></button>)}</div> : <p className="empty-state">No saved auctions match your search.</p>}</section>
        ) : currentPage === 'my-bids' ? (
          <section className="page-panel"><div className="page-header"><h2>My Bids</h2><p>Bids placed by your account</p></div>{userBids.length ? <div className="bids-list">{userBids.map((bid) => <button type="button" className="bid-card" key={bid.id} onClick={() => { const auction = auctions.find((item) => item.id === bid.auctionId); if (auction) selectAuction(auction) }}><div className="bid-info"><h4>{bid.title}</h4><p className="bid-time">{new Date(bid.time).toLocaleString()}</p></div><div className="bid-amount">{formatPrice(bid.amount)}</div></button>)}</div> : <p className="empty-state">You have not placed any bids yet.</p>}</section>
        ) : currentPage === 'sell-an-item' ? (
          <section className="page-panel"><div className="page-header"><h2>My Listings</h2><p>Auctions published by your account</p></div>{userListings.length ? <div className="listings-table">{userListings.map((listing) => <div className="listing-row" key={listing.id}><div className="listing-info"><h4>{listing.title}</h4><p className="listing-meta">{listing.category} · {formatDate(listing.createdAt).toLocaleDateString()} · {listing.status}</p><p>{listing.bids} bids · Ends {new Date(listing.endsAt).toLocaleString()}</p></div><div className="listing-price">{formatPrice(listing.price)}</div>{listing.bids === 0 && listing.status === 'active' && <button type="button" className="secondary-button" onClick={() => handleCancelListing(listing.id)}>Cancel listing</button>}</div>)}</div> : <p className="empty-state">No listings yet. Publish an auction to see it here.</p>}</section>
        ) : (
          <>
            <section className="page-intro"><div><p className="eyebrow">{new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()} <span className="live-pill"><b></b> ACCOUNT MARKETPLACE</span></p><h1>Find something<br /><em>worth keeping.</em></h1></div><button className="outline-button" onClick={() => setShowListing(true)}>+ List an item</button></section>
            <section className="filters-section"><div className="filter-group"><label>Category<select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}><option>All</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div><div className="filter-group"><label>Maximum price: {formatPrice(filterPrice)}<input type="range" min="0" max="100000000" step="100" value={filterPrice} onChange={(event) => setFilterPrice(Number(event.target.value))} /></label></div></section>
            {selected && <section className="feature-grid"><div className="featured-panel"><div className="image-wrap">{selected.image && <img src={selected.image} alt={selected.title} />}<div className="image-label">ACCOUNT LISTING</div><button className={selected.watched ? 'watch-button watched' : 'watch-button'} onClick={handleWatch} aria-label={selected.watched ? 'Remove from watchlist' : 'Add to watchlist'}>{selected.watched ? '♥' : '♡'}</button></div><div className="featured-details"><div className="lot-meta"><span>{selected.category}</span><span>{selected.bids} {selected.bids === 1 ? 'bid' : 'bids'}</span></div><h2>{selected.title}</h2><p className="seller">Listed by <strong>{selected.seller}</strong></p><div className="bid-summary"><div><small>CURRENT BID</small><strong>{formatPrice(currentBid)}</strong></div><div className="time-left"><small>TIME REMAINING</small><strong>{formatCountdown(selected.endsAt)}</strong><span>Ends {new Date(selected.endsAt).toLocaleString()}</span></div></div><div className="bid-controls">{selected.sellerId === user.id ? <p className="bid-note">This is your listing. You cannot bid on your own auction.</p> : selected.endsAt <= now ? <p className="bid-note">This auction has ended.</p> : <><button className="bid-button" onClick={() => handlePlaceBid(currentBid + selected.bidIncrement)}>Place bid <span>{formatPrice(currentBid + selected.bidIncrement)}</span></button><button className="increment-button" onClick={() => handlePlaceBid(currentBid + selected.bidIncrement * 2)}>+{formatPrice(selected.bidIncrement * 2)}</button></>}</div><p className="bid-note">Bids are stored in the local database. No payment is collected.</p></div></div><aside className="activity-panel"><div className="panel-heading"><div><p className="eyebrow">AUCTION HISTORY</p><h3>Bid activity</h3></div><span className="pulse-label">DATABASE</span></div><div className="activity-list">{bidHistory.length ? bidHistory.map((bid, index) => <div className={index === 0 ? 'activity-row latest' : 'activity-row'} key={bid.id}><span className="activity-time">{formatDate(bid.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span className="activity-avatar">{bid.bidder.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</span><span className="activity-name">{bid.bidder}</span><strong>{formatPrice(bid.amount)}</strong></div>) : <p className="empty-state">No bids have been placed on this auction.</p>}</div><button className="all-bids" onClick={() => navigate('my-bids', 'My bids')}>View your bids <span>→</span></button></aside></section>}
            <section className="catalog-section"><div className="section-heading"><div><p className="eyebrow">FROM MARKETPLACE ACCOUNTS</p><h2>Active auctions</h2></div><button className="text-button" onClick={() => { setSearchQuery(''); setFilterCategory('All'); setFilterPrice(100000000) }}>Clear filters</button></div>{filteredAuctions.length ? <div className="auction-grid">{filteredAuctions.map((auction) => <button className={selected?.id === auction.id ? 'auction-card selected' : 'auction-card'} key={auction.id} onClick={() => selectAuction(auction)}><div className="card-image">{auction.image && <img src={auction.image} alt={auction.title} />}<span className="card-time">{formatShortCountdown(auction.endsAt)}</span></div><div className="card-info"><div className="lot-meta"><span>{auction.category}</span><span>{auction.bids} bids</span></div><h3>{auction.title}</h3><p>{auction.seller}</p><strong>{formatPrice(auction.price)}</strong></div></button>)}</div> : <p className="empty-state">No active auctions match your filters. Create the first listing.</p>}</section>
            <footer className="footer"><span>Bidboard marketplace</span><span>Account-owned listings · Server-validated bids · No payments</span><span>SQLite</span></footer>
          </>
        )}
      </main>

      {showListing && <div className="modal-backdrop" onClick={() => setShowListing(false)}><div className="listing-modal" role="dialog" aria-modal="true" aria-labelledby="listing-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" type="button" aria-label="Close" onClick={() => setShowListing(false)}>×</button><p className="eyebrow">SELLER CONSOLE</p><h2 id="listing-title">Publish an auction.</h2><p className="modal-copy">Listings are tied to your account and saved in SQLite.</p><form onSubmit={handleCreateListing}><label>Item title<input value={listingForm.title} onChange={(event) => setListingForm((form) => ({ ...form, title: event.target.value }))} minLength={3} maxLength={120} required /></label><label>Photo URL (HTTPS)<input type="url" value={listingForm.imageUrl} onChange={(event) => setListingForm((form) => ({ ...form, imageUrl: event.target.value }))} placeholder="https://example.com/photo.jpg" /></label><div className="input-row"><label>Starting price<input type="number" min="1" step="1" value={listingForm.startPrice} onChange={(event) => setListingForm((form) => ({ ...form, startPrice: event.target.value }))} required /></label><label>Bid increment<input type="number" min="1" step="1" value={listingForm.bidIncrement} onChange={(event) => setListingForm((form) => ({ ...form, bidIncrement: event.target.value }))} required /></label></div><div className="input-row"><label>Category<select value={listingForm.category} onChange={(event) => setListingForm((form) => ({ ...form, category: event.target.value }))}>{categories.map((category) => <option key={category} value={category[0] + category.slice(1).toLowerCase()}>{category}</option>)}</select></label><label>Duration<select value={listingForm.durationHours} onChange={(event) => setListingForm((form) => ({ ...form, durationHours: event.target.value }))}><option value="24">24 hours</option><option value="72">3 days</option><option value="168">7 days</option><option value="720">30 days</option></select></label></div><button type="submit" className="bid-button full">Publish listing <span>→</span></button></form></div></div>}
      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)