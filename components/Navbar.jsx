import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import '../Navbar.css';
import { Link } from 'react-router-dom';
import PreferencesModal from './PreferencesModal';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const Navbar = ({ onPreferencesComplete }) => {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'Users', user.uid));
        if (userDoc.exists()) {
          setUsername(userDoc.data().username || '');
        }
        setUser(user);
      } else {
        setUser(null);
        setUsername('');
      }
      setIsUserLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const calculateFontSize = () => {
    if (username.length < 5) return '1.6rem';
    if (username.length < 10) return '1.4rem';
    return '1.2rem';
  };

  const handleAuth = async (e) => {
  e.preventDefault();
  setError('');
  setAuthLoading(true);

  if (!email || !password) {
    setError('Email and password are required');
    setAuthLoading(false);
    return;
  }

  if (!isLogin && !username) {
    setError('Username is required');
    setAuthLoading(false);
    return;
  }

  try {
    if (isLogin) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'Users', userCredential.user.uid), {
        username: username,
        email: email,
        likes: [],
        dislikes: [],
        createdAt: new Date().toISOString()
      });
      // Show preferences modal only for new signups
      setShowPreferences(true);
    }
    setShowAuthModal(false);
    } catch (err) {
      const errorMessages = {
        'auth/invalid-email': 'Invalid email address',
        'auth/user-disabled': 'Account disabled',
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect password',
        'auth/email-already-in-use': 'Email already registered',
        'auth/operation-not-allowed': 'Email/password login not enabled',
        'auth/weak-password': 'Password must be at least 6 characters',
        'auth/network-request-failed': 'Network error'
      };
      setError(errorMessages[err.code] || 'Authentication failed. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
      setError('Failed to logout');
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setError('');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo" style={{ fontSize: window.innerWidth <= 768 && user ? calculateFontSize() : '1.6rem' }}>
          {user && window.innerWidth <= 768 ? username : "AniSwipe"}
        </div>

        <div className="navbar-links">
          {isUserLoading ? (
            <div className="navbar-loading">
              <div className="navbar-spinner"></div>
            </div>
          ) : user ? (
            <>
              <Link to="/watch-list" className="watch-list-btn">
                My Watch List
              </Link>
              <span className="navbar-username">Welcome, {username || user.email}</span>
              <button
                onClick={handleLogout}
                className="navbar-btn secondary"
                disabled={authLoading}
              >
                {authLoading ? '...' : 'Logout'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="hero-btn primary"
              id="login-btn"
            >
              Login / Sign Up
            </button>
          )}
        </div>
      </div>

      <div className={`auth-modal ${showAuthModal ? 'active' : ''}`}>
        <div className="auth-modal-content">
          <button
            className="close-modal"
            onClick={() => {
              setShowAuthModal(false);
              setError('');
            }}
            disabled={authLoading}
          >
            &times;
          </button>

          <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleAuth}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                disabled={authLoading}
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="password-input-wrapper">
                <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength="6"
                    placeholder="••••••"
                    disabled={authLoading}
                />
                <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                >
                    {showPassword ? '🙈' : '👁️'}
                </button>
                </div>

            </div>

            {!isLogin && (
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="cool_username"
                  disabled={authLoading}
                />
              </div>
            )}

            <button
              type="submit"
              className="hero-btn primary"
              disabled={authLoading}
            >
              {authLoading ? 'Processing...' : isLogin ? 'Login' : 'Sign Up'}
            </button>
          </form>

          <div className="auth-toggle">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={toggleAuthMode}
              className="toggle-btn"
              disabled={authLoading}
            >
              {isLogin ? 'Sign up' : 'Login'}
            </button>
          </div>
        </div>
      </div>

  {showPreferences && (
  <PreferencesModal 
    onComplete={() => {
      setShowPreferences(false);
      if (typeof onPreferencesComplete === 'function') {
        onPreferencesComplete();
      }
    }} 
    isOpen={showPreferences} 
  />
)}


    </nav>
  );
};

export default Navbar;
export { auth, db };
