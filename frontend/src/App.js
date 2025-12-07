import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import axios from 'axios';
import { FiSettings, FiMessageCircle, FiMenu, FiX, FiHome, FiUser, FiUsers, FiShield, FiHelpCircle, FiBookOpen, FiPhoneCall } from 'react-icons/fi';
import Logo from './components/Logo';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import VerifyBanner from './components/VerifyBanner';
import Feed from './pages/Feed';
import Profile from './pages/Profile';
import PostDetail from './pages/PostDetail';
import AdminPanel from './pages/AdminPanel';
import ContactUs from './pages/ContactUs';
import Guidelines from './pages/Guidelines';
import Settings from './pages/Settings';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import Messenger from './pages/Messenger';
import Friends from './pages/Friends';
import About from './pages/About';

const resolveApiBase = () => {
  const envBase = process.env.REACT_APP_API_BASE;
  try {
    const { protocol, hostname, origin } = window.location;
    // If running on HTTPS and env points to http localhost, prefer same-origin /api to avoid mixed content
    if (protocol === 'https:' && envBase && envBase.startsWith('http://localhost')) {
      return `${origin}/api`;
    }
    // If on sociallyapp.org domain, use same-origin /api unless env explicitly sets a https API
    if (protocol === 'https:' && /sociallyapp\.org$/i.test(hostname) && (!envBase || envBase.startsWith('http://'))) {
      return `${origin}/api`;
    }
    return envBase || 'https://api.sociallyapp.org/api';
  } catch {
    return envBase || 'https://api.sociallyapp.org/api';
  }
};
const API_BASE = resolveApiBase();

const GroupsIcon = (props) => (
  <svg
    viewBox="0 0 48 48"
    width="24"
    height="24"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-hidden="true"
    fill="none"
    {...props}
  >
    <circle cx="24" cy="18" r="6" fill="currentColor" />
    <path d="M24 25c-5 0-9 4-9 9v4h18v-4c0-5-4-9-9-9z" fill="currentColor" />
    <circle cx="12" cy="22" r="4" fill="currentColor" opacity="0.7" />
    <circle cx="36" cy="22" r="4" fill="currentColor" opacity="0.7" />
    <path d="M12 27c-3.5 0-6 2.8-6 6.5V38h8v-3c0-2.4 0.6-4.6 1.8-6.5H12z" fill="currentColor" opacity="0.6" />
    <path d="M36 27c3.5 0 6 2.8 6 6.5V38h-8v-3c0-2.4-0.6-4.6-1.8-6.5H36z" fill="currentColor" opacity="0.6" />
  </svg>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showHamburger, setShowHamburger] = useState(false);

  // Fallback: when hamburger overlay is open, add a class to body to
  // disable pointer events on the page behind the overlay and prevent
  // background scrolling. This helps prevent click/touch passthrough on
  // older mobile browsers.
  useEffect(() => {
    const cls = 'no-pointer-events';
    if (showHamburger) {
      try {
        document.body.classList.add(cls);
        document.body.style.overflow = 'hidden';
      } catch (e) { /* ignore */ }
    } else {
      try {
        document.body.classList.remove(cls);
        document.body.style.overflow = '';
      } catch (e) { /* ignore */ }
    }
    return () => {
      try {
        document.body.classList.remove(cls);
        document.body.style.overflow = '';
      } catch (e) { /* ignore */ }
    };
  }, [showHamburger]);

  useEffect(() => {
    if (token) {
      // Push notifications disabled per user preference; skipping FCM and web-push setup.
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      (async function fetchUserInside() {
        try {
          const response = await axios.get(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(response.data);
        } catch (err) {
          localStorage.removeItem('token');
          setToken(null);
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }
  }, [token]);

  // fetchUser moved into effect to satisfy lint rules

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (!token) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login setToken={setToken} setUser={setUser} />} />
          <Route path="/register" element={<Register setToken={setToken} setUser={setUser} />} />
          <Route path="/verify" element={<VerifyEmail />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <div className={`app ${sidebarCollapsed ? 'navbar-collapsed' : ''}`}>
        {/* Sharing banner removed */}
        <nav className={`navbar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label="Toggle sidebar"
          >
            {sidebarCollapsed ? <FiMenu size={24} /> : <FiX size={24} />}
          </button>
          <div className="navbar-logo">
            <Logo />
            {!sidebarCollapsed && <span>Socially</span>}
          </div>
          <div className="navbar-links">
            <div className="top-links">
              {/* Top-priority links - appear at the top on larger screens */}
              <Link to="/" title="Feed" aria-label="Feed" className="top-link">
                <FiHome className="nav-icon" />
                <span className="nav-label">Feed</span>
              </Link>

              <Link to="/friends" title="Friends" aria-label="Friends" className="top-link">
                <FiUsers className="nav-icon" />
                <span className="nav-label">Friends</span>
              </Link>

              {/* Admin link: visible only if user has moderator+ access */}
              {(() => {
                const role = (user?.role || '').toString().toLowerCase();
                const normalize = (r) => r.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
                const modPlus = new Set(['moderator','admin','coowner','secondaryowner','owner']);
                if (modPlus.has(normalize(role))) {
                  return (
                    <Link to="/admin" title="Admin" aria-label="Admin" className="top-link">
                      <FiShield className="nav-icon" />
                      <span className="nav-label">Admin</span>
                    </Link>
                  );
                }
                return null;
              })()}
              {/* Hamburger placed with top-links on wide screens so it appears next to icons */}
              <button
                className="hamburger-toggle top-link"
                aria-label="Open menu"
                onClick={() => setShowHamburger(true)}
                title="Menu"
              >
                <FiMenu className="nav-icon" />
                <span className="nav-label">Menu</span>
              </button>
            </div>

            <div className="side-links">
              {/* Settings and other secondary links - shown on the side */}
              <Link to="/settings" className="settings-link side-link hamburger-item" title="Settings" aria-label="Settings">
                <FiSettings className="nav-icon" size={20} />
                <span className="nav-label">Settings</span>
              </Link>

              <Link to={`/profile/${user?.id}`} title="Profile" aria-label="Profile" className="side-link hamburger-item">
                <FiUser className="nav-icon" />
                <span className="nav-label">Profile</span>
              </Link>

              <Link to="/groups" title="Groups" aria-label="Groups" className="side-link hamburger-item">
                <GroupsIcon className="nav-icon" />
                <span className="nav-label">Groups</span>
              </Link>

              <Link to="/about" title="About" aria-label="About" className="side-link hamburger-item">
                <FiHelpCircle className="nav-icon" />
                <span className="nav-label">About</span>
              </Link>

              <Link to="/guidelines" title="Guidelines" aria-label="Guidelines" className="side-link hamburger-item">
                <FiBookOpen className="nav-icon" />
                <span className="nav-label">Guidelines</span>
              </Link>

              <Link to="/contact" title="Contact Us" aria-label="Contact Us" className="side-link hamburger-item">
                <FiPhoneCall className="nav-icon" />
                <span className="nav-label">Contact Us</span>
              </Link>

              <Link to="/messenger" className="messenger-link side-link hamburger-item" title="Messages" aria-label="Messages">
                <FiMessageCircle className="nav-icon" size={20} />
              </Link>

              {/* hamburger moved to top-links on wide screens; keep side-links focused on secondary items */}
            </div>
          </div>
        </nav>

        {/* Hamburger menu overlay (appears on tablet/mobile) */}
        {showHamburger && createPortal(
          <div
            className="hamburger-overlay"
            role="dialog"
            aria-modal="true"
            onClick={(e) => { if (e.target === e.currentTarget) setShowHamburger(false); }}
          >
            <div className="hamburger-menu" onClick={(e) => e.stopPropagation()}>
              <button className="hamburger-close" onClick={() => setShowHamburger(false)} aria-label="Close menu">✕</button>
              <nav className="hamburger-nav">
                <Link to="/settings" onClick={() => setShowHamburger(false)} className="hamburger-item">
                  <FiSettings className="nav-icon" />
                  <span className="nav-label">Settings</span>
                </Link>

                <Link to="/" onClick={() => setShowHamburger(false)} className="hamburger-item">
                  <FiHome className="nav-icon" />
                  <span className="nav-label">Feed</span>
                </Link>

                <Link to="/friends" onClick={() => setShowHamburger(false)} className="hamburger-item">
                  <FiUsers className="nav-icon" />
                  <span className="nav-label">Friends</span>
                </Link>

                {(() => {
                  const role = (user?.role || '').toString().toLowerCase();
                  const normalize = (r) => r.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
                  const modPlus = new Set(['moderator','admin','coowner','secondaryowner','owner']);
                  return modPlus.has(normalize(role));
                })() && (
                  <Link to="/admin" onClick={() => setShowHamburger(false)} className="hamburger-item">
                    <FiShield className="nav-icon" />
                    <span className="nav-label">Admin</span>
                  </Link>
                )}

                <hr />
                {/* Other items */}
                <Link to={`/profile/${user?.id}` } onClick={() => setShowHamburger(false)} className="hamburger-item">
                  <FiUser className="nav-icon" />
                  <span className="nav-label">Profile</span>
                </Link>

                <Link to="/groups" onClick={() => setShowHamburger(false)} className="hamburger-item">
                  <GroupsIcon className="nav-icon" />
                  <span className="nav-label">Groups</span>
                </Link>

                <Link to="/messenger" onClick={() => setShowHamburger(false)} className="hamburger-item">
                  <FiMessageCircle className="nav-icon" />
                  <span className="nav-label">Messages</span>
                </Link>

                <Link to="/about" onClick={() => setShowHamburger(false)} className="hamburger-item">
                  <FiHelpCircle className="nav-icon" />
                  <span className="nav-label">About</span>
                </Link>

                <Link to="/guidelines" onClick={() => setShowHamburger(false)} className="hamburger-item">
                  <FiBookOpen className="nav-icon" />
                  <span className="nav-label">Guidelines</span>
                </Link>

                <Link to="/contact" onClick={() => setShowHamburger(false)} className="hamburger-item">
                  <FiPhoneCall className="nav-icon" />
                  <span className="nav-label">Contact</span>
                </Link>
              </nav>
            </div>
          </div>,
          document.body
        )}

        <div className="container">
          <VerifyBanner user={user} />
          <Routes>
            <Route path="/verify" element={<VerifyEmail />} />
            <Route path="/" element={<Feed user={user} apiBase={API_BASE} setUser={setUser} />} />
            <Route path="/post/:postId" element={<PostDetail user={user} apiBase={API_BASE} />} />
            <Route path="/profile/:userId" element={<Profile user={user} apiBase={API_BASE} />} />
            <Route path="/friends" element={<Friends user={user} apiBase={API_BASE} />} />
            <Route path="/messenger" element={<Messenger user={user} apiBase={API_BASE} />} />
            <Route path="/admin" element={user?.role === 'owner' ? <AdminPanel user={user} apiBase={API_BASE} /> : <Navigate to="/" />} />
            <Route path="/about" element={<About />} />
            <Route path="/guidelines" element={<Guidelines />} />
            <Route path="/contact" element={<ContactUs apiBase={API_BASE} />} />
            <Route path="/settings" element={<Settings user={user} apiBase={API_BASE} setUser={setUser} handleLogout={handleLogout} />} />
            <Route path="/groups" element={<Groups user={user} apiBase={API_BASE} />} />
            <Route path="/groups/:groupId" element={<GroupDetail user={user} apiBase={API_BASE} />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
